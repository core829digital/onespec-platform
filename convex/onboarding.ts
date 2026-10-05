import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser, type ReadCtx } from "./lib/auth";
import { entitlementsFor, isWidgetPlan, resolveTenantEntitlements } from "./lib/entitlements";
import { regionForCountry } from "./lib/regions";
import { freeOnboardingAllowed } from "./lib/enforcement";
import { unlockOnPlanChange, unlockOnReactivation } from "./usage";
import { requirePermission } from "./lib/rbac";
import { companyAddress, companyContact, companyName, companyVat, supportedCountry } from "./lib/companyProfile";
import { MAX_MARGIN_PERCENT } from "../src/shared/standard-pricing";
import { MAX_OWN_SERVICE_PER_M2_CENTS } from "./pricing";
import { checkVatId, isCountryCode } from "../src/shared/validation";

/** Ordered wizard steps. `planQuiz`/`billing` are skipped once a plan is active. */
export const ONBOARDING_STEPS = ["welcome", "planQuiz", "billing", "company", "address", "contact", "tax", "team", "pricing", "configurator"] as const;
/** Step names stored by earlier versions of the wizard, and the step that replaced them. */
const LEGACY_STEP: Record<string, Step> = { zone: "pricing" };
type Step = (typeof ONBOARDING_STEPS)[number];

async function tenantOf(ctx: ReadCtx, userId: Id<"users">) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!membership) return null;
  const tenant = await ctx.db.get(membership.tenantId);
  return tenant ? { tenant, role: membership.role } : null;
}

export const getState = query({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) return { hasTenant: false as const };

    const { tenant, role } = found;
    const ent = resolveTenantEntitlements(tenant);
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const activeSub = tenant.planStatus === "active" || tenant.planStatus === "trialing";
    // Every tenant — including admins — goes through the plan quiz + picks a
    // plan before reaching the rest of the platform, regardless of whether
    // Stripe is live yet (see enforceActivePlan / onboarding.complete).
    const needsPlan = !activeSub;

    const configurators = (
      await ctx.db
        .query("configurators")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    ).filter((c) => c.status !== "archived");

    return {
      hasTenant: true as const,
      completed: !!tenant.onboardingCompletedAt,
      step: (LEGACY_STEP[tenant.onboardingStep ?? ""] ?? (tenant.onboardingStep as Step | undefined)) ?? "welcome",
      needsPlan,
      stripeConfigured,
      role,
      plan: tenant.plan,
      region: regionForCountry(tenant.country).code,
      priceZone: tenant.priceZone ?? null,
      tenantCountry: tenant.country ?? null,
      // What the installer already entered (to prefill the steps when they come back to them).
      profile: {
        name: tenant.name,
        vatId: tenant.vatId ?? "",
        street: tenant.addressStreet ?? "",
        postalCode: tenant.addressPostalCode ?? "",
        city: tenant.addressCity ?? "",
        phone: tenant.phone ?? "",
        email: tenant.companyEmail ?? "",
        website: tenant.website ?? "",
        defaultVatPercent: tenant.defaultVatPercent ?? null,
        viesAcknowledged: tenant.viesAckAt !== undefined,
        marginPercent: tenant.defaultMarginPercent ?? null,
        deliveryMode: tenant.defaultDeliveryMode ?? "factory",
        ownServicePerM2Cents: tenant.defaultOwnServicePerM2Cents ?? 0,
        pricingSaved: tenant.pricingSavedAt !== undefined,
      },
      vatRates: regionForCountry(tenant.country).vatRates.map((r) => ({ key: r.key, percent: r.percent, label: r.label })),
      entitlements: {
        maxConfigurators: ent.maxConfigurators,
        maxQuotesPerMonth: ent.maxQuotesPerMonth,
        maxTeamMembers: ent.maxTeamMembers,
        whiteLabel: ent.whiteLabel,
        advancedPricingRules: ent.advancedPricingRules,
        multiCatalog: ent.multiCatalog,
        analytics: ent.analytics,
        publicWidget: ent.publicWidget,
      },
      configuratorCount: configurators.length,
      firstPublicId: configurators[0]?.publicId ?? null,
    };
  },
});

export const advance = mutation({
  args: { step: v.union(...ONBOARDING_STEPS.map((s) => v.literal(s))) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) throw new ConvexError("NO_TENANT");
    if (found.tenant.onboardingCompletedAt) return;
    await ctx.db.patch(found.tenant._id, { onboardingStep: args.step, updatedAt: Date.now() });
  },
});

// ── Company steps ───────────────────────────────────────────────────────────
// Each one validates with the shared rules (src/shared/validation.ts): a wrong VAT check digit, a postal code of another
// country, a phone with letters or a script in a name is refused here whatever the browser sent.

