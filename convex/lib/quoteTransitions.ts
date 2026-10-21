/**
 * The quote→"won" transition (#54): one helper for the three historical code
 * paths (quotes.updateStatus, quotes.signQuote, supplies.advance), whose
 * hand-ordered side effects had already drifted — the supplies path lost its
 * events and quote audit (bug #42). Each call site passes the flags that
 * reproduce its current side-effect set exactly; the drift is now a visible
 * flag tuple instead of three code paths, and aligning it (#42) is a flag
 * edit at a single site.
 *
 * Order note: the helper emits events, links the CRM, then moves the supply
 * to "Ordine". updateStatus used to link the CRM before emitting; the swap is
 * inert (independent writes, no test observes their relative creation times),
 * while signQuote's and supplies' original order is preserved exactly.
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { emit } from "./triggers";
import { linkQuoteToCrm, type CrmLinkResult } from "./crmLink";
import { lockedSafeLeadName } from "./quotaLock";
import { ensureOrdered } from "./supply";

export interface MarkQuoteWonOptions {
  /** The quote as it was BEFORE the status patch (source of `from` and the lead name). */
  quote: Doc<"quoteRequests">;
  userId: Id<"users">;
  /** Emit quote.status_changed + quote.won. Off for the supplies path today (#42). */
  events: boolean;
  /** Move the quote's supply to "Ordine". Off for the supplies path — it IS the supply advancing. */
  ensureSupplyOrder: boolean;
  /** Write a quoteRequests audit row (neither signQuote nor supplies writes one today, #42). */
  audit?: { action: string; meta?: Record<string, unknown> };
}

/** Returns the CRM link (client + cantiere) the transition produced. */
export async function markQuoteWon(ctx: MutationCtx, o: MarkQuoteWonOptions): Promise<CrmLinkResult> {
  if (o.events) {
    await emit(ctx, {
      type: "quote.status_changed",
      tenantId: o.quote.tenantId,
      quoteId: o.quote._id,
      from: o.quote.status,
      to: "won",
      leadName: lockedSafeLeadName(o.quote),
    });
    await emit(ctx, { type: "quote.won", tenantId: o.quote.tenantId, quoteId: o.quote._id });
  }
  const crm = await linkQuoteToCrm(ctx, { quoteId: o.quote._id, userId: o.userId, stage: "won" });
  if (o.ensureSupplyOrder) {
    await ensureOrdered(ctx, (await ctx.db.get(o.quote._id)) ?? o.quote);
  }
  if (o.audit) {
    await ctx.db.insert("auditLog", {
      tenantId: o.quote.tenantId,
      actorKind: "user",
      action: o.audit.action,
      targetTable: "quoteRequests",
      targetId: o.quote._id,
      meta: o.audit.meta,
      createdAt: Date.now(),
    });
  }
  return crm;
}
