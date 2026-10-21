import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  requireVerifiedUser,
  requirePlatformAdmin,
  requireMembership,
} from "./lib/auth";
import { nanoid } from "./lib/ids";
import { isFullAccessEmail } from "./lib/founding";
import { requirePermission } from "./lib/rbac";
import { emit } from "./lib/triggers";
import { unlockOnReactivation } from "./usage";
import { regionForCountry } from "./lib/regions";
import { companyName, companyVat } from "./lib/companyProfile";
import { must } from "./lib/validate";
import { DPA_VERSION } from "../src/shared/dpa";
import { checkEmail, checkPhone, checkText, checkWebsite, isCountryCode } from "../src/shared/validation";
import { attachReferral } from "./referrals";
import { assertShortText } from "./lib/inputs";
import { consumeUploadSlot, scheduleSniff } from "./lib/uploads";

const COUNTRY_RE = /^[A-Za-z]{2}$/;
const ADDRESS_LINE = /^[\p{L}\p{N} .,'’\-/()°#]+$/u;

/** Company names: trimmed, 2–120 chars (they end up in slugs, e-mails and PDFs). */
function cleanCompanyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new ConvexError("INVALID_NAME");
  return name;
}

/** What the person typed on the register page (company data + agreement), if anything — lets the onboarding step fill itself in. */
export const getSignupIntake = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const user = await ctx.db.get(userId);
    const i = user?.signupIntake;
    if (!i) return null;
    return { companyName: i.companyName, country: i.country, hasDpa: !!i.dpaAcceptedAt };
  },
});

export const registerTenant = mutation({
  args: { companyName: v.string(), country: v.optional(v.string()), referralCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (existing) throw new ConvexError("ALREADY_HAS_TENANT");
    // Data given at registration was validated by the auth front door and wins over whatever the browser sends now.
    const intake = (await ctx.db.get(userId))?.signupIntake;
    const companyName = intake ? intake.companyName : cleanCompanyName(args.companyName);

    const rawCountry = intake ? intake.country : args.country;
    const country = rawCountry && COUNTRY_RE.test(rawCountry) ? rawCountry.toUpperCase() : undefined;
    if (country) await ctx.db.patch(userId, { country });

    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");
    if (!settings.registrationOpen) throw new ConvexError("REGISTRATION_CLOSED");

    // Founding / full-access accounts have billing "activated" from day one: they never meet the plan quiz or checkout
    // (the data steps of the onboarding still run).
    const fullAccess = isFullAccessEmail((await ctx.db.get(userId))?.email);
    const tenantId = await ctx.db.insert("tenants", {
      name: companyName,
      slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + nanoid(6),
      ownerUserId: userId,
      country,
      plan: fullAccess ? "enterprise" : "base",
      planStatus: fullAccess ? "active" : "pending_plan",
      createdVia: "open_signup",
      createdAt: Date.now(),
      ...(intake?.vatId ? { vatId: intake.vatId } : {}),
      ...(intake?.street && intake.postalCode && intake.city
        ? { addressStreet: intake.street, addressPostalCode: intake.postalCode, addressCity: intake.city, address: `${intake.street}, ${intake.postalCode} ${intake.city}` }
        : {}),
      // Founding accounts skip every plan limit from day one.
      unlimitedAccess: fullAccess ? true : undefined,
    });

    await ctx.db.insert("memberships", {
      tenantId,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: Date.now(),
    });

    // The agreement accepted on the register page becomes the tenant's acceptance, with the moment and version the person
    // actually saw — only when the identity data it needs is there (the form already refuses the box otherwise).
    if (intake?.dpaAcceptedAt && intake.dpaVersion === DPA_VERSION && intake.vatId && intake.street) {
      const owner0 = await ctx.db.get(userId);
      const controller = { name: companyName, vatId: intake.vatId, address: `${intake.street}, ${intake.postalCode} ${intake.city}`, email: owner0?.email ?? undefined };
      const acceptanceId = await ctx.db.insert("dpaAcceptances", {
        tenantId,
        version: DPA_VERSION,
        acceptedByUserId: userId,
        signerName: intake.dpaSignerName ?? owner0?.name ?? "—",
        signerRole: "Legal representative (declared at registration)",
        signerEmail: owner0?.email ?? undefined,
        controller,
        acceptedAt: intake.dpaAcceptedAt,
      });
      await ctx.db.insert("auditLog", {
        tenantId,
        actorUserId: userId,
        actorKind: "user",
        action: "dpa.accept",
        targetTable: "dpaAcceptances",
        targetId: acceptanceId,
        meta: { version: DPA_VERSION, via: "signup" },
        createdAt: Date.now(),
      });
    }
    // Used once; the personal copy is not kept.
    if (intake) await ctx.db.patch(userId, { signupIntake: undefined });

    // Referral link (no-op unless REFERRALS_ENABLED). A bad code or any failure here must
    // never get in the way of creating the account.
    if (args.referralCode) {
      try {
        await attachReferral(ctx, { referredTenantId: tenantId, referredUserId: userId, rawCode: args.referralCode });
      } catch {
        /* signup wins over referral */
      }
    }

    const owner = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template: "welcome",
      to: owner?.email || "",
      // The language the owner signed up in; else the chosen market's language.
      locale: owner?.locale ?? regionForCountry(country).primaryLocale,
      data: { companyName },
      tenantId,
    });

    return { tenantId };
  },
});

