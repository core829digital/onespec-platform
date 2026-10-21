import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, sampleItem, seedPublishedConfigurator, seedTenant } from "./_helpers";
import { STANDARD_PROFILES } from "../../src/shared/standard-pricing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup(zone: "nord" | "centro" | "sud" | undefined = "centro") {
  const t = newDb();
  const s = await seedTenant(t, { plan: "agency" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country: "IT", ...(zone ? { priceZone: zone } : {}) }));
  const as = t.withIdentity({ subject: s.ownerId });
  const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Catalogo test" });
  return { t, s, as, configuratorId };
}

const tiers = (t: Awaited<ReturnType<typeof setup>>["t"], id: Id<"configurators">, material = "pvc") =>
  t.run(async (ctx) => (await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", (q) => q.eq("configuratorId", id).eq("materialKey", material)).collect()).sort((a, b) => a.sortOrder - b.sortOrder));

describe("quality tiers and profile classification", () => {
  test("a new catalogue offers 5, 6 and 7 chambers; every standard profile is classified under its own", async () => {
    const { t, configuratorId } = await setup();
    expect((await tiers(t, configuratorId)).map((x) => x.key)).toEqual(["chamber5", "chamber6", "chamber7"]);
    const rows = await t.run((ctx) => ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect());
    const standard = rows.filter((r) => r.standardKey);
    expect(standard).toHaveLength(STANDARD_PROFILES.length);
    for (const r of standard) expect(r.qualityKey).toBe(`chamber${STANDARD_PROFILES.find((p) => p.key === r.standardKey)!.chambers}`);
  });

  test("an old catalogue (profiles without quality, no 6-chamber tier) is brought up to date, idempotently, without re-enabling anything", async () => {
    const { t, as, configuratorId } = await setup();
    await t.run(async (ctx) => {
      for (const p of await ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()) {
        if (p.standardKey) await ctx.db.patch(p._id, { qualityKey: undefined });
      }
      const six = (await ctx.db.query("catalogQualityTiers").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()).find((x) => x.key === "chamber6")!;
      await ctx.db.delete(six._id);
      const seven = (await ctx.db.query("catalogQualityTiers").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()).find((x) => x.key === "chamber7")!;
      await ctx.db.patch(seven._id, { enabled: false });
    });
    await as.mutation(api.catalog.ensureCatalogExtras, { configuratorId });
    const after = await tiers(t, configuratorId);
    expect(after.map((x) => x.key)).toEqual(["chamber5", "chamber7", "chamber6"]);
    expect(after.find((x) => x.key === "chamber7")!.enabled).toBe(false);
    const rows = await t.run((ctx) => ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect());
    expect(rows.filter((r) => r.standardKey && !r.qualityKey)).toHaveLength(0);
    await as.mutation(api.catalog.ensureCatalogExtras, { configuratorId });
    expect(await tiers(t, configuratorId)).toHaveLength(3);
  });

  test("the migration schedules one job per configurator", async () => {
    const { t, configuratorId } = await setup();
    await t.run(async (ctx) => {
      const six = (await ctx.db.query("catalogQualityTiers").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()).find((x) => x.key === "chamber6")!;
      await ctx.db.delete(six._id);
    });
    const res = await t.mutation(internal.migrations.classifyProfiles, {});
    expect(res.scheduled).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await tiers(t, configuratorId)).map((x) => x.key)).toContain("chamber6");
  });

  test("upsertProfileSystem: the quality must exist, an edit keeps it, an empty string clears it", async () => {
    const { t, as, configuratorId } = await setup();
    const base = { configuratorId, materialKey: "pvc", key: "mio", labels: { it: "Mio" }, multiplier: 1, sortOrder: 50, enabled: true };
    await expect(as.mutation(api.catalog.upsertProfileSystem, { ...base, qualityKey: "chamber9" })).rejects.toThrow(/PROFILE_QUALITY_UNKNOWN/);
    await as.mutation(api.catalog.upsertProfileSystem, { ...base, qualityKey: "chamber6" });
    const get = () => t.run(async (ctx) => (await ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()).find((p) => p.key === "mio"));
    expect((await get())?.qualityKey).toBe("chamber6");
    await as.mutation(api.catalog.upsertProfileSystem, { ...base, labels: { it: "Mio 2" } });
    expect((await get())?.qualityKey).toBe("chamber6");
    await as.mutation(api.catalog.upsertProfileSystem, { ...base, qualityKey: "" });
    expect((await get())?.qualityKey).toBeUndefined();
  });

  test("a quality used by profiles cannot be deleted; an empty one can", async () => {
    const { as, configuratorId } = await setup();
    await expect(as.mutation(api.catalog.deleteQualityTier, { configuratorId, materialKey: "pvc", key: "chamber6" })).rejects.toThrow(/QUALITY_IN_USE/);
    await as.mutation(api.catalog.upsertQualityTier, { configuratorId, materialKey: "pvc", key: "chamber8", labels: { it: "8 camere" }, multiplier: 1.2, sortOrder: 9, enabled: true });
    await as.mutation(api.catalog.deleteQualityTier, { configuratorId, materialKey: "pvc", key: "chamber8" });
  });

  test("publishing puts the classification and the 6-chamber tier in the snapshot", async () => {
    const { t, as, configuratorId } = await setup();
    await as.mutation(api.configurators.publishConfigurator, { configuratorId });
    const v = await t.run((ctx) => ctx.db.query("catalogVersions").withIndex("by_configurator_version", (q) => q.eq("configuratorId", configuratorId).eq("version", 1)).unique());
    const payload = v!.payload as { qualityTiers: Array<{ key: string }>; profileSystems: Array<{ standardKey?: string; qualityKey?: string }> };
    expect(payload.qualityTiers.map((x) => x.key)).toEqual(expect.arrayContaining(["chamber5", "chamber6", "chamber7"]));
    expect(payload.profileSystems.filter((p) => p.standardKey).every((p) => !!p.qualityKey)).toBe(true);
  });
});

