import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Retention of the append-only tables (issue #35). One place for the windows, mirrored in
 * docs/REGISTRO_TRATTAMENTI.md. Each run deletes a batch older than its window and reschedules itself while a full
 * batch came back, so a backlog drains over a few minutes without hitting transaction limits.
 *
 * Deliberately NOT purged here:
 * - clientActivities: the dealer's own CRM history of a customer (we process it for the dealer, kept for the contract
 *   and deleted with the client card or the account);
 * - viesChecks referenced by a quote: the proof behind a 0% intra-EU supply, kept with the quote.
 */
export const RETENTION_DAYS = {
  /** Security and accountability log (ids and action names, hashed IPs): two years, like closed support tickets. */
  auditLog: 730,
  /** Stripe webhook idempotency keys: Stripe retries for 3 days. */
  billingEvents: 90,
  /** Metered PDF / WhatsApp / showroom actions: monthly caps need the current period; 13 months keeps a year's view. */
  meteredEvents: 400,
  /** Catalogue imports keep a full snapshot of the previous catalogue for "undo": undo is offered for 90 days. */
  catalogImports: 90,
  /** VIES lookups no quote relies on (customer name and address): 13 months. */
  viesChecks: 400,
  /** Card fingerprints that already had a Pro trial: three years against repeat trials. */
  trialFingerprints: 1095,
} as const;

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const cutoff = (days: number) => Date.now() - days * DAY_MS;

type SimpleTable = "auditLog" | "billingEvents" | "meteredEvents" | "catalogImports" | "trialFingerprints";

/** Deletes up to one batch of rows of `table` older than its window; true when a full batch was deleted. */
async function purgeBatch(ctx: MutationCtx, table: SimpleTable) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff(RETENTION_DAYS[table])))
    .take(BATCH);
  for (const r of rows) await ctx.db.delete(r._id);
  return rows.length;
}

export const purgeAppendOnly = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let deleted = 0;
    let more = false;
    for (const table of ["auditLog", "billingEvents", "meteredEvents", "catalogImports", "trialFingerprints"] as const) {
      const n = await purgeBatch(ctx, table);
      deleted += n;
      if (n === BATCH) more = true;
    }

    // VIES lookups: only those no quote points to.
    const checks = await ctx.db
      .query("viesChecks")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff(RETENTION_DAYS.viesChecks)))
      .take(BATCH);
    for (const c of checks) {
      const used = await ctx.db
        .query("quoteRequests")
        .withIndex("by_viesCheck", (q) => q.eq("viesCheckId", c._id))
        .first();
      if (!used) {
        await ctx.db.delete(c._id);
        deleted++;
      }
    }
    // Kept checks stay in the old range, so a full page of them would repeat forever: only reschedule on real deletions.
    if (checks.length === BATCH && deleted > 0) more = true;

    if (more) await ctx.scheduler.runAfter(0, internal.retention.purgeAppendOnly, {});
    return deleted;
  },
});
