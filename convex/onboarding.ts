import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUser, type ReadCtx } from "./lib/auth";
import { entitlementsFor, isWidgetPlan, resolveTenantEntitlements } from "./lib/entitlements";
import { regionForCountry } from "./lib/regions";
import { freeOnboardingAllowed } from "./lib/enforcement";
import { unlockOnPlanChange, unlockOnReactivation } from "./usage";

/** Ordered wizard steps. `planQuiz`/`billing` are skipped once a plan is active. */
export const ONBOARDING_STEPS = ["welcome", "planQuiz", "billing", "team", "zone", "configurator"] as const;
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
      step: (tenant.onboardingStep as Step | undefined) ?? "welcome",
      needsPlan,
      stripeConfigured,
      role,
      plan: tenant.plan,
      region: regionForCountry(tenant.country).code,
      priceZone: tenant.priceZone ?? null,
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
