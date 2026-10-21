/**
 * Retention for per-action append-only tables (#35). These tables have no
 * terminal state: without a purge they grow without bound (storage cost and a
 * monotonically growing GDPR surface — audit rows carry IPs and free-form
 * personal meta, catalogImports each store a full catalog snapshot).
 *
 * Retention windows (single source of truth, mirrored by the privacy register):
 * - auditLog / clientActivities — 730 days (24 months of CRM/audit history)
 * - billingEvents — 30 days (past Stripe's replay window; idempotency keys
 *   only matter for the ~days of webhook retries)
 * - meteredEvents / viesChecks / catalogImports — 90 days (matches the
 *   email-log retention in convex/email.ts)
 * - trialFingerprints — 180 days (longest trial + abuse-lookback horizon)
 *
 * Each purge reads its table's own insert timestamp (createdAt / receivedAt /
 * checkedAt / importedAt) through a dedicated index. Batching follows the
 * established email-log pattern: take(500) per table, self-reschedule while
 * any table still has expired rows.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 500;

export const purgeAppendOnly = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = (days: number) => Date.now() - days * DAY;
    const expired = await Promise.all([
      ctx.db.query("auditLog").withIndex("by_created_at", (q) => q.lt("createdAt", cutoff(730))).take(BATCH),
      ctx.db.query("clientActivities").withIndex("by_created_at", (q) => q.lt("createdAt", cutoff(730))).take(BATCH),
      ctx.db.query("meteredEvents").withIndex("by_created_at", (q) => q.lt("createdAt", cutoff(90))).take(BATCH),
      ctx.db.query("billingEvents").withIndex("by_received_at", (q) => q.lt("receivedAt", cutoff(30))).take(BATCH),
      ctx.db.query("viesChecks").withIndex("by_checked_at", (q) => q.lt("checkedAt", cutoff(90))).take(BATCH),
      ctx.db.query("catalogImports").withIndex("by_imported_at", (q) => q.lt("importedAt", cutoff(90))).take(BATCH),
      ctx.db.query("trialFingerprints").withIndex("by_created_at", (q) => q.lt("createdAt", cutoff(180))).take(BATCH),
    ]);
    let deleted = 0;
    for (const rows of expired) {
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    if (expired.some((rows) => rows.length === BATCH)) {
      await ctx.scheduler.runAfter(0, internal.retention.purgeAppendOnly, {});
    }
    return deleted;
  },
});
