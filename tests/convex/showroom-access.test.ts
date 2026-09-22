import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

const options = { regionCode: "IT" as const, buildingAge: 20, isEnergyRenovation: true, deductionPercent: 50 };

describe("showroom calculator access", () => {
  test("a signed-in user of ANOTHER tenant can neither read the catalogue nor price against it", async () => {
    const t = newDb();
    const a = await seedTenant(t, { plan: "showroom" });
    const b = await seedTenant(t, { plan: "showroom" });
    await seedPublishedConfigurator(t, a.tenantId, "SHOW_A0001");
    const asB = t.withIdentity({ subject: b.ownerId });

    await expect(asB.query(api.calculations.getShowroomCatalog, { tenantId: a.tenantId })).rejects.toThrow();
    await expect(asB.query(api.calculations.getCalculationPreview, { tenantId: a.tenantId, items: [sampleItem], options })).rejects.toThrow();
  });

  test("plans without the showroom calculator get an explicit 'not allowed' state, showroom plans get a clean payload", async () => {
    const t = newDb();
    const pro = await seedTenant(t, { plan: "pro" });
    const show = await seedTenant(t, { plan: "showroom" });
    await seedPublishedConfigurator(t, pro.tenantId, "SHOW_P0001");
    await seedPublishedConfigurator(t, show.tenantId, "SHOW_S0001");

    const denied = await t.withIdentity({ subject: pro.ownerId }).query(api.calculations.getShowroomCatalog, { tenantId: pro.tenantId });
    expect(denied.ready).toBe(false);
    expect("allowed" in denied && denied.allowed).toBe(false);

    const ok = await t.withIdentity({ subject: show.ownerId }).query(api.calculations.getShowroomCatalog, { tenantId: show.tenantId });
    expect(ok.ready).toBe(true);
    if (!ok.ready) return;
    expect(ok.payload.materials.length).toBeGreaterThan(0);
    expect(JSON.stringify(ok.payload)).not.toContain("tenantId");
    expect(JSON.stringify(ok.payload)).not.toContain("_id");

    const calc = await t.withIdentity({ subject: show.ownerId }).query(api.calculations.getCalculationPreview, { tenantId: show.tenantId, items: [sampleItem], options });
    expect(calc.priceCents).toBeGreaterThan(0);
  });
});
