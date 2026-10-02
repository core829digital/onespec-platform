import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserId, requirePlatformAdmin, requireTenantRole } from "./lib/auth";
import { regionForCountry } from "./lib/regions";
import { generateReferralCode, maskCompanyName, normalizeReferralCode, referralPairProblem } from "./lib/referral";
import {
  DAY_MS,
  INVITEE_DISCOUNT_PERCENT,
  MAX_REWARDS_PER_12_MONTHS,
  REFERRAL_HOLD_DAYS,
  REFERRER_CREDIT_PERCENT,
  isBillable,
  referrerCreditCents,
} from "./lib/referralRewards";
import { BILLING_PLANS, SELF_SERVE_PLANS } from "./lib/billingPlans";

/**
 * Referral system, phase R1 (docs/PIANO_REFERRAL.md): personal codes and attaching a
 * code to a new account at registration, with the anti-fraud rules that can be decided
 * at that moment. Rewards, discounts and qualification come in later phases.
 *
 * Off by default: nothing here has any effect until the Convex env var
 * REFERRALS_ENABLED is set to "1" (it is also the emergency switch).
 */

export function referralsEnabled(): boolean {
  return process.env.REFERRALS_ENABLED === "1";
}

/** Only paying, regular accounts can invite (founding/full-access accounts cannot). */
export function canInvite(tenant: Doc<"tenants">): boolean {
  return tenant.planStatus === "active" && tenant.unlimitedAccess !== true;
}

const MAX_CODE_ATTEMPTS = 8;

/** The tenant's code, creating it on first use. Idempotent. */
async function ensureCode(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<string> {
  const existing = await ctx.db.query("referralCodes").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).first();
  if (existing) return existing.code;
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateReferralCode();
    const taken = await ctx.db.query("referralCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (taken) continue;
    await ctx.db.insert("referralCodes", { tenantId, code, createdAt: Date.now() });
    return code;
  }
  throw new ConvexError("REFERRAL_CODE_UNAVAILABLE");
}

/** Owners and admins manage the account's code (same people who see billing). */
const MANAGERS = ["owner", "admin"];

export const ensureMyReferralCode = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ code: string }> => {
    await requireTenantRole(ctx, args.tenantId, MANAGERS);
    if (!referralsEnabled()) throw new ConvexError("REFERRALS_DISABLED");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    if (!canInvite(tenant)) throw new ConvexError("REFERRAL_NOT_ELIGIBLE");
    return { code: await ensureCode(ctx, args.tenantId) };
  },
});

/** Public base of the shareable link; the marketing site forwards `?ref=` to the platform. */
const SHARE_BASE = "https://onespec.eu";

/**
 * Whether the account should see the "Invite and save" section at all. Never throws (it
 * feeds the sidebar for every member): anything unexpected simply means "no".
 */
export const referralNavVisible = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx: QueryCtx, args): Promise<boolean> => {
    if (!referralsEnabled()) return false;
    const userId = await getUserId(ctx);
    if (!userId) return false;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_user", (q) => q.eq("tenantId", args.tenantId).eq("userId", userId))
      .first();
    if (!membership || membership.status !== "active" || !MANAGERS.includes(membership.role)) return false;
    const tenant = await ctx.db.get(args.tenantId);
    return !!tenant && canInvite(tenant);
  },
});

type HistoryStatus = "registered" | "waiting" | "rewarded" | "expired" | "cancelled";
const HISTORY_STATUS: Partial<Record<Doc<"referrals">["status"], HistoryStatus>> = {
  pending: "registered",
  qualified: "waiting",
  rewarded: "rewarded",
  expired: "expired",
  clawback: "cancelled",
};

export const getMyReferral = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, MANAGERS);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const enabled = referralsEnabled();
    const codeRow = await ctx.db.query("referralCodes").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    const rows = await ctx.db.query("referrals").withIndex("by_referrer", (q) => q.eq("referrerTenantId", args.tenantId)).order("desc").take(200);

    // Attempts refused by the anti-fraud rules are not shown to the inviter.
    const visible = rows.filter((r) => HISTORY_STATUS[r.status]);
    const now = Date.now();
    const yearAgo = now - 365 * DAY_MS;
    const history = await Promise.all(
      visible.slice(0, 30).map(async (r) => ({
        id: r._id,
        status: HISTORY_STATUS[r.status] as HistoryStatus,
        company: maskCompanyName((await ctx.db.get(r.referredTenantId))?.name),
        createdAt: r.createdAt,
        holdUntil: r.status === "qualified" ? (r.holdUntil ?? null) : null,
        rewardCents: r.status === "rewarded" || r.status === "qualified" ? (r.rewardCents ?? null) : null,
      })),
    );
    const sum = (status: Doc<"referrals">["status"]) => rows.filter((r) => r.status === status).reduce((n, r) => n + (r.rewardCents ?? 0), 0);
    return {
      enabled,
      eligible: canInvite(tenant),
      code: codeRow && !codeRow.disabledAt ? codeRow.code : null,
      shareBase: SHARE_BASE,
      counts: {
        invited: visible.length,
        registered: rows.filter((r) => r.status === "pending").length,
        waiting: rows.filter((r) => r.status === "qualified").length,
        rewarded: rows.filter((r) => r.status === "rewarded").length,
      },
      earnedCents: sum("rewarded"),
      pendingCents: sum("qualified"),
      rewardsLeftThisYear: Math.max(0, MAX_REWARDS_PER_12_MONTHS - rows.filter((r) => r.status === "rewarded" && (r.rewardedAt ?? 0) >= yearAgo).length),
      rules: { holdDays: REFERRAL_HOLD_DAYS, maxPerYear: MAX_REWARDS_PER_12_MONTHS },
      rewards: {
        referrerPercent: REFERRER_CREDIT_PERCENT,
        inviteePercent: INVITEE_DISCOUNT_PERCENT,
        plans: SELF_SERVE_PLANS.map((plan) => ({
          plan,
          name: BILLING_PLANS.find((b) => b.key === plan)?.name ?? plan,
          monthlyCreditCents: referrerCreditCents(plan, "monthly") ?? 0,
          annualCreditCents: referrerCreditCents(plan, "annual") ?? 0,
        })),
      },
      history,
    };
  },
});

