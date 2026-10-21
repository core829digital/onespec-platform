import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireTenantRole } from "./lib/auth";
import { referralsEnabled } from "./referrals";
import { appOrigin } from "./billing";
import { stripeConfigured, stripeErrorMessage, stripeRest } from "./lib/stripeRest";

/**
 * Getting rewards as MONEY instead of subscription credit (docs/PIANO_REFERRAL.md): the
 * inviter connects their own Stripe Express account (Stripe Connect) and the reward is
 * transferred there once it matures. Only the account OWNER chooses the method and
 * connects the account; owners and admins can see the status.
 *
 * Requires Stripe Connect to be enabled on OneSpec's Stripe account.
 */

const METHOD = v.union(v.literal("credit"), v.literal("stripe"));
const VIEWERS = ["owner", "admin"];
const OWNER_ONLY = ["owner"];

export const getPayoutSettings = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { membership } = await requireTenantRole(ctx, args.tenantId, VIEWERS);
    const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    return {
      canEdit: membership.role === "owner",
      method: row?.method ?? ("credit" as const),
      hasAccount: !!row?.stripeAccountId,
      ready: row?.transfersActive === true,
      checkedAt: row?.checkedAt ?? null,
    };
  },
});

export const setPayoutMethod = mutation({
  args: { tenantId: v.id("tenants"), method: METHOD },
  handler: async (ctx, args): Promise<void> => {
    await requireTenantRole(ctx, args.tenantId, OWNER_ONLY);
    if (!referralsEnabled()) throw new ConvexError("REFERRALS_DISABLED");
    const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    if (row) await ctx.db.patch(row._id, { method: args.method });
    else await ctx.db.insert("referralPayoutAccounts", { tenantId: args.tenantId, method: args.method, createdAt: Date.now() });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorKind: "user",
      action: "referral.payout_method_set",
      targetTable: "referralPayoutAccounts",
      meta: { method: args.method },
      createdAt: Date.now(),
    });
  },
});

/** Owner-only context for the Stripe calls below. */
export const ownerContext = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenantRole(ctx, args.tenantId, OWNER_ONLY);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const user = await ctx.db.get(userId);
    const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    return { email: user?.email ?? null, name: tenant.name, country: tenant.country ?? null, accountId: row?.stripeAccountId ?? null };
  },
});

export const saveAccountId = internalMutation({
  args: { tenantId: v.id("tenants"), accountId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    if (row) {
      // Never replace an existing account (a retry or a race must not orphan the first one).
      if (!row.stripeAccountId) await ctx.db.patch(row._id, { stripeAccountId: args.accountId, transfersActive: false, checkedAt: Date.now() });
    } else {
      await ctx.db.insert("referralPayoutAccounts", { tenantId: args.tenantId, method: "stripe", stripeAccountId: args.accountId, transfersActive: false, checkedAt: Date.now(), createdAt: Date.now() });
    }
  },
});

export const saveAccountStatus = internalMutation({
  args: { tenantId: v.id("tenants"), transfersActive: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).first();
    if (row) await ctx.db.patch(row._id, { transfersActive: args.transfersActive, checkedAt: Date.now() });
  },
});

async function limit(ctx: { runMutation: (fn: typeof internal.lib.ratelimit.checkBucket, a: { bucketKey: string; tokens: number; refillMs: number }) => Promise<unknown> }, tenantId: Id<"tenants">) {
  try {
    await ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey: `referral-payout:${tenantId}`, tokens: 10, refillMs: 10 * 60 * 1000 });
  } catch {
    throw new ConvexError("RATE_LIMITED");
  }
}

/** Creates the Express account on first use and returns Stripe's hosted onboarding link. */
export const startPayoutOnboarding = action({
  args: { tenantId: v.id("tenants"), origin: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeConfigured()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    if (!referralsEnabled()) throw new ConvexError("REFERRALS_DISABLED");
    const owner = await ctx.runQuery(internal.referralPayoutAccount.ownerContext, { tenantId: args.tenantId });
    await limit(ctx, args.tenantId);

    let accountId = owner.accountId;
    if (!accountId) {
      const made = await stripeRest(
        "POST",
        "/accounts",
        {
          type: "express",
          email: owner.email ?? undefined,
          country: owner.country && /^[A-Za-z]{2}$/.test(owner.country) ? owner.country.toUpperCase() : undefined,
          "capabilities[transfers][requested]": "true",
          "business_profile[name]": owner.name.slice(0, 100),
          "metadata[tenantId]": String(args.tenantId),
        },
        `referral-account-${args.tenantId}`,
      );
      if (!made.ok) throw new ConvexError(`STRIPE: ${stripeErrorMessage(made)}`);
      accountId = String(made.json.id);
      await ctx.runMutation(internal.referralPayoutAccount.saveAccountId, { tenantId: args.tenantId, accountId });
    }

    const base = appOrigin(args.origin);
    const link = await stripeRest("POST", "/account_links", {
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/app/account/referral?payout=refresh`,
      return_url: `${base}/app/account/referral?payout=return`,
    });
    if (!link.ok) throw new ConvexError(`STRIPE: ${stripeErrorMessage(link)}`);
    return { url: String(link.json.url) };
  },
});

/** Re-reads the account from Stripe: is it able to receive transfers yet? */
export const refreshPayoutStatus = action({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ ready: boolean; hasAccount: boolean }> => {
    if (!stripeConfigured()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.referralPayoutAccount.ownerContext, { tenantId: args.tenantId });
    if (!owner.accountId) return { ready: false, hasAccount: false };
    await limit(ctx, args.tenantId);
    const acct = await stripeRest("GET", `/accounts/${encodeURIComponent(owner.accountId)}`);
    if (!acct.ok) throw new ConvexError(`STRIPE: ${stripeErrorMessage(acct)}`);
    const ready = (acct.json.capabilities as { transfers?: string } | undefined)?.transfers === "active";
    await ctx.runMutation(internal.referralPayoutAccount.saveAccountStatus, { tenantId: args.tenantId, transfersActive: ready });
    return { ready, hasAccount: true };
  },
});
