import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, sampleItem, seedPublishedConfigurator, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const options = { regionCode: "IT" as const, buildingAge: 20, isEnergyRenovation: true, deductionPercent: 50 };

async function setup() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "agency" });
  const as = t.withIdentity({ subject: s.ownerId });
  const older = await seedPublishedConfigurator(t, s.tenantId, "OLDER00001");
  await t.run((ctx) => ctx.db.patch(older, { name: "Vecchio", publishedAt: 1_000 }));
  const newer = await seedPublishedConfigurator(t, s.tenantId, "NEWER00001");
  await t.run((ctx) => ctx.db.patch(newer, { name: "Nuovo", publishedAt: 2_000 }));
  return { t, s, as, older, newer };
}

describe("showroom: choosing the configurator", () => {
  test("without a choice it uses the most recently published; with one it uses that configurator", async () => {
    const { s, as, older, newer } = await setup();
    const def = await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId });
    expect(def.ready && def.configuratorId).toBe(newer);
    expect(def.ready && def.configuratorName).toBe("Nuovo");
    const chosen = await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId, configuratorId: older });
    expect(chosen.ready && chosen.configuratorId).toBe(older);
    expect(chosen.ready && chosen.configuratorName).toBe("Vecchio");
  });

  test("a draft, another tenant's configurator or one being deleted is not available", async () => {
    const { t, s, as, older } = await setup();
    const draft = await t.run((ctx) => ctx.db.insert("configurators", { tenantId: s.tenantId, publicId: "DRAFT00001", name: "Bozza", status: "draft", allowedOrigins: [], defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR" }));
    expect((await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId, configuratorId: draft })).ready).toBe(false);

    const other = await seedTenant(t, { plan: "agency" });
    const foreign = await seedPublishedConfigurator(t, other.tenantId, "FOREIGN001");
    expect((await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId, configuratorId: foreign })).ready).toBe(false);
    await expect(as.query(api.calculations.getCalculationPreview, { tenantId: s.tenantId, configuratorId: foreign, items: [sampleItem], options })).rejects.toThrow();

    await t.run((ctx) => ctx.db.patch(older, { deletingAt: Date.now() }));
    expect((await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId, configuratorId: older })).ready).toBe(false);
  });

  test("the price preview follows the chosen configurator's catalogue", async () => {
    const { t, s, as, older, newer } = await setup();
    // Make the older catalogue twice as expensive: same piece, different price.
    await t.run(async (ctx) => {
      const v = await ctx.db.query("catalogVersions").withIndex("by_configurator_version", (q) => q.eq("configuratorId", older).eq("version", 1)).unique();
      const payload = v!.payload as { materials: Array<{ basePerM2Cents: number }> };
      payload.materials[0].basePerM2Cents *= 2;
      await ctx.db.patch(v!._id, { payload });
    });
    const a = await as.query(api.calculations.getCalculationPreview, { tenantId: s.tenantId, configuratorId: newer, items: [sampleItem], options });
    const b = await as.query(api.calculations.getCalculationPreview, { tenantId: s.tenantId, configuratorId: older, items: [sampleItem], options });
    expect(b.priceCents).toBeGreaterThan(a.priceCents);
    const def = await as.query(api.calculations.getCalculationPreview, { tenantId: s.tenantId, items: [sampleItem], options });
    expect(def.priceCents).toBe(a.priceCents);
  });
});