/**
 * The discount an invited account gets at checkout, or null. Only while its referral is
 * still `pending` (it has not paid anything yet), only on plans with a defined reward.
 */
export const checkoutDiscount = internalQuery({
  args: { tenantId: v.id("tenants"), plan: v.string() },
  handler: async (ctx, args): Promise<{ percentOff: number } | null> => {
    if (!referralsEnabled()) return null;
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant?.referredBy) return null;
    const referral = await ctx.db.get(tenant.referredBy);
    if (!referral || referral.status !== "pending") return null;
    return isBillable(args.plan) ? { percentOff: INVITEE_DISCOUNT_PERCENT } : null;
  },
});

/**
 * Sends a referral email to the owner of `tenantId` in their language. Never throws: an
 * email problem must not undo a referral step.
 */
export async function notifyOwner(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  template: "referral_invited" | "referral_registered" | "referral_rewarded",
  data: { amountCents?: number; percent?: number; payout?: "credit" | "stripe" },
): Promise<void> {
  try {
    const tenant = await ctx.db.get(tenantId);
    const owner = tenant ? await ctx.db.get(tenant.ownerUserId) : null;
    if (!tenant || !owner?.email) return;
    const locale = owner.locale ?? regionForCountry(tenant.country).primaryLocale;
    const amount =
      typeof data.amountCents === "number"
        ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(data.amountCents / 100)
        : undefined;
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template,
      to: owner.email,
      locale,
      data: { amount, percent: data.percent, payout: data.payout },
      tenantId,
    });
  } catch {
    /* best effort */
  }
}

export type AttachResult =
  | { status: "attached"; referralId: Id<"referrals"> }
  | { status: "rejected"; reason: string }
  | { status: "ignored" };

/**
 * Links a brand-new account to the account that owns `rawCode`. Never throws for a bad
 * code: a typo or an old link must not get in the way of signing up. Unknown codes leave
 * no trace; a real code refused by a rule is recorded as `rejected` for admin review.
 */
