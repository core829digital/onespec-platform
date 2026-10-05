import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";

async function setup() {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "SUP_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const asMember = t.withIdentity({ subject: seeded.memberId });
  const q = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId, configuratorId, leadName: "Giuseppe Verdi", leadEmail: "giuseppe.verdi@gmail.com", items: [sampleItem], vatRatePercent: 22,
  });
  return { t, seeded, configuratorId, asOwner, asMember, quoteId: q.quoteId };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("supply flow", () => {
  test("full flow quote → order → production → delivery → delivered, with the profit computed on net amounts", async () => {
    const { seeded, asOwner, quoteId } = await setup();
    const tenantId = seeded.tenantId;

    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    let [s] = await asOwner.query(api.supplies.list, { tenantId });
    expect(s.status).toBe("quote");
    const revenue = s.revenueExVatCents;
    expect(revenue).toBeGreaterThan(0);

    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    [s] = await asOwner.query(api.supplies.list, { tenantId });
    expect(s.status).toBe("order");
    expect((await asOwner.query(api.quotes.getRequest, { quoteId }))?.status).toBe("won");

    // production needs the factory price
    await expect(asOwner.mutation(api.supplies.advance, { supplyId: id })).rejects.toThrow(/VALIDATION_REQUIRED/);
    await expect(asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: -5 })).rejects.toThrow(/SUPPLY_INVALID_AMOUNT/);
    const factory = await asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Winarhi Srl", roles: ["producer", "deliverer"] });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 30000, producerId: factory });
    await asOwner.mutation(api.supplies.setFactoryPaid, { supplyId: id, paid: true });

    await asOwner.mutation(api.supplies.advance, { supplyId: id, transportCostCents: 2000, delivererId: factory });
    await asOwner.mutation(api.supplies.updateCosts, { supplyId: id, otherCostsCents: 1000 });
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    [s] = await asOwner.query(api.supplies.list, { tenantId });
    expect(s.status).toBe("delivered");
    expect(s.factoryPaidAt).toBeDefined();
    expect(s.profitCents).toBe(revenue - 30000 - 2000 - 1000);
    await expect(asOwner.mutation(api.supplies.advance, { supplyId: id })).rejects.toThrow(/SUPPLY_ALREADY_DELIVERED/);

    const p = await asOwner.query(api.supplies.profit, { tenantId });
    expect(p.windows.map((w) => w.months)).toEqual([1, 3, 6, 12, 24, 36, 60, 120]);
    for (const w of p.windows) {
      expect(w.count).toBe(1);
      expect(w.netProfitCents).toBe(revenue - 33000);
    }
    expect(p.expected.count).toBe(0);
  });

  test("one supply per quote; open supplies appear as expected profit, not as realised", async () => {
    const { seeded, asOwner, quoteId } = await setup();
    const tenantId = seeded.tenantId;
    expect((await asOwner.query(api.supplies.quotesWithoutSupply, { tenantId })).map((q) => q._id)).toContain(quoteId);
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    await expect(asOwner.mutation(api.supplies.createFromQuote, { quoteId })).rejects.toThrow(/SUPPLY_ALREADY_EXISTS/);
    expect(await asOwner.query(api.supplies.quotesWithoutSupply, { tenantId })).toEqual([]);
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    const p = await asOwner.query(api.supplies.profit, { tenantId });
    expect(p.windows.every((w) => w.count === 0)).toBe(true);
    expect(p.expected.count).toBe(1);
  });

  test("winning the quote (status or signature) puts its supply at Ordine, idempotently", async () => {
    const { seeded, asOwner, quoteId } = await setup();
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" });
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" });
    const rows = await asOwner.query(api.supplies.list, { tenantId: seeded.tenantId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("order");
    expect(rows[0].orderedAt).toBeDefined();
  });

  test("a supply that already moved on is not pushed back by a new 'won'", async () => {
    const { seeded, asOwner, quoteId } = await setup();
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 100 });
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" });
    expect((await asOwner.query(api.supplies.list, { tenantId: seeded.tenantId }))[0].status).toBe("production");
  });

  test("lost / spam quotes cannot start a supply", async () => {
    const { asOwner, quoteId } = await setup();
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "lost" });
    await expect(asOwner.mutation(api.supplies.createFromQuote, { quoteId })).rejects.toThrow(/SUPPLY_QUOTE_NOT_USABLE/);
  });

  test("revert (admin only) clears the stage data; delete only before production", async () => {
    const { seeded, asOwner, asMember, quoteId } = await setup();
    const tenantId = seeded.tenantId;
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    await asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 500 });
    await expect(asMember.mutation(api.supplies.revert, { supplyId: id })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asOwner.mutation(api.supplies.remove, { supplyId: id })).rejects.toThrow(/SUPPLY_CANNOT_DELETE/);
    await asOwner.mutation(api.supplies.revert, { supplyId: id });
    const [s] = await asOwner.query(api.supplies.list, { tenantId });
    expect(s.status).toBe("order");
    expect(s.factoryCostCents).toBeUndefined();
    await asOwner.mutation(api.supplies.remove, { supplyId: id });
    expect(await asOwner.query(api.supplies.list, { tenantId })).toEqual([]);
  });

  test("costs cannot be set before their stage; partners must have the right role and belong to the tenant", async () => {
    const { t, seeded, asOwner, quoteId } = await setup();
    const tenantId = seeded.tenantId;
    const id = await asOwner.mutation(api.supplies.createFromQuote, { quoteId });
    await expect(asOwner.mutation(api.supplies.updateCosts, { supplyId: id, factoryCostCents: 100 })).rejects.toThrow(/SUPPLY_STAGE_TOO_EARLY/);
    await expect(asOwner.mutation(api.supplies.setFactoryPaid, { supplyId: id, paid: true })).rejects.toThrow(/SUPPLY_STAGE_TOO_EARLY/);
    await asOwner.mutation(api.supplies.advance, { supplyId: id });
    const onlyDeliverer = await asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Trasporti Rossi", roles: ["deliverer"] });
    await expect(asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 100, producerId: onlyDeliverer })).rejects.toThrow(/SUPPLY_PARTNER_WRONG_ROLE/);
    const other = await seedTenant(t, { plan: "pro" });
    const foreign = await t.withIdentity({ subject: other.ownerId }).mutation(api.supplies.createPartner, { tenantId: other.tenantId, name: "Altra Fabbrica", roles: ["producer"] });
    await expect(asOwner.mutation(api.supplies.advance, { supplyId: id, factoryCostCents: 100, producerId: foreign })).rejects.toThrow(/SUPPLY_PARTNER_NOT_FOUND/);
    // another tenant cannot read or move this supply
    await expect(t.withIdentity({ subject: other.ownerId }).mutation(api.supplies.advance, { supplyId: id })).rejects.toThrow();
  });

  test("partner input is validated and sanitised", async () => {
    const { seeded, asOwner } = await setup();
    const tenantId = seeded.tenantId;
    await expect(asOwner.mutation(api.supplies.createPartner, { tenantId, name: "X", roles: ["producer"] })).rejects.toThrow(/VALIDATION_/);
    await expect(asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Fabbrica <b>", roles: ["producer"] })).rejects.toThrow(/VALIDATION_/);
    await expect(asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Fabbrica Bianchi", roles: [] })).rejects.toThrow(/SUPPLY_PARTNER_ROLE_REQUIRED/);
    await expect(asOwner.mutation(api.supplies.createPartner, { tenantId, name: "Fabbrica Bianchi", roles: ["producer"], email: "non-una-email" })).rejects.toThrow(/VALIDATION_/);
    const id = await asOwner.mutation(api.supplies.createPartner, { tenantId, name: "  Fabbrica   Bianchi  ", roles: ["deliverer", "producer", "producer"], email: "info@bianchi.it" });
    const [p] = (await asOwner.query(api.supplies.listPartners, { tenantId })).filter((x) => x._id === id);
    expect(p.name).toBe("Fabbrica Bianchi");
    expect(p.roles).toEqual(["producer", "deliverer"]);
  });
});
