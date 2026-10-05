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
}
