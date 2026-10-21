import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

test("logistics: supplier/carrier CRUD, tenant scoping, plan quota", async () => {
  const t = newDb();
  const base = await seedTenant(t, { plan: "base" });
  const asOwner = t.withIdentity({ subject: base.ownerId });
  const asMember = t.withIdentity({ subject: base.memberId });

  const supplierId = await asOwner.mutation(api.logistics.createLogisticsSupplier, {
    tenantId: base.tenantId,
    name: "Vetreria Rossi Srl",
    phone: "+39 02 1234567",
  });
  const suppliers = await asOwner.query(api.logistics.listLogisticsSuppliers, { tenantId: base.tenantId });
  expect(suppliers).toHaveLength(1);
  expect(suppliers[0].name).toBe("Vetreria Rossi Srl");

  // Base plan: maxLogisticsSuppliers = 1 — a 2nd one is rejected.
  await expect(
    asOwner.mutation(api.logistics.createLogisticsSupplier, { tenantId: base.tenantId, name: "Fornitore 2" }),
  ).rejects.toThrow("LOGISTICS_SUPPLIER_QUOTA_EXCEEDED");

  // A plain member can read but not manage (create/delete require admin+).
  await expect(
    asMember.mutation(api.logistics.createCarrier, { tenantId: base.tenantId, name: "Corriere Espresso" }),
  ).rejects.toThrow("INSUFFICIENT_ROLE");

  const carrierId = await asOwner.mutation(api.logistics.createCarrier, {
    tenantId: base.tenantId,
    name: "Corriere Espresso",
  });
  expect((await asMember.query(api.logistics.listCarriers, { tenantId: base.tenantId }))[0]._id).toBe(carrierId);

  // A second tenant's owner must never see the first tenant's rows.
  const other = await seedTenant(t, { plan: "agency" });
  const asOtherOwner = t.withIdentity({ subject: other.ownerId });
  expect(await asOtherOwner.query(api.logistics.listLogisticsSuppliers, { tenantId: other.tenantId })).toEqual([]);
  expect(await asOtherOwner.query(api.logistics.listCarriers, { tenantId: other.tenantId })).toEqual([]);

  // Deleting a supplier/carrier still referenced by a delivery is refused.
  const deliveryId = await asOwner.mutation(api.logistics.createDelivery, {
    tenantId: base.tenantId,
    supplierId,
    carrierId,
    scheduledDate: Date.now() + 86400000,
  });
  expect(deliveryId).toBeTruthy();
  await expect(asOwner.mutation(api.logistics.deleteLogisticsSupplier, { supplierId })).rejects.toThrow(
    "SUPPLIER_HAS_DELIVERIES",
  );
  await expect(asOwner.mutation(api.logistics.deleteCarrier, { carrierId })).rejects.toThrow("CARRIER_HAS_DELIVERIES");
});

test("logistics: marking a delivery received creates inventory items piece by piece (bidirectional link)", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  const supplierId = await asOwner.mutation(api.logistics.createLogisticsSupplier, {
    tenantId: seeded.tenantId,
    name: "Vetreria Rossi",
  });

  const cantiereId = await t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId: seeded.tenantId,
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

  const deliveryId = await asOwner.mutation(api.logistics.createDelivery, {
    tenantId: seeded.tenantId,
    supplierId,
    scheduledDate: Date.now() + 86400000,
    cantiereId,
    expectedItems: ["Finestra 1200x1400 PVC", "Finestra 900x1300 PVC", "Portafinestra 1500x2100"],
  });

  const before = await asOwner.query(api.logistics.listInventoryItems, { tenantId: seeded.tenantId });
  expect(before).toHaveLength(0);

  const result = await asOwner.mutation(api.logistics.markDeliveryReceived, { deliveryId });
  expect(result.itemsCreated).toBe(3);

  const items = await asOwner.query(api.logistics.listInventoryItems, { tenantId: seeded.tenantId });
  expect(items).toHaveLength(3);
  expect(items.every((i) => i.status === "in_stock")).toBe(true);
  expect(items.every((i) => i.cantiereId === cantiereId)).toBe(true);
  expect(items.map((i) => i.label).sort()).toEqual(
    ["Finestra 1200x1400 PVC", "Finestra 900x1300 PVC", "Portafinestra 1500x2100"].sort(),
  );

  const deliveries = await asOwner.query(api.logistics.listDeliveries, { tenantId: seeded.tenantId });
  expect(deliveries[0].status).toBe("received");
  expect(deliveries[0].receivedByUserId).toBe(seeded.ownerId);

  // Idempotent: marking an already-received delivery again creates nothing more.
  const again = await asOwner.mutation(api.logistics.markDeliveryReceived, { deliveryId });
  expect(again.itemsCreated).toBe(0);
  expect(await asOwner.query(api.logistics.listInventoryItems, { tenantId: seeded.tenantId })).toHaveLength(3);

  // Received deliveries can't be silently deleted or re-flipped to another status.
  await expect(asOwner.mutation(api.logistics.deleteDelivery, { deliveryId })).rejects.toThrow(
    "CANNOT_DELETE_RECEIVED_DELIVERY",
  );
  await expect(
    asOwner.mutation(api.logistics.updateDelivery, { deliveryId, status: "received" }),
  ).rejects.toThrow("USE_MARK_RECEIVED");

  // Moving an inventory item to "installed" for a different tenant's cantiere is refused.
  const other = await seedTenant(t, { plan: "base" });
  const otherCantiereId = await t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId: other.tenantId,
      name: "Altro",
      address: "x",
      city: "x",
      postalCode: "00000",
      status: "preventivo",
      priority: "low",
      assignedUserIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  await expect(
    asOwner.mutation(api.logistics.updateInventoryItem, { itemId: items[0]._id, cantiereId: otherCantiereId }),
  ).rejects.toThrow("CANTIERE_NOT_FOUND");
});

test("logistics: dashboard summary counts upcoming/received/in-stock correctly", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "agency" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const supplierId = await asOwner.mutation(api.logistics.createLogisticsSupplier, {
    tenantId: seeded.tenantId,
    name: "S1",
  });

  const soonId = await asOwner.mutation(api.logistics.createDelivery, {
    tenantId: seeded.tenantId,
    supplierId,
    scheduledDate: Date.now() + 2 * 86400000,
    expectedItems: ["Pezzo A"],
  });
  await asOwner.mutation(api.logistics.createDelivery, {
    tenantId: seeded.tenantId,
    supplierId,
    scheduledDate: Date.now() + 30 * 86400000, // outside the 7-day window
  });
  await asOwner.mutation(api.logistics.markDeliveryReceived, { deliveryId: soonId });

  const summary = await asOwner.query(api.logistics.getLogisticsSummary, { tenantId: seeded.tenantId });
  // soonId is now "received", not "scheduled" — only the far-future one would
  // count as upcoming, but it's outside the 7-day window, so 0.
  expect(summary.upcomingDeliveries7d).toBe(0);
  expect(summary.receivedThisMonth).toBe(1);
  expect(summary.itemsInStock).toBe(1);
});