export const getMyTenant = query({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const membership = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (!membership) return null;
    return await ctx.db.get(membership.tenantId);
  },
});

/** The caller's own membership (access tier + grade), for the menu: it shows only the areas this member works in. */
export const getMyMembership = query({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const m = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (!m || m.status !== "active") return null;
    return { tenantId: m.tenantId, userId, role: m.role, grade: m.grade ?? null };
  },
});

export const getTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    return await ctx.db.get(args.tenantId);
  },
});

export const listMembers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          userName: user?.name ?? null,
          userEmail: user?.email ?? null,
        };
      }),
    );
  },
});

const COMPANY_TEXT_MAX = 200;
/** Trim; empty string clears the field. */
function cleanCompanyText(value: string): string | undefined {
  const t = value.trim();
  if (t.length > COMPANY_TEXT_MAX) throw new ConvexError("INVALID_INPUT");
  return t === "" ? undefined : t;
}

export const updateTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    vatId: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    companyEmail: v.optional(v.string()),
    privacyUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenant } = await requirePermission(ctx, args.tenantId, "tenant.settings");
    const update: Partial<Doc<"tenants">> = { updatedAt: Date.now() };
    if (args.name !== undefined) update.name = companyName(args.name);
    let country = tenant.country;
    if (args.country !== undefined) {
      if (!COUNTRY_RE.test(args.country)) throw new ConvexError("INVALID_INPUT");
      country = args.country.toUpperCase();
      update.country = country;
    }
    // Same rules as the onboarding forms: a wrong VAT check digit, phone or e-mail is refused, not stored.
    if (args.vatId !== undefined) update.vatId = companyVat(country, args.vatId);
    if (args.address !== undefined) update.address = cleanCompanyText(must(checkText(args.address, { max: COMPANY_TEXT_MAX, required: false, allowed: ADDRESS_LINE })) );
    if (args.phone !== undefined) update.phone = args.phone.trim() === "" ? undefined : must(checkPhone(isCountryCode((country ?? "").toUpperCase()) ? (country ?? "").toUpperCase() : "IT", args.phone));
    if (args.companyEmail !== undefined) update.companyEmail = args.companyEmail.trim() === "" ? undefined : must(checkEmail(args.companyEmail));
    if (args.privacyUrl !== undefined) {
      const url = must(checkWebsite(args.privacyUrl));
      update.privacyUrl = url || undefined;
    }
    await ctx.db.patch(args.tenantId, update);
  },
});