async function ownerTenant(ctx: Parameters<typeof tenantOf>[0] & { db: { patch: unknown } }, tenantId: Id<"tenants">) {
  const { tenant } = await requirePermission(ctx as never, tenantId, "tenant.settings");
  return tenant;
}

export const saveCompany = mutation({
  args: { tenantId: v.id("tenants"), name: v.string(), country: v.string(), vatId: v.string() },
  handler: async (ctx, args) => {
    await ownerTenant(ctx, args.tenantId);
    const name = companyName(args.name);
    const country = supportedCountry(args.country);
    const vatId = companyVat(country, args.vatId);
    await ctx.db.patch(args.tenantId, { name, country, vatId, updatedAt: Date.now() });
    return { name, country, vatId: vatId ?? "" };
  },
});

export const saveAddress = mutation({
  args: { tenantId: v.id("tenants"), street: v.string(), postalCode: v.string(), city: v.string() },
  handler: async (ctx, args) => {
    const tenant = await ownerTenant(ctx, args.tenantId);
    const country = supportedCountry(tenant.country ?? "");
    const a = companyAddress(country, args);
    await ctx.db.patch(args.tenantId, { addressStreet: a.street, addressPostalCode: a.postalCode, addressCity: a.city, address: a.line, updatedAt: Date.now() });
    return { street: a.street, postalCode: a.postalCode, city: a.city };
  },
});

export const saveContact = mutation({
  args: { tenantId: v.id("tenants"), phone: v.string(), email: v.string(), website: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tenant = await ownerTenant(ctx, args.tenantId);
    const country = supportedCountry(tenant.country ?? "");
    const c = companyContact(country, args);
    await ctx.db.patch(args.tenantId, { phone: c.phone, companyEmail: c.email, website: c.website, updatedAt: Date.now() });
    return c;
  },
});

/** The VAT rate new quotes start with, and the confirmation that the installer understood VIES and the 0% rules. */
export const saveTax = mutation({
  args: { tenantId: v.id("tenants"), defaultVatPercent: v.number(), viesAcknowledged: v.boolean() },
  handler: async (ctx, args) => {
    const tenant = await ownerTenant(ctx, args.tenantId);
    if (!args.viesAcknowledged) throw new ConvexError("VIES_ACK_REQUIRED");
    const allowed = regionForCountry(tenant.country).vatRates.map((r) => r.percent).filter((p) => p > 0);
    if (!allowed.includes(args.defaultVatPercent)) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.tenantId, { defaultVatPercent: args.defaultVatPercent, viesAckAt: tenant.viesAckAt ?? Date.now(), updatedAt: Date.now() });
    return { defaultVatPercent: args.defaultVatPercent };
  },
});

