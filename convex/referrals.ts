import { mutation, query, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireTenantRole } from "./lib/auth";
import { generateReferralCode, normalizeReferralCode, referralPairProblem } from "./lib/referral";

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

export const getMyReferral = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, MANAGERS);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const enabled = referralsEnabled();
    const codeRow = await ctx.db.query("referralCodes").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    const count = async (status: Doc<"referrals">["status"]) =>
      (
        await ctx.db
          .query("referrals")
          .withIndex("by_referrer_and_status", (q) => q.eq("referrerTenantId", args.tenantId).eq("status", status))
          .take(500)
      ).length;
    return {
      enabled,
      eligible: canInvite(tenant),
      code: codeRow && !codeRow.disabledAt ? codeRow.code : null,
      counts: { pending: await count("pending"), qualified: await count("qualified"), rewarded: await count("rewarded") },
    };
  },
});

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
  return { status: "attached", referralId };
}