// ── Company logo (printed in every PDF header) ──────────────────────────────
// react-pdf can only embed JPEG/PNG, so those are the only accepted types.
const LOGO_TYPES = ["image/png", "image/jpeg"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const generateLogoUploadUrl = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "tenant.settings");
    await consumeUploadSlot(ctx, args.tenantId, userId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setCompanyLogo = mutation({
  args: { tenantId: v.id("tenants"), storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "tenant.settings");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("NOT_FOUND");

    if (args.storageId) {
      const meta = await ctx.db.system.get(args.storageId);
      if (!meta || !meta.contentType || !LOGO_TYPES.includes(meta.contentType)) {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError("UNSUPPORTED_IMAGE_TYPE");
      }
      if (meta.size > LOGO_MAX_BYTES) {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError("IMAGE_TOO_LARGE");
      }
    }
    if (args.storageId) await scheduleSniff(ctx, args.storageId, "logo");
    if (tenant.logoStorageId && tenant.logoStorageId !== args.storageId) {
      await ctx.storage.delete(tenant.logoStorageId).catch(() => undefined); // may already be gone (quarantined)
    }
    await ctx.db.patch(args.tenantId, { logoStorageId: args.storageId ?? undefined, updatedAt: Date.now() });
  },
});

/** Company details + logo URL for the caller's tenant — what PDF headers print. */
export const getCompanyProfile = query({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const membership = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (!membership) return null;
    const tenant = await ctx.db.get(membership.tenantId);
    if (!tenant) return null;
    return {
      tenantId: tenant._id,
      name: tenant.name,
      vatId: tenant.vatId,
      address: tenant.address,
      phone: tenant.phone,
      email: tenant.companyEmail,
      privacyUrl: tenant.privacyUrl,
      logoUrl: tenant.logoStorageId ? await ctx.storage.getUrl(tenant.logoStorageId) : null,
    };
  },
});

// ── Team ────────────────────────────────────────────────────────────────────
// Invitations live in convex/teams.ts (teams, invite link + code + team password) and convex/teamAccess.ts (the door).

export const removeMember = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) return;
    const { userId } = await requirePermission(ctx, membership.tenantId, "team.remove");
    if (membership.role === "owner") throw new ConvexError("CANNOT_REMOVE_OWNER");
    await ctx.db.delete(args.membershipId);
    await ctx.db.insert("auditLog", {
      tenantId: membership.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "team.remove_member",
      targetTable: "memberships",
      targetId: args.membershipId,
      createdAt: Date.now(),
    });
  },
});

export const suspendTenant = mutation({
  args: { tenantId: v.id("tenants"), reason: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    assertShortText(args.reason, 500);
    await ctx.db.patch(args.tenantId, {
      suspendedAt: Date.now(),
      suspendedReason: args.reason,
      planStatus: "suspended",
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "tenant.suspend",
      targetTable: "tenants",
      targetId: args.tenantId,
      meta: { reason: args.reason },
      createdAt: Date.now(),
    });
    await emit(ctx, { type: "tenant.suspended", tenantId: args.tenantId, reason: args.reason });
  },
});

/** Toggle founding/full-access flag — platform admins only. Audit-logged. */
export const setUnlimitedAccess = mutation({
  args: { tenantId: v.id("tenants"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    await ctx.db.patch(args.tenantId, {
      unlimitedAccess: args.enabled ? true : undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: args.enabled ? "tenant.grant_full_access" : "tenant.revoke_full_access",
      targetTable: "tenants",
      targetId: args.tenantId,
      meta: {},
      createdAt: Date.now(),
    });
  },
});
/** Undo suspendTenant — no reactivate path existed before, meaning a
 * platform admin had no way back from a suspend except editing the
 * database directly. */
export const reactivateTenant = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const before = await ctx.db.get(args.tenantId);
    await ctx.db.patch(args.tenantId, {
      suspendedAt: undefined,
      suspendedReason: undefined,
      planStatus: "active",
    });
    if (before) await unlockOnReactivation(ctx, args.tenantId, before.planStatus, "active");
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "tenant.reactivate",
      targetTable: "tenants",
      targetId: args.tenantId,
      meta: {},
      createdAt: Date.now(),
    });
  },
});