describe("deleting a configurator", () => {
  test("it disappears from the list at once and its data is purged, nothing else is touched", async () => {
    const { t, s, as } = await setup();
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Da eliminare" });
    const keep = (await t.run((ctx) => ctx.db.query("configurators").collect())).find((c) => c.publicId === "NEWER00001")!;
    const countFor = (id: typeof configuratorId) =>
      t.run(async (ctx) => {
        let n = 0;
        for (const table of ["catalogMaterials", "catalogGlazingOptions", "catalogFinishOptions", "catalogFrameTypes", "catalogAccessories", "catalogHardwareOptions", "catalogProfileSystems", "catalogQualityTiers", "catalogSizeConstraints", "catalogProductBase", "branding"] as const) {
          n += (await ctx.db.query(table).withIndex("by_configurator", (q) => q.eq("configuratorId", id)).collect()).length;
        }
        return n;
      });
    expect(await countFor(configuratorId)).toBeGreaterThan(100);

    await as.mutation(api.configurators.deleteConfigurator, { configuratorId });
    const list = await as.query(api.configurators.listConfigurators, { tenantId: s.tenantId });
    expect(list.map((c) => c._id)).not.toContain(configuratorId);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(configuratorId))).toBeNull();
    expect(await countFor(configuratorId)).toBe(0);
    // The other configurator is intact.
    expect(await t.run((ctx) => ctx.db.get(keep._id))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.query("catalogVersions").collect())).toHaveLength(2);
  });

  test("a published configurator stops serving its widget immediately", async () => {
    const { t, s, as, newer } = await setup();
    expect(await t.query(api.widget.getPublicConfigurator, { publicId: "NEWER00001" })).not.toBeNull();
    await as.mutation(api.configurators.deleteConfigurator, { configuratorId: newer });
    expect(await t.query(api.widget.getPublicConfigurator, { publicId: "NEWER00001" })).toBeNull();
    const cat = await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId });
    expect(cat.ready && cat.configuratorName).toBe("Vecchio");
  });

  test("refused while it has customer requests; the configurator stays untouched", async () => {
    const { t, s, as, newer } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("quoteRequests", { tenantId: s.tenantId, configuratorId: newer, catalogVersion: 1, publicId: "NEWER00001", leadName: "Mario", leadEmail: "m@example.com", leadLocale: "it", items: [{ width: 1200, height: 1400 }], priceCents: 100, priceExVatCents: 80, vatRatePercent: 22, currency: "EUR" as const, status: "new" as const }),
    );
    await expect(as.mutation(api.configurators.deleteConfigurator, { configuratorId: newer })).rejects.toThrow(/CONFIGURATOR_HAS_REQUESTS/);
    const row = await t.run((ctx) => ctx.db.get(newer));
    expect(row?.status).toBe("published");
    expect(row?.deletingAt).toBeUndefined();
  });

  test("only someone who may manage configurators, only in their own tenant; repeating is harmless", async () => {
    const { t, s, as, older } = await setup();
    const other = await seedTenant(t, { plan: "agency" });
    await expect(t.withIdentity({ subject: other.ownerId }).mutation(api.configurators.deleteConfigurator, { configuratorId: older })).rejects.toThrow();
    await expect(t.withIdentity({ subject: s.memberId }).mutation(api.configurators.deleteConfigurator, { configuratorId: older })).rejects.toThrow();
    await as.mutation(api.configurators.deleteConfigurator, { configuratorId: older });
    await expect(as.mutation(api.configurators.deleteConfigurator, { configuratorId: older })).resolves.toEqual({ deleted: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(as.mutation(api.configurators.deleteConfigurator, { configuratorId: older })).rejects.toThrow(/CONFIGURATOR_NOT_FOUND/);
  });

  test("the quota it used is freed", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "starter" });
    const as = t.withIdentity({ subject: s.ownerId });
    let created = 0;
    let lastId: unknown;
    for (let i = 0; i < 6; i++) {
      try {
        const r = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: `Config ${i}` });
        lastId = r.configuratorId;
        created++;
      } catch {
        break;
      }
    }
    if (created < 6) {
      await expect(as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Oltre il limite" })).rejects.toThrow(/QUOTA/);
      await as.mutation(api.configurators.deleteConfigurator, { configuratorId: lastId as never });
      await expect(as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Dopo eliminazione" })).resolves.toBeTruthy();
    }
    expect(created).toBeGreaterThan(0);
  });

  test("the purge handles more rows than one batch by rescheduling itself", async () => {
    const { t, s, as } = await setup();
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Molto grande" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 1000; i++) {
        await ctx.db.insert("catalogAccessories", { tenantId: s.tenantId, configuratorId, category: "zanz", key: `x${i}`, labels: { it: "x" }, priceCents: 0, priceModel: "flat" as const, sortOrder: i, enabled: true });
      }
    });
    await as.mutation(api.configurators.deleteConfigurator, { configuratorId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(configuratorId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("catalogAccessories").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect())).toHaveLength(0);
  });
});
