import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "CRM_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const quote = (over: Record<string, unknown> = {}) =>
    asOwner.mutation(api.quotes.createFieldQuote, {
      tenantId: seeded.tenantId,
      configuratorId,
      leadName: "Mario Rossi",
      leadEmail: "mario.rossi@example.com",
      leadPhone: "+39 333 1234567",
      customerAddress: "Via Roma 12",
      customerCity: "Prato",
      customerPostalCode: "59100",
      items: [sampleItem],
      vatRatePercent: 22,
      ...over,
    });
  const clients = () => t.run((ctx) => ctx.db.query("clients").collect());
  const cantieri = () => t.run((ctx) => ctx.db.query("cantieri").collect());
  return { t, seeded, configuratorId, asOwner, quote, clients, cantieri };
}

describe("B2B quote → client and cantiere", () => {
  test("a quote with a new customer creates the client and the cantiere, linked on both sides", async () => {
    const { t, quote, clients, cantieri } = await setup();
    const { quoteId } = await quote();
    const [c] = await clients();
    const [site] = await cantieri();
    expect(c).toMatchObject({ name: "Mario Rossi", email: "mario.rossi@example.com", siteAddress: "Via Roma 12", siteCity: "Prato", status: "prospect", type: "private" });
    expect(site).toMatchObject({ address: "Via Roma 12", city: "Prato", postalCode: "59100", clientId: c._id, quoteId, status: "preventivo" });
    const q = await t.run((ctx) => ctx.db.get(quoteId));
    expect(q).toMatchObject({ clientId: c._id, cantiereId: site._id });
    expect(site.valueCents).toBe(q!.priceExVatCents);
  });

  test("the same customer and address again reuses both — no duplicates, the site adds up its quotes", async () => {
    const { t, quote, clients, cantieri } = await setup();
    const a = await quote();
    const b = await quote({ leadName: "mario  ROSSI", customerAddress: "via roma, 12" });
    expect(await clients()).toHaveLength(1);
    expect(await cantieri()).toHaveLength(1);
    const [site] = await cantieri();
    const qa = await t.run((ctx) => ctx.db.get(a.quoteId));
    const qb = await t.run((ctx) => ctx.db.get(b.quoteId));
    expect(qb?.cantiereId).toBe(qa?.cantiereId);
    expect(site.valueCents).toBe(qa!.priceExVatCents + qb!.priceExVatCents);
  });

  test("a second address of the same client makes a second cantiere; a different e-mail with the same name is another person", async () => {
    const { quote, clients, cantieri } = await setup();
    await quote();
    await quote({ customerAddress: "Via Verdi 3" });
    expect(await clients()).toHaveLength(1);
    expect(await cantieri()).toHaveLength(2);
    await quote({ leadEmail: "altro.mario@example.com", leadPhone: undefined });
    expect(await clients()).toHaveLength(2);
  });

  test("an existing client is found by e-mail, VAT number or phone and only its blanks are filled", async () => {
    const { t, seeded, quote, clients } = await setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("clients", { tenantId: seeded.tenantId, name: "Rossi Costruzioni", email: "mario.rossi@example.com", type: "company", tags: [], status: "lead", createdAt: 1, updatedAt: 1 }),
    );
    await quote({ leadName: "Mario Rossi" });
    const all = await clients();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ _id: id, name: "Rossi Costruzioni", phone: "+39 333 1234567", siteAddress: "Via Roma 12", status: "prospect" });
    // by phone, written differently
    await quote({ leadName: "Altro Nome", leadEmail: "", leadPhone: "3331234567", customerAddress: undefined });
    expect(await clients()).toHaveLength(1);
  });

  test("a picked client or cantiere is respected; without an address no cantiere is invented", async () => {
    const { t, seeded, quote, clients, cantieri } = await setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("clients", { tenantId: seeded.tenantId, name: "Scelto Srl", type: "company", tags: [], status: "active", createdAt: 1, updatedAt: 1 }),
    );
    const { quoteId } = await quote({ clientId: id, leadName: "Qualcun Altro", leadEmail: "x@example.com", customerAddress: undefined });
    expect(await clients()).toHaveLength(1);
    expect(await cantieri()).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.clientId).toBe(id);
  });

  test("autoLink: false leaves the directory alone", async () => {
    const { quote, clients, cantieri } = await setup();
    await quote({ autoLink: false });
    expect(await clients()).toHaveLength(0);
    expect(await cantieri()).toHaveLength(0);
  });

  test("winning the quote makes the client active and the site confirmed; losing it removes it from the site's value", async () => {
    const { asOwner, quote, clients, cantieri } = await setup();
    const a = await quote();
    const b = await quote();
    await asOwner.mutation(api.quotes.updateStatus, { quoteId: a.quoteId, status: "won" });
    expect((await clients())[0].status).toBe("active");
    const [site] = await cantieri();
    expect(site.status).toBe("confermato");
    const both = site.valueCents!;
    await asOwner.mutation(api.quotes.updateStatus, { quoteId: b.quoteId, status: "lost" });
    expect((await cantieri())[0].valueCents).toBeLessThan(both);
  });

  test("a quote from the widget becomes a client only once the installer engages, never while its contacts are locked", async () => {
    const { t, seeded, configuratorId, asOwner, clients } = await setup();
    const quoteId = await t.run((ctx) =>
      ctx.db.insert("quoteRequests", {
        tenantId: seeded.tenantId, configuratorId, catalogVersion: 1, publicId: "CRM_01", leadName: "Lead Web", leadEmail: "web@example.com", leadLocale: "it",
        channel: "widget", items: [], priceCents: 12200, priceExVatCents: 10000, vatRatePercent: 22, currency: "EUR", status: "new",
      }),
    );
    expect(await clients()).toHaveLength(0);
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "contacted" });
    expect((await clients())[0]).toMatchObject({ name: "Lead Web", source: "widget", status: "prospect" });
  });
});

