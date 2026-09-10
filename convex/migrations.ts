import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-shot data migrations for the plan-ladder rename (business → pro).
 *
 * Run AFTER deploy #1 (transitional schema union) and BEFORE deploy #2
 * (which drops the "business" literal):
 *
 *   npx convex run migrations:renameBusinessToPro
 *   npx convex run migrations:backfillTrialEndsAt
 *
 * Both are idempotent — safe to re-run.
 */

export const renameBusinessToPro = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let migrated = 0;
    for (const t of page.page) {
      if ((t.plan as string) !== "business") continue;
      await ctx.db.patch(t._id, { plan: "pro", updatedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "plan.migrate",
        targetTable: "tenants",
        targetId: t._id,
        meta: { from: "business", to: "pro" },
        createdAt: Date.now(),
      });
      migrated++;
    }
    return {
      migrated,
      done: page.isDone,
      cursor: page.continueCursor,
    };
  },
});

export const backfillTrialEndsAt = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .withIndex("by_planStatus", (q) => q.eq("planStatus", "trialing"))
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let backfilled = 0;
    for (const t of page.page) {
      // Stripe-managed trials refill trialEndsAt via webhook; only patch
      // pre-Stripe rows that have no subscription and no trial end.
      if (t.stripeSubscriptionId || t.trialEndsAt) continue;
      await ctx.db.patch(t._id, {
        trialPlan: "pro",
        trialEndsAt: (t.createdAt ?? Date.now()) + 14 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "trial.expired",
        targetTable: "tenants",
        targetId: t._id,
        meta: { reason: "backfill" },
        createdAt: Date.now(),
      });
      backfilled++;
    }
    return { backfilled, done: page.isDone, cursor: page.continueCursor };
  },
});
