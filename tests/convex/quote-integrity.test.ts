import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { calculatePrice, type CatalogPayload } from "../../src/shared/pricing";
import { PIECE_CATEGORIES } from "../../src/shared/configurator-model";
import { defaultItem } from "../../src/shared/item-defaults";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = {
  leadName: "Mario Rossi",
  leadEmail: "mario@example.com",
};

describe("field quote integrity", () => {
  test("pieces are validated server side; empty and malformed quotes are rejected", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "INTEG_0001");
    const as = t.withIdentity({ subject: s.ownerId });
    const args = { tenantId: s.tenantId, configuratorId, ...base };

    await expect(as.mutation(api.quotes.createFieldQuote, { ...args, items: [] })).rejects.toThrow();
    await expect(as.mutation(api.quotes.createFieldQuote, { ...args, items: "nope" })).rejects.toThrow();
    await expect(as.mutation(api.quotes.createFieldQuote, { ...args, items: [{ ...sampleItem, width: 50 }] })).rejects.toThrow();
    await expect(as.mutation(api.quotes.createFieldQuote, { ...args, items: [{ ...sampleItem, quantity: 0 }] })).rejects.toThrow();
    const ok = await as.mutation(api.quotes.createFieldQuote, { ...args, items: [sampleItem] });
    expect(ok.priceCents).toBeGreaterThan(0);
  });

  test("every quote gets its own offer number, per tenant and per year", async () => {
    const t = newDb();
    vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
    const a = await seedTenant(t, { plan: "pro" });
    const b = await seedTenant(t, { plan: "pro" });
    const cfgA = await seedPublishedConfigurator(t, a.tenantId, "INTEG_A001");
    const cfgB = await seedPublishedConfigurator(t, b.tenantId, "INTEG_B001");
    const asA = t.withIdentity({ subject: a.ownerId });
    const asB = t.withIdentity({ subject: b.ownerId });
    const make = (as: typeof asA, tenantId: typeof a.tenantId, configuratorId: typeof cfgA) =>
      as.mutation(api.quotes.createFieldQuote, { tenantId, configuratorId, ...base, items: [sampleItem] });

    const q1 = await make(asA, a.tenantId, cfgA);
    const q2 = await make(asA, a.tenantId, cfgA);
    const qb = await make(asB, b.tenantId, cfgB);
    const num = async (as: typeof asA, id: typeof q1.quoteId) => (await as.query(api.quotes.getRequest, { quoteId: id }))?.offerNumber;
    expect(await num(asA, q1.quoteId)).toBe("Q-2026-0001");
    expect(await num(asA, q2.quoteId)).toBe("Q-2026-0002");
    expect(await num(asB, qb.quoteId)).toBe("Q-2026-0001");

    vi.setSystemTime(new Date("2027-01-02T10:00:00Z"));
    const q3 = await make(asA, a.tenantId, cfgA);
    expect(await num(asA, q3.quoteId)).toBe("Q-2027-0001");
  });

  test("survey -> quote prices every opening from the tenant's real catalogue keys", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "INTEG_S001");
    const as = t.withIdentity({ subject: s.ownerId });
    const surveyId = await as.mutation(api.surveys.create, {
      tenantId: s.tenantId,
      customerName: "Cliente Rilievo",
      openings: [{ label: "Foro 1", widthMm: 1200, heightMm: 1400 }],
      diagnostics: {},
    });
    await as.mutation(api.surveys.completeSurvey, { surveyId });
    const r = await as.mutation(api.quotes.createFieldQuoteFromSurvey, { tenantId: s.tenantId, configuratorId, surveyId });
    expect(r.priceCents).toBeGreaterThan(0);
  });
});

describe("default pieces from a catalogue", () => {
  test("every category builds a piece that prices above zero", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "INTEG_D001");
    await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
    const st = (await t.withIdentity({ subject: s.ownerId }).query(api.configurators.getEditorState, { configuratorId }))!;
    const clean = (rows: object[]) => rows.map((r) => {
      const { _id, _creationTime, tenantId, configuratorId: _c, ...rest } = r as Record<string, unknown>;
      void _id; void _creationTime; void tenantId; void _c;
      return rest;
    });
    const payload = {
      configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
      branding: null,
      materials: clean(st.materials),
      qualityTiers: clean(st.qualityTiers),
      profileSystems: clean(st.profileSystems),
      sizeConstraints: clean(st.sizeConstraints),
      glazing: clean(st.glazing),
      finish: clean(st.finish),
      hardware: clean(st.hardware),
      frameTypes: clean(st.frameTypes),
      accessories: clean(st.accessories),
      productBase: clean(st.productBase),
    } as unknown as CatalogPayload;
    for (const category of PIECE_CATEGORIES) {
      const item = defaultItem(payload, category);
      expect(calculatePrice(payload, [item]).priceCents, category).toBeGreaterThan(0);
    }
  });
});

describe("supplier directory", () => {
  test("only plans with the multi-supplier entitlement can keep suppliers; names are de-duplicated", async () => {
    const t = newDb();
    const pro = await seedTenant(t, { plan: "pro" });
    const show = await seedTenant(t, { plan: "showroom" });
    const asPro = t.withIdentity({ subject: pro.ownerId });
    const asShow = t.withIdentity({ subject: show.ownerId });
    const asMember = t.withIdentity({ subject: show.memberId });

    expect((await asPro.query(api.suppliers.listSuppliers, { tenantId: pro.tenantId })).allowed).toBe(false);
    await expect(asPro.mutation(api.suppliers.createSupplier, { tenantId: pro.tenantId, name: "Vetro Tech" })).rejects.toThrow();
    await expect(asMember.mutation(api.suppliers.createSupplier, { tenantId: show.tenantId, name: "Vetro Tech" })).rejects.toThrow();

    const id = await asShow.mutation(api.suppliers.createSupplier, { tenantId: show.tenantId, name: "Vetro Tech", leadTimeDays: 10 });
    expect(await asShow.mutation(api.suppliers.createSupplier, { tenantId: show.tenantId, name: "  vetro tech " })).toBe(id);
    let list = await asShow.query(api.suppliers.listSuppliers, { tenantId: show.tenantId });
    expect(list.allowed).toBe(true);
    expect(list.suppliers).toHaveLength(1);
    expect(list.suppliers[0].leadTimeDays).toBe(10);

    await asShow.mutation(api.suppliers.setSupplierActive, { supplierId: id, isActive: false });
    list = await asShow.query(api.suppliers.listSuppliers, { tenantId: show.tenantId });
    expect(list.suppliers).toHaveLength(0);
  });
});