describe("edits flow both ways", () => {
  test("editing the client updates its open quotes and unfinished supplies, not the signed ones", async () => {
    const { t, asOwner, quote, clients } = await setup();
    const open = await quote({ customerAddress: undefined });
    const signed = await quote({ customerAddress: undefined });
    await asOwner.mutation(api.quotes.signQuote, { quoteId: signed.quoteId, signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", signedByName: "Mario Rossi" });
    const [c] = await clients();
    await asOwner.mutation(api.clients.updateClient, { clientId: c._id, name: "Mario Rossi Srl", phone: "+39 340 0000000" });
    expect(await t.run((ctx) => ctx.db.get(open.quoteId))).toMatchObject({ leadName: "Mario Rossi Srl", leadPhone: "+39 340 0000000" });
    expect((await t.run((ctx) => ctx.db.get(signed.quoteId)))?.leadName).toBe("Mario Rossi");
  });

  test("editing the cantiere's address reaches the open quotes; handing it to another client moves its quotes", async () => {
    const { t, seeded, asOwner, quote, cantieri } = await setup();
    const a = await quote();
    const [site] = await cantieri();
    await asOwner.mutation(api.cantieri.updateCantiere, { cantiereId: site._id, address: "Via Nuova 99", city: "Firenze" });
    expect(await t.run((ctx) => ctx.db.get(a.quoteId))).toMatchObject({ customerAddress: "Via Nuova 99", customerCity: "Firenze" });
    const other = await t.run((ctx) => ctx.db.insert("clients", { tenantId: seeded.tenantId, name: "Nuovo Cliente", type: "private", tags: [], status: "active", createdAt: 1, updatedAt: 1 }));
    await asOwner.mutation(api.cantieri.updateCantiere, { cantiereId: site._id, clientId: other });
    expect((await t.run((ctx) => ctx.db.get(a.quoteId)))?.clientId).toBe(other);
  });

  test("a cantiere created for a quote links the quote back, and deleting it unlinks instead of orphaning", async () => {
    const { t, seeded, asOwner, quote } = await setup();
    const { quoteId } = await quote({ autoLink: false });
    const cantiereId = await asOwner.mutation(api.cantieri.createCantiere, { tenantId: seeded.tenantId, name: "Villa", address: "Via 1", city: "Prato", postalCode: "59100", quoteId });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.cantiereId).toBe(cantiereId);
    await asOwner.mutation(api.cantieri.deleteCantiere, { cantiereId });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.cantiereId).toBeUndefined();
  });

  test("a cantiere with goods in logistics cannot be deleted", async () => {
    const { t, seeded, asOwner, quote, cantieri } = await setup();
    await quote();
    const [site] = await cantieri();
    await t.run((ctx) => ctx.db.insert("inventoryItems", { tenantId: seeded.tenantId, label: "x", quantity: 1, unit: "pz", cantiereId: site._id, status: "in_stock", receivedAt: 1, createdAt: 1, updatedAt: 1 }));
    await expect(asOwner.mutation(api.cantieri.deleteCantiere, { cantiereId: site._id })).rejects.toThrow(/CANTIERE_HAS_LOGISTICS/);
  });
});

