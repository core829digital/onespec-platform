/**
 * Logistics + inventory. Physical-goods delivery tracking (carriers, delivery
 * suppliers, scheduled shipments) bidirectionally linked to warehouse stock:
 * marking a delivery "received" auto-creates its inventory items.
 *
 * Not to be confused with `catalogSuppliers` (convex/suppliers.ts) — that's
 * the pricing-source directory for the multi-supplier quote aggregator
 * (Agency+ entitlement). This module is available on every plan, with
 * per-plan caps (see convex/lib/entitlements.ts maxLogisticsSuppliers/maxCarriers).
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requirePermission } from "./lib/rbac";
import { enforceLogisticsSupplierQuota, enforceCarrierQuota } from "./lib/enforcement";
import { ensurePartnerForLogistics, findLogisticsMatch, syncLogisticsEdit } from "./lib/partnerLinks";
import { completeSupplyFromDelivery, receiveDelivery } from "./lib/deliveryCore";

const NAME_MAX = 200;
const CONTACT_MAX = 120;
const NOTES_MAX = 4_000;
const EXPECTED_ITEMS_MAX = 200;

function assertLen(val: string | undefined, max: number): void {
  if (val !== undefined && val.length > max) throw new ConvexError("INVALID_INPUT");
}

// ---------------------------------------------------------------------------
// Delivery suppliers
// ---------------------------------------------------------------------------

export const listLogisticsSuppliers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    return await ctx.db
      .query("logisticsSuppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

export const createLogisticsSupplier = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.manage");
    const name = args.name.trim();
    if (!name) throw new ConvexError("NAME_REQUIRED");
    // The same company is already here (typed before, or mirrored from the Fornitura page): use it instead of creating a twin.
    const twin = await findLogisticsMatch(ctx, args.tenantId, { name, email: args.email?.trim() });
    if (twin) {
      if (!twin.partnerId) await ensurePartnerForLogistics(ctx, twin);
      return twin._id;
    }
    await enforceLogisticsSupplierQuota(ctx, args.tenantId);
    assertLen(name, NAME_MAX);
    assertLen(args.contactName, CONTACT_MAX);
    assertLen(args.phone, CONTACT_MAX);
    assertLen(args.email, CONTACT_MAX);
    assertLen(args.address, NOTES_MAX);
    assertLen(args.notes, NOTES_MAX);

    const now = Date.now();
    const id = await ctx.db.insert("logisticsSuppliers", {
      tenantId: args.tenantId,
      name,
      contactName: args.contactName?.trim(),
      phone: args.phone?.trim(),
      email: args.email?.trim(),
      address: args.address?.trim(),
      notes: args.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    });
    // The shipper is also a supplier of the Fornitura page (found by VAT / e-mail / name, or created): one company, two views.
    const created = await ctx.db.get(id);
    if (created) await ensurePartnerForLogistics(ctx, created);
    return id;
  },
});

export const updateLogisticsSupplier = mutation({
  args: {
    supplierId: v.id("logisticsSuppliers"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier) throw new ConvexError("SUPPLIER_NOT_FOUND");
    await requirePermission(ctx, supplier.tenantId, "logistics.manage");
    assertLen(args.name, NAME_MAX);
    assertLen(args.contactName, CONTACT_MAX);
    assertLen(args.phone, CONTACT_MAX);
    assertLen(args.email, CONTACT_MAX);
    assertLen(args.address, NOTES_MAX);
    assertLen(args.notes, NOTES_MAX);
    if (args.name !== undefined && !args.name.trim()) throw new ConvexError("NAME_REQUIRED");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.contactName !== undefined) patch.contactName = args.contactName.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.email !== undefined) patch.email = args.email.trim();
    if (args.address !== undefined) patch.address = args.address.trim();
    if (args.notes !== undefined) patch.notes = args.notes.trim();
    await ctx.db.patch(args.supplierId, patch);
    // Name and contacts reach the Fornitura page (and its price-source entries).
    await syncLogisticsEdit(ctx, args.supplierId);
  },
});

export const deleteLogisticsSupplier = mutation({
  args: { supplierId: v.id("logisticsSuppliers") },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier) return;
    await requirePermission(ctx, supplier.tenantId, "logistics.manage");
    const inUse = await ctx.db
      .query("deliveries")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId))
      .first();
    if (inUse) throw new ConvexError("SUPPLIER_HAS_DELIVERIES");
    await ctx.db.delete(args.supplierId);
  },
});

// ---------------------------------------------------------------------------
// Carriers
// ---------------------------------------------------------------------------

export const listCarriers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    return await ctx.db
      .query("carriers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

export const createCarrier = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.manage");
    await enforceCarrierQuota(ctx, args.tenantId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("NAME_REQUIRED");
    assertLen(name, NAME_MAX);
    assertLen(args.contactName, CONTACT_MAX);
    assertLen(args.phone, CONTACT_MAX);
    assertLen(args.email, CONTACT_MAX);
    assertLen(args.notes, NOTES_MAX);

    const now = Date.now();
    return await ctx.db.insert("carriers", {
      tenantId: args.tenantId,
      name,
      contactName: args.contactName?.trim(),
      phone: args.phone?.trim(),
      email: args.email?.trim(),
      notes: args.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCarrier = mutation({
  args: {
    carrierId: v.id("carriers"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId);
    if (!carrier) throw new ConvexError("CARRIER_NOT_FOUND");
    await requirePermission(ctx, carrier.tenantId, "logistics.manage");
    assertLen(args.name, NAME_MAX);
    assertLen(args.contactName, CONTACT_MAX);
    assertLen(args.phone, CONTACT_MAX);
    assertLen(args.email, CONTACT_MAX);
    assertLen(args.notes, NOTES_MAX);
    if (args.name !== undefined && !args.name.trim()) throw new ConvexError("NAME_REQUIRED");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.contactName !== undefined) patch.contactName = args.contactName.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.email !== undefined) patch.email = args.email.trim();
    if (args.notes !== undefined) patch.notes = args.notes.trim();
    await ctx.db.patch(args.carrierId, patch);
  },
});

export const deleteCarrier = mutation({
  args: { carrierId: v.id("carriers") },
  handler: async (ctx, args) => {
    const carrier = await ctx.db.get(args.carrierId);
    if (!carrier) return;
    await requirePermission(ctx, carrier.tenantId, "logistics.manage");
    const inUse = await ctx.db
      .query("deliveries")
      .withIndex("by_tenant", (q) => q.eq("tenantId", carrier.tenantId))
      .filter((q) => q.eq(q.field("carrierId"), args.carrierId))
      .first();
    if (inUse) throw new ConvexError("CARRIER_HAS_DELIVERIES");
    await ctx.db.delete(args.carrierId);
  },
});

// ---------------------------------------------------------------------------
// Deliveries (calendar)
// ---------------------------------------------------------------------------

export const listDeliveries = query({
  args: {
    tenantId: v.id("tenants"),
    /** Calendar view: [from, to) in epoch ms on scheduledDate. Omit for all. */
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("scheduled"), v.literal("in_transit"), v.literal("received"), v.literal("cancelled")),
    ),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const { tenantId, from, to } = args;
    const rows = await ctx.db
      .query("deliveries")
      .withIndex("by_tenant_date", (idx) => {
        const withLower = from !== undefined ? idx.eq("tenantId", tenantId).gte("scheduledDate", from) : idx.eq("tenantId", tenantId);
        return to !== undefined ? withLower.lt("scheduledDate", to) : withLower;
      })
      .order("asc")
      .take(500);
    const wanted = args.status ? rows.filter((r) => r.status === args.status) : rows;
    // What each shipment is for: the supply, the customer and the site it belongs to (names only, for the calendar).
    const supplyNames = new Map<string, { reference: string; customerName: string } | null>();
    const siteNames = new Map<string, string | null>();
    const out = [];
    for (const r of wanted) {
      let supply: { reference: string; customerName: string } | null = null;
      if (r.supplyId) {
        if (!supplyNames.has(r.supplyId)) {
          const sp = await ctx.db.get(r.supplyId);
          supplyNames.set(r.supplyId, sp ? { reference: sp.reference, customerName: sp.customerName } : null);
        }
        supply = supplyNames.get(r.supplyId) ?? null;
      }
      let siteName: string | null = null;
      if (r.cantiereId) {
        if (!siteNames.has(r.cantiereId)) siteNames.set(r.cantiereId, (await ctx.db.get(r.cantiereId))?.name ?? null);
        siteName = siteNames.get(r.cantiereId) ?? null;
      }
      out.push({ ...r, supplyReference: supply?.reference, customerName: supply?.customerName, cantiereName: siteName ?? undefined });
    }
    return out;
  },
});