/** Italian installers also say where they work (picks the standard price list); everyone sets the margin and who delivers / fits. */
export const savePricing = mutation({
  args: {
    tenantId: v.id("tenants"),
    zone: v.optional(v.union(v.literal("nord"), v.literal("centro"), v.literal("sud"))),
    marginPercent: v.number(),
    deliveryMode: v.union(v.literal("factory"), v.literal("own")),
    ownServicePerM2Cents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tenant = await ownerTenant(ctx, args.tenantId);
    const m = args.marginPercent;
    if (!Number.isFinite(m) || m < 0 || m > MAX_MARGIN_PERCENT || Math.abs(Math.round(m * 100) - m * 100) > 1e-6) throw new ConvexError("INVALID_INPUT");
    const italy = regionForCountry(tenant.country).code === "IT";
    if (italy && !args.zone && !tenant.priceZone) throw new ConvexError("PRICE_ZONE_REQUIRED");
    const rate = args.ownServicePerM2Cents ?? 0;
    if (!Number.isInteger(rate) || rate < 0 || rate > MAX_OWN_SERVICE_PER_M2_CENTS) throw new ConvexError("INVALID_INPUT");
    if (args.deliveryMode === "own" && rate <= 0) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.tenantId, {
      ...(args.zone ? { priceZone: args.zone } : {}),
      defaultMarginPercent: Math.round(m * 100) / 100,
      defaultDeliveryMode: args.deliveryMode,
      defaultOwnServicePerM2Cents: rate > 0 ? rate : undefined,
      pricingSavedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { marginPercent: Math.round(m * 100) / 100 };
  },
});

/**
 * Self-serve plan pick while Stripe is dormant — sets planStatus:"trialing"
 * with no stripeSubscriptionId, same shape registerTenant used to set by
 * default for every signup. Once STRIPE_SECRET_KEY is set, enforceActivePlan's
 * existing check requires a real subscription for "trialing" to count, so
 * this stays a real gate rather than a permanent free ride — it only opens
 * the door while there is no billing to actually charge against.
 */
export const selectPlan = mutation({
  args: {
    plan: v.union(
      v.literal("essentials"), v.literal("essentials_plus"), v.literal("max"),
      v.literal("base"), v.literal("pro"), v.literal("agency"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) throw new ConvexError("NO_TENANT");
    // Fails closed: without the explicit dev opt-in every plan goes through Stripe checkout.
    if (!freeOnboardingAllowed()) {
      throw new ConvexError("BILLING_LIVE_USE_CHECKOUT");
    }
    // Same seat guard as billing: never move into a plan the team doesn't fit.
    if (isWidgetPlan(args.plan)) {
      const active = await ctx.db
        .query("memberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", found.tenant._id))
        .filter((q) => q.eq(q.field("status"), "active"))
        .take(100);
      if (active.length > entitlementsFor(args.plan).maxTeamMembers) throw new ConvexError("TEAM_EXCEEDS_TARGET_PLAN");
    }
    // Only Pro carries a trial (entitlements.ts trialEligible) — matches the
    // same invariant billing.ts's subscriptionPatch enforces once Stripe is
    // live: "trialing" only ever applies to plan "pro".
    await ctx.db.patch(found.tenant._id, {
      plan: args.plan,
      planStatus: args.plan === "pro" ? "trialing" : "active",
      onboardingStep: "team",
      updatedAt: Date.now(),
    });
    await unlockOnPlanChange(ctx, found.tenant._id, found.tenant.plan, args.plan);
    await unlockOnReactivation(ctx, found.tenant._id, found.tenant.planStatus, args.plan === "pro" ? "trialing" : "active");
    await ctx.db.insert("auditLog", {
      tenantId: found.tenant._id,
      actorUserId: userId,
      actorKind: "user",
      action: "onboarding.selectPlan",
      targetTable: "tenants",
      targetId: found.tenant._id,
      meta: { plan: args.plan },
      createdAt: Date.now(),
    });
  },
});

/** What the wizard still lacks before it may be completed (empty when the installer filled in every step correctly). */
export function missingOnboardingData(tenant: Doc<"tenants">): Array<"company" | "address" | "contact" | "tax" | "pricing"> {
  const missing: Array<"company" | "address" | "contact" | "tax" | "pricing"> = [];
  const country = (tenant.country ?? "").toUpperCase();
  const vatOk = isCountryCode(country) && checkVatId(country, tenant.vatId ?? "").ok && (tenant.vatId !== undefined || country === "VA");
  if (!isCountryCode(country) || !vatOk || tenant.name.trim().length < 2) missing.push("company");
  if (!tenant.addressStreet || !tenant.addressPostalCode || !tenant.addressCity) missing.push("address");
  if (!tenant.phone || !tenant.companyEmail) missing.push("contact");
  if (tenant.viesAckAt === undefined || tenant.defaultVatPercent === undefined) missing.push("tax");
  if (tenant.pricingSavedAt === undefined || (regionForCountry(tenant.country).code === "IT" && !tenant.priceZone)) missing.push("pricing");
  return missing;
}

/** Sections an installer who ALREADY finished onboarding may still owe (the price list defaults are not asked of them). */
export const REQUIRED_PROFILE_SECTIONS = ["company", "address", "contact", "tax"] as const;

/**
 * Accounts created before the 10-step onboarding have no registered address, contacts or VAT settings. This tells the app what to
 * ask them for; it never blocks anything. Null while the wizard itself is still running (it asks for everything anyway).
 */
export const profileGaps = query({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found || !found.tenant.onboardingCompletedAt || found.tenant.planStatus === "pending_plan") return null;
    const missing = missingOnboardingData(found.tenant).filter((m): m is (typeof REQUIRED_PROFILE_SECTIONS)[number] => m !== "pricing");
    return { missing, canEdit: found.role === "owner" || found.role === "admin" };
  },
});

export const complete = mutation({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) throw new ConvexError("NO_TENANT");
    if (found.tenant.onboardingCompletedAt) return;
    // Server-side guarantee, not just a client-side step order: nothing lets
    // a tenant into the rest of the platform while it still has no plan.
    if (found.tenant.planStatus === "pending_plan") {
      throw new ConvexError("PLAN_SELECTION_REQUIRED");
    }
    if (missingOnboardingData(found.tenant).length > 0) throw new ConvexError("ONBOARDING_INCOMPLETE");
    await ctx.db.patch(found.tenant._id, {
      onboardingCompletedAt: Date.now(),
      onboardingStep: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      tenantId: found.tenant._id,
      actorUserId: userId,
      actorKind: "user",
      action: "onboarding.complete",
      targetTable: "tenants",
      targetId: found.tenant._id,
      createdAt: Date.now(),
    });
  },
});