describe("server refuses incoherent combinations", () => {
  async function widgetSetup() {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    await t.run(async (ctx) => {
      const v = (await ctx.db.query("catalogVersions").collect())[0];
      const payload = v.payload as { profileSystems: unknown[]; glazing: unknown[] };
      payload.profileSystems.push(
        { materialKey: "pvc", key: "std_gealan_s9000_plus_83", labels: { it: "Gealan Plus" }, multiplier: 1, standardKey: "std_gealan_s9000_plus_83", sortOrder: 5, enabled: true },
        { materialKey: "pvc", key: "std_aluplast_ideal_4000", labels: { it: "Ideal 4000" }, multiplier: 1, standardKey: "std_aluplast_ideal_4000", sortOrder: 6, enabled: true },
      );
      payload.glazing.push({ key: "t52_floatFloat331Be", labels: { it: "Triplo 52" }, priceCents: 0, sortOrder: 5, enabled: true });
      await ctx.db.patch(v._id, { payload });
    });
    const send = (item: object) =>
      t.mutation(internal.widget.insertQuote, { publicId: "PUBID12345", configuratorId, catalogVersion: 1, items: [item], leadName: "Mario", leadEmail: "m@example.com", leadLocale: "it" });
    return { t, send };
  }

  test("a 7-chamber profile under the 5-chamber quality is refused", async () => {
    const { send } = await widgetSetup();
    await expect(send({ ...sampleItem, profileSystem: "std_gealan_s9000_plus_83" })).rejects.toThrow(/INVALID_COMBINATION/);
  });

  test("a 52 mm triple unit in a 70 mm profile is refused", async () => {
    const { send } = await widgetSetup();
    await expect(send({ ...sampleItem, profileSystem: "std_aluplast_ideal_4000", glazing: "t52_floatFloat331Be" })).rejects.toThrow(/INVALID_COMBINATION/);
  });

  test("a coherent piece is accepted", async () => {
    const { send, t } = await widgetSetup();
    const id = await send({ ...sampleItem, profileSystem: "std_aluplast_ideal_4000" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  });
});