export const createDelivery = mutation({
  args: {
    tenantId: v.id("tenants"),
    supplierId: v.id("logisticsSuppliers"),
    carrierId: v.optional(v.id("carriers")),
    driverName: v.optional(v.string()),
    driverPhone: v.optional(v.string()),
    scheduledDate: v.number(),
    cantiereId: v.optional(v.id("cantieri")),
    quoteId: v.optional(v.id("quoteRequests")),
    /** The supply (Fornitura) this shipment belongs to; its quote and cantiere are taken from it when not given. */
    supplyId: v.optional(v.id("supplies")),
    notes: v.optional(v.string()),
    expectedItems: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const supply = args.supplyId ? await ctx.db.get(args.supplyId) : null;
    if (args.supplyId && (!supply || supply.tenantId !== args.tenantId)) throw new ConvexError("SUPPLY_NOT_FOUND");
    if (supply) {
      const already = await ctx.db.query("deliveries").withIndex("by_supply", (q) => q.eq("supplyId", supply._id)).first();
      if (already && already.status !== "cancelled") throw new ConvexError("SUPPLY_DELIVERY_EXISTS");
    }
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.tenantId !== args.tenantId) throw new ConvexError("SUPPLIER_NOT_FOUND");
    if (args.carrierId) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.tenantId !== args.tenantId) throw new ConvexError("CARRIER_NOT_FOUND");
    }
    if (args.cantiereId) {
      const cantiere = await ctx.db.get(args.cantiereId);
      if (!cantiere || cantiere.tenantId !== args.tenantId) throw new ConvexError("CANTIERE_NOT_FOUND");
    }
    if (args.quoteId) {
      const quote = await ctx.db.get(args.quoteId);
      if (!quote || quote.tenantId !== args.tenantId) throw new ConvexError("QUOTE_NOT_FOUND");
    }
    if (!Number.isFinite(args.scheduledDate)) throw new ConvexError("INVALID_INPUT");
    assertLen(args.driverName, CONTACT_MAX);
    assertLen(args.driverPhone, CONTACT_MAX);
    assertLen(args.notes, NOTES_MAX);
    if (args.expectedItems) {
      if (args.expectedItems.length > EXPECTED_ITEMS_MAX) throw new ConvexError("INVALID_INPUT");
      for (const it of args.expectedItems) assertLen(it, NAME_MAX);
    }

    const now = Date.now();
    return await ctx.db.insert("deliveries", {
      tenantId: args.tenantId,
      supplierId: args.supplierId,
      carrierId: args.carrierId,
      driverName: args.driverName?.trim(),
      driverPhone: args.driverPhone?.trim(),
      scheduledDate: args.scheduledDate,
      status: "scheduled",
      cantiereId: args.cantiereId ?? supply?.cantiereId,
      quoteId: args.quoteId ?? supply?.quoteId,
      supplyId: supply?._id,
      notes: args.notes?.trim(),
      expectedItems: args.expectedItems?.map((s) => s.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDelivery = mutation({
  args: {
    deliveryId: v.id("deliveries"),
    carrierId: v.optional(v.id("carriers")),
    driverName: v.optional(v.string()),
    driverPhone: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("scheduled"), v.literal("in_transit"), v.literal("received"), v.literal("cancelled")),
    ),
    notes: v.optional(v.string()),
    expectedItems: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) throw new ConvexError("DELIVERY_NOT_FOUND");
    await requirePermission(ctx, delivery.tenantId, "logistics.use");
    // "received" goes through markDeliveryReceived so the inventory side
    // effect always happens — never allow it to be set as a bare status flip.
    if (args.status === "received") throw new ConvexError("USE_MARK_RECEIVED");
    if (args.carrierId) {
      const carrier = await ctx.db.get(args.carrierId);
      if (!carrier || carrier.tenantId !== delivery.tenantId) throw new ConvexError("CARRIER_NOT_FOUND");
    }
    assertLen(args.driverName, CONTACT_MAX);
    assertLen(args.driverPhone, CONTACT_MAX);
    assertLen(args.notes, NOTES_MAX);
    if (args.expectedItems) {
      if (args.expectedItems.length > EXPECTED_ITEMS_MAX) throw new ConvexError("INVALID_INPUT");
      for (const it of args.expectedItems) assertLen(it, NAME_MAX);
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.carrierId !== undefined) patch.carrierId = args.carrierId;
    if (args.driverName !== undefined) patch.driverName = args.driverName.trim();
    if (args.driverPhone !== undefined) patch.driverPhone = args.driverPhone.trim();
    if (args.scheduledDate !== undefined) patch.scheduledDate = args.scheduledDate;
    if (args.status !== undefined) patch.status = args.status;
    if (args.notes !== undefined) patch.notes = args.notes.trim();
    if (args.expectedItems !== undefined) patch.expectedItems = args.expectedItems.map((s) => s.trim()).filter(Boolean);
    await ctx.db.patch(args.deliveryId, patch);
  },
});

