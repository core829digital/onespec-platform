/**
 * Site deliveries — the outbound leg of logistics: a shipment FROM the
 * tenant's warehouse TO a specific cantiere, loaded by the tenant's own crew
 * (not a supplier). Distinct from `deliveries` in convex/logistics.ts (the
 * inbound supplier -> warehouse leg).
 *
 * Lifecycle: preparing (loading checklist being filled in) -> in_transit
 * (signed off, departed) -> delivered (arrived at the cantiere) | cancelled.
 * Signing is what actually commits the shipment: it requires every checklist
 * item to be either loaded or have a stated reason it wasn't, and it flips
 * every loaded item's linked inventoryItems row out of warehouse stock
 * (in_stock/assigned -> in_transit), so the warehouse view can never show
 * something that is physically on a truck.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requirePermission } from "./lib/rbac";

const LABEL_MAX = 200;
const NAME_MAX = 120;
const NOTES_MAX = 4_000;
const REASON_MAX = 500;
const ITEMS_MAX = 200;
const MEDIA_MAX = 4;
/** Same bound as quotes.signQuote's MAX_SIGNATURE_LEN — a base64 PNG data URL. */
const MAX_SIGNATURE_LEN = 300_000;
const MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

function assertLen(val: string | undefined, max: number, field = "INVALID_INPUT"): void {
  if (val !== undefined && val.length > max) throw new ConvexError(field);
}

async function loadOwned(ctx: { db: import("./_generated/server").QueryCtx["db"] }, siteDeliveryId: import("./_generated/dataModel").Id<"siteDeliveries">) {
  const row = await ctx.db.get(siteDeliveryId);
  if (!row) throw new ConvexError("SITE_DELIVERY_NOT_FOUND");
  return row;
}

