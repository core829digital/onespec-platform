import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { calculatePrice, computeInstallation, computeItemThermal, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { defaultSashesFor } from "../../src/shared/configurator-model";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seeded() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
  await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
  return { t, s, configuratorId, asOwner: t.withIdentity({ subject: s.ownerId }) };
}

describe("B2B/showroom catalogue sections", () => {
  test("a freshly seeded configurator has telaio types, accessories and the leaf-model hardware rows", async () => {
    const { asOwner, configuratorId } = await seeded();
    const st = await asOwner.query(api.configurators.getEditorState, { configuratorId });
    expect(st?.frameTypes.map((f) => f.key).sort()).toEqual(["dritto", "reno40", "reno65"]);
    expect(st?.accessories).toHaveLength(14);
    expect(st?.accessories.every((a) => a.priceCents === 0)).toBe(true);
    const hw = (kind: string) => st!.hardware.filter((h) => h.kind === kind).map((h) => h.key);
    expect(hw("hardware")).toEqual(expect.arrayContaining(["standard", "rc2", "hidden"]));
    expect(hw("hardwareColor")).toEqual(expect.arrayContaining(["silver", "black"]));
    expect(hw("sashType")).toEqual(expect.arrayContaining(["tilt", "liftslide"]));
    const schuco = st!.profileSystems.find((p) => p.materialKey === "pvc" && p.key === "schuco");
    expect(schuco?.uFrame).toBeCloseTo(0.88);
    expect(st!.profileSystems.find((p) => p.key === "rehau")?.uFrame).toBe(1);
    expect(st!.glazing.find((g) => g.key === "triple")?.psi).toBeCloseTo(0.032);
    expect(st!.finish.find((f) => f.key === "woodIntExt")?.multiplier).toBeCloseTo(1.3);
  });

  test("ensureCatalogExtras is idempotent and restores deleted rows without touching tenant edits", async () => {
    const { asOwner, configuratorId } = await seeded();
    expect((await asOwner.mutation(api.catalog.ensureCatalogExtras, { configuratorId })).inserted).toBe(0);

    await asOwner.mutation(api.catalog.upsertAccessory, {
      configuratorId, category: "zanz", key: "molla", labels: { it: "Molla" }, priceModel: "perM2", priceCents: 4200, sortOrder: 4, enabled: true,
    });
    await asOwner.mutation(api.catalog.deleteFrameType, { configuratorId, key: "reno65" });
    const r = await asOwner.mutation(api.catalog.ensureCatalogExtras, { configuratorId });
    expect(r.inserted).toBe(1); // only reno65 came back
    const st = await asOwner.query(api.configurators.getEditorState, { configuratorId });
    expect(st?.accessories.find((a) => a.category === "zanz" && a.key === "molla")?.priceCents).toBe(4200);
    expect(st?.frameTypes).toHaveLength(3);
  });

  test("only owner/admin can edit; values are validated", async () => {
    const { t, s, asOwner, configuratorId } = await seeded();
    const asMember = t.withIdentity({ subject: s.memberId });
    const ft = { configuratorId, key: "x", labels: { it: "X" }, multiplier: 1.1, installByLeavesCents: [1, 2, 3], disposalPerPieceCents: 0, scaffoldPerPieceCents: 0, sortOrder: 9, enabled: true };
    await expect(asMember.mutation(api.catalog.upsertFrameType, ft)).rejects.toThrow();
    await expect(asOwner.mutation(api.catalog.upsertFrameType, { ...ft, multiplier: 0 })).rejects.toThrow();
    await expect(asOwner.mutation(api.catalog.upsertFrameType, { ...ft, installByLeavesCents: [1, 2] })).rejects.toThrow();
    await expect(asOwner.mutation(api.catalog.upsertFrameType, { ...ft, installByLeavesCents: [1, -2, 3] })).rejects.toThrow();
    await asOwner.mutation(api.catalog.upsertFrameType, ft);
    await asOwner.mutation(api.catalog.setProductBase, { configuratorId, category: "porta", basePriceCents: 30000 });
    expect((await asOwner.query(api.configurators.getEditorState, { configuratorId }))?.productBase).toHaveLength(1);
    await asOwner.mutation(api.catalog.setProductBase, { configuratorId, category: "porta", basePriceCents: null });
    expect((await asOwner.query(api.configurators.getEditorState, { configuratorId }))?.productBase).toHaveLength(0);
    await expect(asOwner.mutation(api.catalog.upsertAccessory, { configuratorId, category: "zanz", key: "bad", labels: {}, priceModel: "flat", priceCents: -1, sortOrder: 0, enabled: true })).rejects.toThrow();
  });

  test("the seeded catalogue drives the engine end to end (telaio, RC2, wood finish, thermal, installation)", async () => {
    const { asOwner, configuratorId } = await seeded();
    const st = (await asOwner.query(api.configurators.getEditorState, { configuratorId }))!;
    const strip = <T extends Record<string, unknown>>(rows: T[]) => rows.map((r) => {
      const { _id, _creationTime, tenantId, configuratorId: _c, ...rest } = r as Record<string, unknown>;
      void _id; void _creationTime; void tenantId; void _c;
      return rest;
    });
    const payload = {
      configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
      branding: null,
      materials: strip(st.materials),
      qualityTiers: strip(st.qualityTiers),
      profileSystems: strip(st.profileSystems),
      sizeConstraints: strip(st.sizeConstraints),
      glazing: strip(st.glazing),
      finish: strip(st.finish),
      hardware: strip(st.hardware),
      frameTypes: strip(st.frameTypes),
      accessories: strip(st.accessories),
      productBase: strip(st.productBase),
    } as unknown as CatalogPayload;

    const base: ProjectItem = {
      productType: "window",
      category: "finestra2",
      material: "pvc",
      quality: { pvc: "chamber5" },
      profileSystem: "rehau",
      width: 1200,
      height: 1400,
      quantity: 1,
      sashes: defaultSashesFor("finestra2", 1400),
      glazing: "triple",
      color: "woodIntExt",
      insectScreen: false,
      frameType: "reno40",
    };
    const plain = calculatePrice(payload, [{ ...base, frameType: undefined, color: "white", glazing: "double" }]);
    const rich = calculatePrice(payload, [base]);
    expect(rich.priceCents).toBeGreaterThan(plain.priceCents);

    const rc2 = calculatePrice(payload, [{ ...base, sashes: base.sashes.map((x) => ({ ...x, hardware: "rc2" })) }]);
    expect(rc2.priceCents - rich.priceCents).toBe(2 * 5500); // 2 operable leaves

    const th = computeItemThermal(payload, base);
    expect(th.uf).toBe(1); // Rehau Synego
    expect(th.ug).toBeCloseTo(0.6);
    expect(th.uw).toBeGreaterThan(0.6);
    expect(th.uw).toBeLessThan(1.2);

    const inst = computeInstallation(payload, [base]);
    expect(inst.labourCents).toBe(15500); // reno40, 2 leaves
    expect(inst.disposalCents).toBe(3500);
  });

  test("migrations:seedCatalogExtras brings an old configurator (no extras) up to date", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
    const r = await t.mutation(internal.migrations.seedCatalogExtras, {});
    expect(r.configurators).toBe(1);
    expect(r.inserted).toBeGreaterThan(20);
    expect((await t.mutation(internal.migrations.seedCatalogExtras, {})).inserted).toBe(0);
    const frames = await t.run((ctx) => ctx.db.query("catalogFrameTypes").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect());
    expect(frames).toHaveLength(3);
  });
});
