import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, SIGNATURE_PNG } from "./_helpers";

async function seedCantiere(t: ReturnType<typeof newDb>, tenantId: Id<"tenants">) {
  return t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId,
      name: "Cantiere Via Roma",
      address: "Via Roma 1",
      city: "Milano",
      postalCode: "20100",
      status: "in_produzione",
      priority: "medium",
      assignedUserIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

async function seedInStockItem(t: ReturnType<typeof newDb>, tenantId: Id<"tenants">, label = "Finestra 120x140") {
  return t.run((ctx) =>
    ctx.db.insert("inventoryItems", {
      tenantId,
      label,
      quantity: 1,
      unit: "pz",
      status: "in_stock",
      receivedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

const SIGNATURE = SIGNATURE_PNG;

describe("siteDeliveries (warehouse -> cantiere shipment leg)", () => {
  test("full lifecycle: create -> checklist -> sign (moves inventory out of stock) -> deliver", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const cantiereId = await seedCantiere(t, tenantId);
    const itemId = await seedInStockItem(t, tenantId);
    const as = t.withIdentity({ subject: ownerId });

    const siteDeliveryId = await as.mutation(api.siteDeliveries.createSiteDelivery, {
      tenantId,
      cantiereId,
      items: [
        { inventoryItemId: itemId, label: "Finestra 120x140", quantity: 1, unit: "pz" },
        { label: "Kit fissaggio", quantity: 2, unit: "conf" },
      ],
    });

    let row = await as.query(api.siteDeliveries.getSiteDelivery, { siteDeliveryId });
    expect(row?.status).toBe("preparing");
    expect(row?.items).toHaveLength(2);

    // Signing with an unresolved checklist line is refused.
    await expect(
      as.mutation(api.siteDeliveries.signSiteDelivery, {
        siteDeliveryId,
        signedByName: "Mario Rossi",
        signatureDataUrl: SIGNATURE,
      }),
    ).rejects.toThrow("CHECKLIST_INCOMPLETE");

    await as.mutation(api.siteDeliveries.setChecklistItem, { siteDeliveryId, itemIndex: 0, loaded: true });
    // Second item explicitly not loaded, with a reason — also resolves it.
    await as.mutation(api.siteDeliveries.setChecklistItem, {
      siteDeliveryId,
      itemIndex: 1,
      loaded: false,
      notLoadedReason: "Kit non ancora arrivato dal fornitore",
    });

    await as.mutation(api.siteDeliveries.signSiteDelivery, {
      siteDeliveryId,
      signedByName: "Mario Rossi",
      signatureDataUrl: SIGNATURE,
    });

    row = await as.query(api.siteDeliveries.getSiteDelivery, { siteDeliveryId });
    expect(row?.status).toBe("in_transit");
    expect(row?.signedByName).toBe("Mario Rossi");
    expect(row?.departedAt).toBeTypeOf("number");

    // The loaded item (with inventoryItemId) left the warehouse; nothing
    // happens to the unloaded one since it was never actually put on the truck.
    const inv = await t.run((ctx) => ctx.db.get(itemId));
    expect(inv?.status).toBe("in_transit");
    expect(inv?.cantiereId).toBe(cantiereId);

    await as.mutation(api.siteDeliveries.markSiteDeliveryDelivered, { siteDeliveryId });
    row = await as.query(api.siteDeliveries.getSiteDelivery, { siteDeliveryId });
    expect(row?.status).toBe("delivered");
    expect(row?.deliveredAt).toBeTypeOf("number");
    const invAfter = await t.run((ctx) => ctx.db.get(itemId));
    expect(invAfter?.status).toBe("delivered");
  });

  test("cannot load an item that is already in_transit on another shipment", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const cantiereId = await seedCantiere(t, tenantId);
    const itemId = await seedInStockItem(t, tenantId);
    const as = t.withIdentity({ subject: ownerId });

    await t.run((ctx) => ctx.db.patch(itemId, { status: "in_transit" }));

    await expect(
      as.mutation(api.siteDeliveries.createSiteDelivery, {
        tenantId,
        cantiereId,
        items: [{ inventoryItemId: itemId, label: "x", quantity: 1, unit: "pz" }],
      }),
    ).rejects.toThrow("INVENTORY_ITEM_NOT_AVAILABLE");
  });

  test("tenant isolation: a foreign tenant cannot read or act on another's site delivery", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const cantiereId = await seedCantiere(t, tenantId);
    const as = t.withIdentity({ subject: ownerId });
    const siteDeliveryId = await as.mutation(api.siteDeliveries.createSiteDelivery, {
      tenantId,
      cantiereId,
      items: [{ label: "x", quantity: 1, unit: "pz" }],
    });

    const other = await seedTenant(t, { plan: "pro" });
    const asOther = t.withIdentity({ subject: other.ownerId });
    await expect(asOther.query(api.siteDeliveries.getSiteDelivery, { siteDeliveryId })).rejects.toThrow();
    await expect(
      asOther.mutation(api.siteDeliveries.setChecklistItem, { siteDeliveryId, itemIndex: 0, loaded: true }),
    ).rejects.toThrow();
  });

  test("a cross-tenant cantiereId is rejected on create", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const other = await seedTenant(t, { plan: "pro" });
    const otherCantiereId = await seedCantiere(t, other.tenantId);
    const as = t.withIdentity({ subject: ownerId });

    await expect(
      as.mutation(api.siteDeliveries.createSiteDelivery, {
        tenantId,
        cantiereId: otherCantiereId,
        items: [{ label: "x", quantity: 1, unit: "pz" }],
      }),
    ).rejects.toThrow("CANTIERE_NOT_FOUND");
  });

  test("cancelling frees up packaging media and cannot be un-done into delivered", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const cantiereId = await seedCantiere(t, tenantId);
    const as = t.withIdentity({ subject: ownerId });
    const siteDeliveryId = await as.mutation(api.siteDeliveries.createSiteDelivery, {
      tenantId,
      cantiereId,
      items: [{ label: "x", quantity: 1, unit: "pz" }],
    });

    await as.mutation(api.siteDeliveries.cancelSiteDelivery, { siteDeliveryId });
    const row = await as.query(api.siteDeliveries.getSiteDelivery, { siteDeliveryId });
    expect(row?.status).toBe("cancelled");

    await expect(
      as.mutation(api.siteDeliveries.markSiteDeliveryDelivered, { siteDeliveryId }),
    ).rejects.toThrow("NOT_IN_TRANSIT");
  });
});