export const listSiteDeliveries = query({
  args: {
    tenantId: v.id("tenants"),
    cantiereId: v.optional(v.id("cantieri")),
    status: v.optional(v.union(v.literal("preparing"), v.literal("in_transit"), v.literal("delivered"), v.literal("cancelled"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 300);
    let rows = args.cantiereId
      ? await ctx.db
          .query("siteDeliveries")
          .withIndex("by_cantiere", (q) => q.eq("cantiereId", args.cantiereId!))
          .order("desc")
          .take(limit * 2)
      : await ctx.db
          .query("siteDeliveries")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .order("desc")
          .take(limit * 2);
    rows = rows.filter((r) => r.tenantId === args.tenantId);
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    return rows.slice(0, limit);
  },
});

export const getSiteDelivery = query({
  args: { siteDeliveryId: v.id("siteDeliveries") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    const cantiere = await ctx.db.get(row.cantiereId);
    const client = cantiere?.clientId ? await ctx.db.get(cantiere.clientId) : null;
    const mediaUrls = await Promise.all(row.packagingMediaIds.map((id) => ctx.storage.getUrl(id)));
    return {
      ...row,
      cantiere: cantiere ? { _id: cantiere._id, name: cantiere.name, address: cantiere.address, city: cantiere.city } : null,
      client: client ? { _id: client._id, name: client.name } : null,
      mediaUrls: mediaUrls.filter((u): u is string => !!u),
    };
  },
});

export const createSiteDelivery = mutation({
  args: {
    tenantId: v.id("tenants"),
    cantiereId: v.id("cantieri"),
    scheduledDate: v.optional(v.number()),
    driverName: v.optional(v.string()),
    driverPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.array(
      v.object({
        inventoryItemId: v.optional(v.id("inventoryItems")),
        label: v.string(),
        quantity: v.number(),
        unit: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "logistics.use");
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere || cantiere.tenantId !== args.tenantId) throw new ConvexError("CANTIERE_NOT_FOUND");
    assertLen(args.driverName, NAME_MAX);
    assertLen(args.driverPhone, NAME_MAX);
    assertLen(args.notes, NOTES_MAX);
    if (args.items.length === 0) throw new ConvexError("NO_ITEMS");
    if (args.items.length > ITEMS_MAX) throw new ConvexError("TOO_MANY_ITEMS");
    for (const item of args.items) {
      assertLen(item.label, LABEL_MAX);
      assertLen(item.unit, 20);
      if (!item.label.trim()) throw new ConvexError("INVALID_INPUT");
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new ConvexError("INVALID_QUANTITY");
    }

    // Any referenced inventoryItemId must be real, tenant-owned, and
    // currently warehouse stock (in_stock or assigned) — you can't load
    // something that's already on another truck or already delivered.
    for (const item of args.items) {
      if (!item.inventoryItemId) continue;
      const inv = await ctx.db.get(item.inventoryItemId);
      if (!inv || inv.tenantId !== args.tenantId) throw new ConvexError("INVENTORY_ITEM_NOT_FOUND");
      if (inv.status !== "in_stock" && inv.status !== "assigned") throw new ConvexError("INVENTORY_ITEM_NOT_AVAILABLE");
    }

    const now = Date.now();
    const siteDeliveryId = await ctx.db.insert("siteDeliveries", {
      tenantId: args.tenantId,
      cantiereId: args.cantiereId,
      status: "preparing",
      scheduledDate: args.scheduledDate,
      driverName: args.driverName?.trim() || undefined,
      driverPhone: args.driverPhone?.trim() || undefined,
      items: args.items.map((i) => ({
        inventoryItemId: i.inventoryItemId,
        label: i.label.trim(),
        quantity: i.quantity,
        unit: i.unit.trim() || "pz",
        loaded: false,
      })),
      packagingMediaIds: [],
      notes: args.notes?.trim() || undefined,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    return siteDeliveryId;
  },
});

/** Tick (or un-tick) one checklist line. Un-ticking clears any stated reason. */
export const setChecklistItem = mutation({
  args: {
    siteDeliveryId: v.id("siteDeliveries"),
    itemIndex: v.number(),
    loaded: v.boolean(),
    notLoadedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "preparing") throw new ConvexError("SITE_DELIVERY_NOT_EDITABLE");
    if (args.itemIndex < 0 || args.itemIndex >= row.items.length) throw new ConvexError("ITEM_INDEX_OUT_OF_RANGE");
    assertLen(args.notLoadedReason, REASON_MAX);

    const items = row.items.slice();
    items[args.itemIndex] = {
      ...items[args.itemIndex],
      loaded: args.loaded,
      notLoadedReason: args.loaded ? undefined : args.notLoadedReason?.trim() || undefined,
    };
    await ctx.db.patch(row._id, { items, updatedAt: Date.now() });
  },
});

export const generateUploadUrl = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries"), contentType: v.string() },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "preparing") throw new ConvexError("SITE_DELIVERY_NOT_EDITABLE");
    if (!MEDIA_TYPES.includes(args.contentType)) throw new ConvexError("UNSUPPORTED_MEDIA_TYPE");
    if (row.packagingMediaIds.length >= MEDIA_MAX) throw new ConvexError("MEDIA_LIMIT_REACHED");
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const addPackagingMedia = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "preparing") throw new ConvexError("SITE_DELIVERY_NOT_EDITABLE");
    if (row.packagingMediaIds.length >= MEDIA_MAX) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("MEDIA_LIMIT_REACHED");
    }
    await ctx.db.patch(row._id, {
      packagingMediaIds: [...row.packagingMediaIds, args.storageId],
      updatedAt: Date.now(),
    });
  },
});