describe("supply follows the same folder", () => {
  test("a supply carries the quote's client and cantiere and moves the site's stage forward only", async () => {
    const { t, asOwner, quote, cantieri } = await setup();
    const { quoteId } = await quote();
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    const [s0] = await t.run((ctx) => ctx.db.query("supplies").collect());
    const [site] = await cantieri();
    expect(s0).toMatchObject({ cantiereId: site._id, clientId: site.clientId });
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    expect((await cantieri())[0].status).toBe("confermato");
    const factory = await asOwner.mutation(api.supplies.createPartner, { tenantId: s0.tenantId, name: "Winarhi Srl", roles: ["producer"] });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 1000, producerId: factory });
    expect((await cantieri())[0].status).toBe("in_produzione");
    // a site already in posa is never pulled back
    await asOwner.mutation(api.cantieri.updateCantiere, { cantiereId: site._id, status: "in_posa" });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, transportCostCents: 0 });
    expect((await cantieri())[0].status).toBe("in_posa");
  });

  test("backfill gives old quotes their client and cantiere and points their supplies at them", async () => {
    const { t, seeded, asOwner, quote, clients, cantieri } = await setup();
    const { quoteId } = await quote({ autoLink: false });
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "quoted" }); // links on engagement already…
    // …so start from a clean slate: wipe the links to imitate data written before the feature existed
    await t.run(async (ctx) => {
      await ctx.db.patch(quoteId, { clientId: undefined, cantiereId: undefined });
      for (const x of await ctx.db.query("clients").collect()) await ctx.db.delete(x._id);
      for (const x of await ctx.db.query("cantieri").collect()) await ctx.db.delete(x._id);
    });
    const supplyId = await asOwner.mutation(api.supplies.createFromQuote, { quoteId }); // links again, but then:
    await t.run(async (ctx) => {
      await ctx.db.patch(quoteId, { clientId: undefined, cantiereId: undefined });
      await ctx.db.patch(supplyId, { clientId: undefined, cantiereId: undefined });
      for (const x of await ctx.db.query("clients").collect()) await ctx.db.delete(x._id);
      for (const x of await ctx.db.query("cantieri").collect()) await ctx.db.delete(x._id);
    });
    const r = await asOwner.mutation(api.crm.backfillFromQuotes, { tenantId: seeded.tenantId });
    expect(r).toMatchObject({ clientsCreated: 1, cantieriCreated: 1 });
    const [c] = await clients();
    const [site] = await cantieri();
    expect(await t.run((ctx) => ctx.db.get(supplyId))).toMatchObject({ clientId: c._id, cantiereId: site._id });
    const again = await asOwner.mutation(api.crm.backfillFromQuotes, { tenantId: seeded.tenantId });
    expect(again).toMatchObject({ clientsCreated: 0, cantieriCreated: 0 });
  });
});

describe("one supplier, three directories", () => {
  test("a partner appears in Logistica; a Logistica supplier appears in Fornitura; edits go both ways; no duplicates", async () => {
    const { t, seeded, asOwner } = await setup();
    const tenantId = seeded.tenantId;
    const partnerId = await asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Winarhi Srl", roles: ["producer"], email: "info@winarhi.example" });
    let logistics = await asOwner.query(api.logistics.listLogisticsSuppliers, { tenantId });
    expect(logistics).toHaveLength(1);
    expect(logistics[0]).toMatchObject({ name: "Winarhi Srl", partnerId });

    // same company created by hand in Logistica: adopted, not duplicated
    await asOwner.mutation(api.logistics.createLogisticsSupplier, { tenantId, name: "winarhi srl", email: "info@winarhi.example" });
    expect(await asOwner.query(api.supplies.listPartners, { tenantId })).toHaveLength(1);

    // a brand-new Logistica supplier becomes a partner (deliverer)
    const trucker = await asOwner.mutation(api.logistics.createLogisticsSupplier, { tenantId, name: "Trasporti Neri", phone: "+39 055 111222" });
    const partners = await asOwner.query(api.supplies.listPartners, { tenantId });
    expect(partners).toHaveLength(2);
    expect(partners.find((p) => p.name === "Trasporti Neri")?.roles).toEqual(["deliverer"]);

    // edits flow in both directions
    await asOwner.mutation(api.supplies.updatePartner, { partnerId, name: "Winarhi Group", roles: ["producer", "deliverer"], email: "info@winarhi.example" });
    logistics = await asOwner.query(api.logistics.listLogisticsSuppliers, { tenantId });
    expect(logistics.find((l) => l.partnerId === partnerId)?.name).toBe("Winarhi Group");
    await asOwner.mutation(api.logistics.updateLogisticsSupplier, { supplierId: trucker, name: "Trasporti Neri Spa" });
    expect((await asOwner.query(api.supplies.listPartners, { tenantId })).some((p) => p.name === "Trasporti Neri Spa")).toBe(true);
    void t;
  });

  test("a price-source supplier is linked to the same company, and the directory sync fixes accounts that had them apart", async () => {
    const { t, seeded, asOwner } = await setup();
    const tenantId = seeded.tenantId;
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("supplyPartners", { tenantId, name: "Fabbrica Uno", roles: ["producer"], createdAt: now, updatedAt: now });
      await ctx.db.insert("logisticsSuppliers", { tenantId, name: "Fabbrica Uno", createdAt: now, updatedAt: now });
      await ctx.db.insert("logisticsSuppliers", { tenantId, name: "Corriere Solo", createdAt: now, updatedAt: now });
    });
    const r = await asOwner.mutation(api.crm.syncSupplierDirectories, { tenantId });
    expect(r.linked).toBeGreaterThan(0);
    expect(await asOwner.query(api.supplies.listPartners, { tenantId })).toHaveLength(2); // Fabbrica Uno adopted, Corriere Solo created
    const again = await asOwner.mutation(api.crm.syncSupplierDirectories, { tenantId });
    expect(again.linked).toBe(0);
  });
});