export async function attachReferral(
  ctx: MutationCtx,
  args: { referredTenantId: Id<"tenants">; referredUserId: Id<"users">; rawCode: string | null | undefined },
): Promise<AttachResult> {
  if (!referralsEnabled()) return { status: "ignored" };
  const code = normalizeReferralCode(args.rawCode);
  if (!code) return { status: "ignored" };

  const already = await ctx.db.query("referrals").withIndex("by_referred", (q) => q.eq("referredTenantId", args.referredTenantId)).first();
  if (already) return { status: "ignored" };

  const codeRow = await ctx.db.query("referralCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
  if (!codeRow || codeRow.disabledAt) return { status: "ignored" };
  const referrer = await ctx.db.get(codeRow.tenantId);
  if (!referrer) return { status: "ignored" };

  const reject = async (reason: string): Promise<AttachResult> => {
    await ctx.db.insert("referrals", {
      referrerTenantId: referrer._id,
      referredTenantId: args.referredTenantId,
      code,
      status: "rejected",
      rejectionReason: reason,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      tenantId: args.referredTenantId,
      actorKind: "system",
      action: "referral.rejected",
      targetTable: "referralCodes",
      targetId: String(codeRow._id),
      meta: { reason },
      createdAt: Date.now(),
    });
    return { status: "rejected", reason };
  };

  if (referrer._id === args.referredTenantId || referrer.ownerUserId === args.referredUserId) return reject("SELF_REFERRAL");
  if (!canInvite(referrer)) return reject("REFERRER_NOT_ELIGIBLE");

  const [referrerOwner, referredUser] = await Promise.all([ctx.db.get(referrer.ownerUserId), ctx.db.get(args.referredUserId)]);
  const problem = referralPairProblem(referrerOwner?.email, referredUser?.email);
  if (problem) return reject(problem);

  const referralId = await ctx.db.insert("referrals", {
    referrerTenantId: referrer._id,
    referredTenantId: args.referredTenantId,
    code,
    status: "pending",
    createdAt: Date.now(),
  });
  await ctx.db.patch(args.referredTenantId, { referredBy: referralId });
  await ctx.db.insert("auditLog", {
    tenantId: args.referredTenantId,
    actorKind: "system",
    action: "referral.attached",
    targetTable: "referrals",
    targetId: String(referralId),
    meta: { referrerTenantId: referrer._id },
    createdAt: Date.now(),
  });
  await notifyOwner(ctx, args.referredTenantId, "referral_invited", { percent: INVITEE_DISCOUNT_PERCENT });
  await notifyOwner(ctx, referrer._id, "referral_registered", {});
  return { status: "attached", referralId };
}

/* --------------------------- platform admin review --------------------------- */

const STATUS = v.union(
  v.literal("pending"), v.literal("qualified"), v.literal("rewarded"),
  v.literal("rejected"), v.literal("expired"), v.literal("clawback"),
);

/** Referrals with both accounts' names and the reason a rule refused them, newest first. */
export const adminListReferrals = query({
  args: { status: v.optional(STATUS) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const rows = args.status
      ? await ctx.db.query("referrals").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").take(200)
      : await ctx.db.query("referrals").order("desc").take(200);
    const who = async (tenantId: Id<"tenants">) => {
      const t = await ctx.db.get(tenantId);
      const owner = t ? await ctx.db.get(t.ownerUserId) : null;
      return { tenantId, name: t?.name ?? "—", email: owner?.email ?? "—", plan: t?.plan ?? "—", planStatus: t?.planStatus ?? "—" };
    };
    return await Promise.all(
      rows.map(async (r) => ({
        id: r._id,
        status: r.status,
        reason: r.rejectionReason ?? null,
        code: r.code,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt ?? null,
        holdUntil: r.holdUntil ?? null,
        rewardCents: r.rewardCents ?? null,
        rewardedAt: r.rewardedAt ?? null,
        payoutMethod: r.payoutMethod ?? null,
        clawbackNote: r.clawbackNote ?? null,
        referrer: await who(r.referrerTenantId),
        referred: await who(r.referredTenantId),
      })),
    );
  },
});

async function adminAudit(ctx: MutationCtx, adminId: Id<"users">, action: string, referral: Doc<"referrals">, meta?: Record<string, unknown>) {
  await ctx.db.insert("auditLog", {
    tenantId: referral.referredTenantId,
    actorUserId: adminId,
    actorKind: "admin",
    action,
    targetTable: "referrals",
    targetId: String(referral._id),
    meta,
    createdAt: Date.now(),
  });
}

/** Cancels a pending or qualified referral (nothing is paid for it). */
export const adminReject = mutation({
  args: { referralId: v.id("referrals"), reason: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const adminId = await requirePlatformAdmin(ctx);
    const r = await ctx.db.get(args.referralId);
    if (!r) throw new ConvexError("NOT_FOUND");
    if (r.status !== "pending" && r.status !== "qualified") throw new ConvexError("INVALID_STATE");
    const reason = (args.reason ?? "ADMIN").trim().slice(0, 80) || "ADMIN";
    await ctx.db.patch(r._id, { status: "rejected", rejectionReason: reason });
    await adminAudit(ctx, adminId, "referral.admin_rejected", r, { reason });
  },
});

/**
 * Gives a refused or expired referral another chance (the rules were too strict for a real
 * customer). It goes back to `pending`, so it qualifies and is paid like any other.
 */
export const adminReopen = mutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args): Promise<void> => {
    const adminId = await requirePlatformAdmin(ctx);
    const r = await ctx.db.get(args.referralId);
    if (!r) throw new ConvexError("NOT_FOUND");
    if (r.status !== "rejected" && r.status !== "expired") throw new ConvexError("INVALID_STATE");
    await ctx.db.patch(r._id, { status: "pending", rejectionReason: undefined });
    await ctx.db.patch(r.referredTenantId, { referredBy: r._id });
    await adminAudit(ctx, adminId, "referral.admin_reopened", r, { previous: r.status, reason: r.rejectionReason ?? null });
  },
});

/** Switches an account's code off (abuse) or back on. Existing referrals are untouched. */
export const adminSetCodeDisabled = mutation({
  args: { tenantId: v.id("tenants"), disabled: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const adminId = await requirePlatformAdmin(ctx);
    const row = await ctx.db.query("referralCodes").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    if (!row) throw new ConvexError("NOT_FOUND");
    await ctx.db.patch(row._id, { disabledAt: args.disabled ? Date.now() : undefined });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: adminId,
      actorKind: "admin",
      action: args.disabled ? "referral.code_disabled" : "referral.code_enabled",
      targetTable: "referralCodes",
      targetId: String(row._id),
      createdAt: Date.now(),
    });
  },
});
