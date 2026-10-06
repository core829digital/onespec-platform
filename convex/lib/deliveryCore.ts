/**
 * Fornitura ↔ Logistica: the supply's "Consegna" stage and the shipment it opens are one event seen from two pages.
 *
 *   supply → "delivery"   opens a shipment from the supplier (the deliverer, or the factory when none was named), for the quote's pieces,
 *                         towards the quote's cantiere;
 *   shipment received     (Logistica, "Merce ricevuta") closes the supply as delivered;
 *   supply → "delivered"  receives the shipment (the warehouse gets its stock) if it is still open;
 *   supply reverted       takes the shipment back with it, unless goods already left the warehouse.
 */
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ProjectItem } from "../../src/shared/pricing";
import { ensureLogisticsMirror } from "./partnerLinks";

const DAY = 24 * 3600 * 1000;

/** "Finestra 1200×1400 mm × 2": what the warehouse will expect for one quote piece. */
export function pieceLabel(item: Partial<ProjectItem>): string {
  const kind = item.category ?? (item.productType === "balconyDoor" ? "portafinestra" : "finestra");
  const size = item.width && item.height ? ` ${item.width}×${item.height} mm` : "";
  const qty = item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : "";
  return `${kind}${size}${qty}`.trim();
}

/** Receiving a shipment: its expected pieces become warehouse stock, once. Returns how many stock lines were created. */
export async function receiveDelivery(ctx: MutationCtx, delivery: Doc<"deliveries">, userId: Id<"users"> | undefined): Promise<number> {
  if (delivery.status === "received") return 0;
  if (delivery.status === "cancelled") throw new ConvexError("DELIVERY_CANCELLED");
  const now = Date.now();
  const labels = delivery.expectedItems && delivery.expectedItems.length > 0 ? delivery.expectedItems : [`Consegna ${delivery._id.slice(-6)}`];
  for (const label of labels) {
    await ctx.db.insert("inventoryItems", {
      tenantId: delivery.tenantId,
      deliveryId: delivery._id,
      label,
      quantity: 1,
      unit: "pz",
      cantiereId: delivery.cantiereId,
      status: "in_stock",
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  await ctx.db.patch(delivery._id, { status: "received", receivedAt: now, receivedByUserId: userId, updatedAt: now });
  return labels.length;
}

/** Opens the shipment of a supply that reached "Consegna" (idempotent). Nothing is opened when there is no supplier to ship it. */
export async function ensureDeliveryForSupply(ctx: MutationCtx, supply: Doc<"supplies">): Promise<Id<"deliveries"> | undefined> {
  const existing = await ctx.db.query("deliveries").withIndex("by_supply", (q) => q.eq("supplyId", supply._id)).first();
  if (existing) return existing._id;
  // "The supplier does the logistics": the deliverer if one was named, otherwise the factory that made the windows.
  const partnerId = supply.delivererId ?? supply.producerId;
  const partner = partnerId ? await ctx.db.get(partnerId) : null;
  if (!partner) return undefined;
  const supplierId = await ensureLogisticsMirror(ctx, partner);
  const quote = await ctx.db.get(supply.quoteId);
  const items = Array.isArray(quote?.items) ? (quote!.items as Partial<ProjectItem>[]) : [];
  const lead = Math.max(0, ...((quote?.supplierLines ?? []).map((l) => l.leadTimeDays)));
  const now = Date.now();
  return await ctx.db.insert("deliveries", {
    tenantId: supply.tenantId,
    supplierId,
    scheduledDate: now + (lead || 7) * DAY,
    status: "scheduled",
    cantiereId: supply.cantiereId ?? quote?.cantiereId,
    quoteId: supply.quoteId,
    supplyId: supply._id,
    notes: `Fornitura ${supply.reference} · ${supply.customerName}`,
    expectedItems: items.length > 0 ? items.map(pieceLabel).slice(0, 200) : undefined,
    createdAt: now,
    updatedAt: now,
  });
}

/** The shipment of this supply was received in Logistica: the supply is delivered (only when it is waiting for that). */
export async function completeSupplyFromDelivery(ctx: MutationCtx, delivery: Doc<"deliveries">): Promise<void> {
  if (!delivery.supplyId) return;
  const supply = await ctx.db.get(delivery.supplyId);
  if (!supply || supply.status !== "delivery") return;
  const now = Date.now();
  await ctx.db.patch(supply._id, { status: "delivered", deliveredAt: now, updatedAt: now });
  await ctx.db.insert("auditLog", {
    tenantId: supply.tenantId,
    actorKind: "user",
    action: "supply.advance",
    targetTable: "supplies",
    targetId: supply._id,
    meta: { from: "delivery", to: "delivered", via: "logistics" },
    createdAt: now,
  });
}

/** The supply moved back out of "delivered" / "delivery": its shipment goes back with it. Refuses when the stock already left the warehouse. */
export async function takeBackDelivery(ctx: MutationCtx, supplyId: Id<"supplies">, from: "delivered" | "delivery"): Promise<void> {
  const delivery = await ctx.db.query("deliveries").withIndex("by_supply", (q) => q.eq("supplyId", supplyId)).first();
  if (!delivery) return;
  const stock = await ctx.db.query("inventoryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", delivery._id)).take(500);
  if (delivery.status === "received") {
    if (stock.some((i) => i.status !== "in_stock")) throw new ConvexError("SUPPLY_DELIVERY_STOCK_MOVED");
    for (const i of stock) await ctx.db.delete(i._id);
    // Back to a shipment on its way; leaving "delivery" altogether removes it.
    await ctx.db.patch(delivery._id, { status: "in_transit", receivedAt: undefined, receivedByUserId: undefined, updatedAt: Date.now() });
  }
  if (from === "delivery") await ctx.db.delete(delivery._id);
}