export const removePackagingMedia = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "preparing") throw new ConvexError("SITE_DELIVERY_NOT_EDITABLE");
    if (!row.packagingMediaIds.includes(args.storageId)) return;
    await ctx.storage.delete(args.storageId);
    await ctx.db.patch(row._id, {
      packagingMediaIds: row.packagingMediaIds.filter((id) => id !== args.storageId),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Sign off and depart. Every checklist line must be resolved (loaded, or
 * explicitly marked not-loaded with a reason) — a shipment can't leave with
 * silently-skipped items. This is what actually moves inventory: every
 * loaded item with a linked inventoryItemId flips from in_stock/assigned to
 * in_transit, so it stops appearing as warehouse stock.
 */
export const signSiteDelivery = mutation({
  args: {
    siteDeliveryId: v.id("siteDeliveries"),
    signedByName: v.string(),
    signatureDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "preparing") throw new ConvexError("SITE_DELIVERY_NOT_EDITABLE");

    const signedByName = args.signedByName.trim();
    if (!signedByName) throw new ConvexError("SIGNER_NAME_REQUIRED");
    assertLen(signedByName, NAME_MAX);
    if (!args.signatureDataUrl.startsWith("data:image/")) throw new ConvexError("INVALID_SIGNATURE_FORMAT");
    if (args.signatureDataUrl.length > MAX_SIGNATURE_LEN) throw new ConvexError("SIGNATURE_TOO_LARGE");

    const unresolved = row.items.some((i) => !i.loaded && !i.notLoadedReason);
    if (unresolved) throw new ConvexError("CHECKLIST_INCOMPLETE");

    const now = Date.now();
    for (const item of row.items) {
      if (!item.loaded || !item.inventoryItemId) continue;
      const inv = await ctx.db.get(item.inventoryItemId);
      if (inv && (inv.status === "in_stock" || inv.status === "assigned")) {
        await ctx.db.patch(inv._id, { status: "in_transit", cantiereId: row.cantiereId, updatedAt: now });
      }
    }

    await ctx.db.patch(row._id, {
      status: "in_transit",
      signedByName,
      signatureDataUrl: args.signatureDataUrl,
      signedAt: now,
      departedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      tenantId: row.tenantId,
      actorKind: "user",
      action: "logistics.site_delivery_departed",
      targetTable: "siteDeliveries",
      targetId: row._id,
      meta: { signedByName, itemCount: row.items.length },
      createdAt: now,
    });
  },
});

/** Mark as arrived at the cantiere. Flips its in_transit items to delivered. */
export const markSiteDeliveryDelivered = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    const { userId } = await requirePermission(ctx, row.tenantId, "logistics.use");
    if (row.status !== "in_transit") throw new ConvexError("NOT_IN_TRANSIT");

    const now = Date.now();
    for (const item of row.items) {
      if (!item.loaded || !item.inventoryItemId) continue;
      const inv = await ctx.db.get(item.inventoryItemId);
      if (inv && inv.status === "in_transit") {
        await ctx.db.patch(inv._id, { status: "delivered", updatedAt: now });
      }
    }

    await ctx.db.patch(row._id, { status: "delivered", deliveredAt: now, updatedAt: now });
    await ctx.db.insert("auditLog", {
      tenantId: row.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "logistics.site_delivery_delivered",
      targetTable: "siteDeliveries",
      targetId: row._id,
      createdAt: now,
    });
  },
});

export const cancelSiteDelivery = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.manage");
    if (row.status === "delivered") throw new ConvexError("ALREADY_DELIVERED");
    for (const id of row.packagingMediaIds) await ctx.storage.delete(id);
    await ctx.db.patch(row._id, { status: "cancelled", packagingMediaIds: [], updatedAt: Date.now() });
  },
});

export const deleteSiteDelivery = mutation({
  args: { siteDeliveryId: v.id("siteDeliveries") },
  handler: async (ctx, args) => {
    const row = await loadOwned(ctx, args.siteDeliveryId);
    await requirePermission(ctx, row.tenantId, "logistics.manage");
    if (row.status !== "preparing" && row.status !== "cancelled") throw new ConvexError("CANNOT_DELETE_ACTIVE_DELIVERY");
    for (const id of row.packagingMediaIds) await ctx.storage.delete(id);
    await ctx.db.delete(row._id);
  },
});