/**
 * "Merce Ricevuta" — the bidirectional link the user asked for: marking a
 * delivery received auto-creates its inventory items, piece by piece, from
 * `expectedItems` (or a single fallback line if none were listed).
 */
export const markDeliveryReceived = mutation({
  args: { deliveryId: v.id("deliveries") },
  handler: async (ctx, args): Promise<{ ok: true; itemsCreated: number }> => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) throw new ConvexError("DELIVERY_NOT_FOUND");
    const { userId } = await requirePermission(ctx, delivery.tenantId, "logistics.use");
    if (delivery.status === "received") return { ok: true, itemsCreated: 0 };
    if (delivery.status === "cancelled") throw new ConvexError("DELIVERY_CANCELLED");

    const now = Date.now();
    const itemsCreated = await receiveDelivery(ctx, delivery, userId);
    // The supply behind this shipment is delivered too (when it was waiting for it).
    await completeSupplyFromDelivery(ctx, delivery);

    await ctx.db.insert("auditLog", {
      tenantId: delivery.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "logistics.delivery_received",
      targetTable: "deliveries",
      targetId: delivery._id,
      meta: { itemsCreated },
      createdAt: now,
    });

    return { ok: true, itemsCreated };
  },
});

export const deleteDelivery = mutation({
  args: { deliveryId: v.id("deliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return;
    await requirePermission(ctx, delivery.tenantId, "logistics.manage");
    if (delivery.status === "received") throw new ConvexError("CANNOT_DELETE_RECEIVED_DELIVERY");
    await ctx.db.delete(args.deliveryId);
  },
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const listInventoryItems = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(v.union(v.literal("in_stock"), v.literal("assigned"), v.literal("in_transit"), v.literal("delivered"), v.literal("installed"))),
    cantiereId: v.optional(v.id("cantieri")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    let rows = await ctx.db
      .query("inventoryItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit * 2);
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.cantiereId) rows = rows.filter((r) => r.cantiereId === args.cantiereId);
    return rows.slice(0, limit);
  },
});

export const updateInventoryItem = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    status: v.optional(v.union(v.literal("in_stock"), v.literal("assigned"), v.literal("in_transit"), v.literal("delivered"), v.literal("installed"))),
    cantiereId: v.optional(v.id("cantieri")),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("ITEM_NOT_FOUND");
    await requirePermission(ctx, item.tenantId, "logistics.use");
    if (args.cantiereId) {
      const cantiere = await ctx.db.get(args.cantiereId);
      if (!cantiere || cantiere.tenantId !== item.tenantId) throw new ConvexError("CANTIERE_NOT_FOUND");
    }
    if (args.quantity !== undefined && (!Number.isFinite(args.quantity) || args.quantity < 0)) {
      throw new ConvexError("INVALID_INPUT");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.status !== undefined) patch.status = args.status;
    if (args.cantiereId !== undefined) patch.cantiereId = args.cantiereId;
    if (args.quantity !== undefined) patch.quantity = args.quantity;
    await ctx.db.patch(args.itemId, patch);
  },
});

export const deleteInventoryItem = mutation({
  args: { itemId: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return;
    await requirePermission(ctx, item.tenantId, "logistics.manage");
    await ctx.db.delete(args.itemId);
  },
});

// ---------------------------------------------------------------------------
// Dashboard / analytics hook
// ---------------------------------------------------------------------------

export const getLogisticsSummary = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const now = Date.now();
    const in7d = now + 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

    const upcoming = await ctx.db
      .query("deliveries")
      .withIndex("by_tenant_date", (q) => q.eq("tenantId", args.tenantId).gte("scheduledDate", now).lt("scheduledDate", in7d))
      .take(300);
    const receivedThisMonth = await ctx.db
      .query("deliveries")
      .withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "received"))
      // Newest first and bounded: the dashboard counts this month, it must not read every delivery ever received.
      .order("desc")
      .take(500);
    const inStockCount = await ctx.db
      .query("inventoryItems")
      .withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "in_stock"))
      .take(2000);

    return {
      upcomingDeliveries7d: upcoming.filter((d) => d.status === "scheduled" || d.status === "in_transit").length,
      receivedThisMonth: receivedThisMonth.filter((d) => (d.receivedAt ?? 0) >= monthStart).length,
      itemsInStock: inStockCount.length,
    };
  },
});
