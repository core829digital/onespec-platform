import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { emit } from "./triggers";
import { lockedSafeLeadName } from "./quotaLock";
import { linkQuoteToCrm, type CrmLinkResult } from "./crmLink";

/**
 * The side effects of a deal closing, shared by every path that turns a quote "won" (quotes.updateStatus,
 * quotes.signQuote, supplies.advance to "order"): the customer becomes an active client with a confirmed site,
 * the team is notified, the client timeline logs the win, and (optionally) the status change is audited.
 * The caller has already patched the quote; `quote` is the row as it was BEFORE that patch (issue #54).
 * Moving the supply to "Ordine" stays with the callers: the supply path is that move.
 */
export async function closeQuoteAsWon(
  ctx: MutationCtx,
  args: {
    quote: Doc<"quoteRequests">;
    userId: Id<"users">;
    /** Write the quote.status_change audit row (the signing path audits quote.signed instead). */
    auditStatusChange: boolean;
    /** Emit even when the quote was already won (updateStatus has always reported every status write). */
    emitWhenAlreadyWon?: boolean;
  },
): Promise<CrmLinkResult> {
  const { quote } = args;
  const crm = await linkQuoteToCrm(ctx, { quoteId: quote._id, userId: args.userId, stage: "won" });
  if (args.emitWhenAlreadyWon || quote.status !== "won") {
    await emit(ctx, { type: "quote.status_changed", tenantId: quote.tenantId, quoteId: quote._id, from: quote.status, to: "won", leadName: lockedSafeLeadName(quote) });
    await emit(ctx, { type: "quote.won", tenantId: quote.tenantId, quoteId: quote._id });
  }
  if (args.auditStatusChange) {
    await ctx.db.insert("auditLog", {
      tenantId: quote.tenantId,
      actorKind: "user",
      action: "quote.status_change",
      targetTable: "quoteRequests",
      targetId: quote._id,
      meta: { oldStatus: quote.status, newStatus: "won" },
      createdAt: Date.now(),
    });
  }
  return crm;
}
