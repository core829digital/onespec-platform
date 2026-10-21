import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Lightweight domain-event trigger system.
 *
 * Convex has no database-level triggers (no ON INSERT/UPDATE hook the way
 * Postgres does) — a write only ever does what the mutation that made it
 * calls. The two building blocks every "automatic" behavior on this
 * platform is built from are:
 *
 *   1. `ctx.scheduler.runAfter(delayMs, internal.module.fn, args)` — queues
 *      another Convex function to run after this mutation commits. delay 0
 *      still runs it as a separate transaction, right after — used for
 *      "and also do this" side effects (sending an email, fanning out a
 *      notification) that shouldn't block or fail the main write.
 *   2. `convex/crons.ts` — the same scheduler, but on a recurring clock
 *      (`crons.daily(...)`) instead of "run once after this write" — used
 *      for periodic sweeps (trialSweep, billing reconcile) that aren't
 *      triggered by any single write at all.
 *
 * Before this file, every mutation that wanted "when X happens, also do Y"
 * called `ctx.scheduler.runAfter` directly and inline — correct, but
 * scattered: the audit log insert is hand-written in ~15 different
 * mutations, notification fan-out is its own scheduler call duplicated at
 * several more. `emit()` below is the same mechanism, named: a mutation
 * reports a domain event once, and every registered side effect for that
 * event runs — without the call site needing to know or list them. Adding
 * a new automatic behavior for an existing event becomes a one-line change
 * here instead of hunting down every place that event happens.
 *
 * This is additive, not a replacement — a mutation with only one obvious,
 * cheap side effect (a single ctx.db.insert("auditLog", ...) right there)
 * has no reason to route through this file. Reach for `emit` when: (a) more
 * than one thing should happen off a single event, (b) the same event
 * already happens at several call sites, or (c) you want new automatic
 * behavior added later without editing every one of those call sites again.
 */

export type TriggerEvent =
  | { type: "quote.won"; tenantId: Id<"tenants">; quoteId: Id<"quoteRequests"> }
  | { type: "quote.status_changed"; tenantId: Id<"tenants">; quoteId: Id<"quoteRequests">; from: string; to: string; leadName: string }
  | { type: "tenant.suspended"; tenantId: Id<"tenants">; reason: string }
  | { type: "configurator.published"; tenantId: Id<"tenants">; configuratorId: Id<"configurators">; version: number };

/**
 * One handler per event type, each just a `ctx.scheduler.runAfter` call into
 * an existing internal mutation/action — this file never touches the
 * database directly, it only decides which already-defined effects a given
 * event fans out to.
 */
async function handle(ctx: MutationCtx, event: TriggerEvent): Promise<void> {
  switch (event.type) {
    case "quote.status_changed":
      await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
        tenantId: event.tenantId,
        type: "quote_status_changed",
        data: { quoteId: event.quoteId, oldStatus: event.from, newStatus: event.to, leadName: event.leadName },
        href: `/app/requests/${event.quoteId}`,
      });
      break;

    case "quote.won":
      // A won quote logs a client-facing activity automatically when it's
      // linked to a client — real, working handler, not a placeholder: see
      // convex/clients.ts:systemAddActivity (a dedicated internal mutation,
      // since the public addClientActivity requires an authenticated
      // membership that a scheduled system call never has).
      await ctx.scheduler.runAfter(0, internal.clients.systemAddActivity, {
        quoteId: event.quoteId,
      });
      break;

    case "tenant.suspended":
      // "system" is the existing generic notification type — no dedicated
      // "tenant_suspended" literal exists in the notifications schema, and
      // adding one is a separate schema migration, not part of this pass.
      await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
        tenantId: event.tenantId,
        type: "system",
        data: { message: `Account sospeso: ${event.reason}`, reason: event.reason },
      });
      break;

    case "configurator.published":
      // No handler yet — placeholder for e.g. "notify the team a new
      // catalogue version is live". Named now so the emit() call site
      // doesn't need to change when a handler is added.
      break;
  }
}

/**
 * Report a domain event. Never throws on the caller's behalf — a trigger
 * side effect failing must not fail the write that reported it, so any
 * error here is swallowed after being logged to the console (Sentry/error
 * tracking picks up server-side console.error already).
 */
export async function emit(ctx: MutationCtx, event: TriggerEvent): Promise<void> {
  try {
    await handle(ctx, event);
  } catch (err) {
    console.error("trigger emit failed", { event: event.type, error: err instanceof Error ? err.message : String(err) });
  }
}
