import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { lockedSafeLeadName } from "./quotaLock";

/** The customer closed the deal: make sure the quote has its supply and that it is at "order" (idempotent, never moves a supply backwards). */
export async function ensureOrdered(ctx: MutationCtx, quote: Doc<"quoteRequests">): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", quote._id)).first();
  if (!existing) {
    await ctx.db.insert("supplies", {
      tenantId: quote.tenantId,
      quoteId: quote._id,
      reference: quote.offerNumber ?? String(quote._id),
      clientId: quote.clientId,
      cantiereId: quote.cantiereId,
      customerName: lockedSafeLeadName(quote),
      status: "order",
      revenueExVatCents: quote.priceExVatCents,
      quotedAt: quote._creationTime,
      orderedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }
  if (existing.status === "quote") {
    await ctx.db.patch(existing._id, { status: "order", orderedAt: now, revenueExVatCents: quote.priceExVatCents, updatedAt: now });
  }
  // The supply always points at the quote's customer and site (it may have been started before they were linked).
  if (existing.clientId !== quote.clientId || existing.cantiereId !== quote.cantiereId) {
    await ctx.db.patch(existing._id, { clientId: quote.clientId, cantiereId: quote.cantiereId, updatedAt: now });
  }
}