describe("supply ↔ logistics shipment", () => {
  async function toDelivery() {
    const ctx = await setup();
    const { asOwner, seeded, quote } = ctx;
    const { quoteId } = await quote();
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    const factory = await asOwner.mutation(api.supplies.createPartner, { tenantId: seeded.tenantId, name: "Winarhi Srl", roles: ["producer", "deliverer"] });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 1000, producerId: factory });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, transportCostCents: 500, delivererId: factory });
    return { ...ctx, id, quoteId, factory };
  }

  test("reaching Consegna opens a shipment from the supplier for the quote's pieces, towards the cantiere", async () => {
    const { asOwner, seeded, id, quoteId, cantieri } = await toDelivery();
    const rows = await asOwner.query(api.logistics.listDeliveries, { tenantId: seeded.tenantId });
    expect(rows).toHaveLength(1);
    const [site] = await cantieri();
    expect(rows[0]).toMatchObject({ supplyId: id, quoteId, cantiereId: site._id, status: "scheduled" });
    expect(rows[0].expectedItems?.length).toBeGreaterThan(0);
    const supplier = (await asOwner.query(api.logistics.listLogisticsSuppliers, { tenantId: seeded.tenantId })).find((l) => l._id === rows[0].supplierId);
    expect(supplier?.name).toBe("Winarhi Srl");
  });

  test("receiving the shipment in Logistica delivers the supply; delivering the supply receives the shipment — never stock twice", async () => {
    const a = await toDelivery();
    const [d] = await a.asOwner.query(api.logistics.listDeliveries, { tenantId: a.seeded.tenantId });
    await a.asOwner.mutation(api.logistics.markDeliveryReceived, { deliveryId: d._id });
    expect((await a.asOwner.query(api.supplies.list, { tenantId: a.seeded.tenantId }))[0].status).toBe("delivered");
    const stock = await a.asOwner.query(api.logistics.listInventoryItems, { tenantId: a.seeded.tenantId });
    expect(stock.length).toBeGreaterThan(0);

    const b = await toDelivery();
    await b.asOwner.mutation(api.supplies.advance, { supplyId: b.id });
    const [d2] = await b.asOwner.query(api.logistics.listDeliveries, { tenantId: b.seeded.tenantId });
    expect(d2.status).toBe("received");
    const stockB = await b.asOwner.query(api.logistics.listInventoryItems, { tenantId: b.seeded.tenantId });
    expect(stockB).toHaveLength(d2.expectedItems!.length);
  });

  test("reverting the supply takes the shipment back, unless its goods already left the warehouse", async () => {
    const a = await toDelivery();
    await a.asOwner.mutation(api.supplies.revert, { supplyId: a.id });
    expect(await a.asOwner.query(api.logistics.listDeliveries, { tenantId: a.seeded.tenantId })).toHaveLength(0);

    const b = await toDelivery();
    await b.asOwner.mutation(api.supplies.advance, { supplyId: b.id }); // delivered + stocked
    const [item] = await b.asOwner.query(api.logistics.listInventoryItems, { tenantId: b.seeded.tenantId });
    await b.asOwner.mutation(api.logistics.updateInventoryItem, { itemId: item._id, status: "in_transit" });
    await expect(b.asOwner.mutation(api.supplies.revert, { supplyId: b.id })).rejects.toThrow(/SUPPLY_DELIVERY_STOCK_MOVED/);
  });
});
