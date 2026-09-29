import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { entitlementsFor, isWidgetPlan } from "./lib/entitlements";

/**
 * "Accetta ma blocca" — lifting the lock. A quota-locked request becomes
 * visible when the tenant upgrades, or once the month it arrived in is over.
 * Unlocking is one-way: a downgrade never re-locks a request.
 */

const BATCH = 200;

/** Start (ms, UTC) of the calendar month `currentPeriod()` reports for `now`. */
export function periodStartMs(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Unlock every locked request of one tenant (after an upgrade). Batched, self-rescheduling. */
export const unlockTenantLockedRequests = internalMutation({
  args: { tenantId: v.id("tenants") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("quoteRequests")
      .withIndex("by_tenantId_and_quotaLocked", (q) => q.eq("tenantId", args.tenantId).eq("quotaLocked", true))
      .take(BATCH);
    for (const row of rows) await ctx.db.patch(row._id, { quotaLocked: undefined });
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.usage.unlockTenantLockedRequests, args);
    }
    if (rows.length > 0) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        actorKind: "system",
        action: "usage.quota_unlock",
        targetTable: "quoteRequests",
        meta: { reason: "upgrade", count: rows.length },
        createdAt: Date.now(),
      });
    }
    return rows.length;
  },
});

/** Daily sweep: unlock requests locked in a month that is now over. Batched, self-rescheduling. */
export const unlockPreviousPeriods = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const start = periodStartMs(Date.now());
    const rows = await ctx.db
      .query("quoteRequests")
      .withIndex("by_quotaLocked", (q) => q.eq("quotaLocked", true).lt("_creationTime", start))
      .take(BATCH);
    for (const row of rows) await ctx.db.patch(row._id, { quotaLocked: undefined });
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.usage.unlockPreviousPeriods, {});
    }
    return rows.length;
  },
});

/**
 * Call wherever `tenants.plan` changes. Moving off a widget-first plan, or to
 * one with a larger monthly allowance, unlocks that tenant's locked requests.
 */
export async function unlockOnPlanChange(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  fromPlan: string,
  toPlan: string,
): Promise<void> {
  if (fromPlan === toPlan || !isWidgetPlan(fromPlan)) return;
  const upgraded =
    !isWidgetPlan(toPlan) || entitlementsFor(toPlan).maxQuotesPerMonth > entitlementsFor(fromPlan).maxQuotesPerMonth;
  if (upgraded) {
    await ctx.scheduler.runAfter(0, internal.usage.unlockTenantLockedRequests, { tenantId });
  }
}
