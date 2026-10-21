import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

/**
 * Widget-first plans (Essentials / Essentials+ / Max): every platform module
 * outside the widget is locked SERVER-side (RBAC permission × plan
 * entitlement), not just hidden in the UI. PLAN_UPGRADE_REQUIRED is the code
 * the app turns into the lock / upgrade prompt.
 */
const LOCKED = "PLAN_UPGRADE_REQUIRED";
const showroomOptions = { regionCode: "IT" as const, buildingAge: 20, isEnergyRenovation: true, deductionPercent: 50 };

describe("widget-first plans: platform modules are locked server-side", () => {
  for (const plan of ["essentials", "essentials_plus", "max"] as const) {
    test(`${plan}: CRM, cantieri, field ops and B2B quotes are locked`, async () => {
      const t = newDb();
      const s = await seedTenant(t, { plan });
      const as = t.withIdentity({ subject: s.ownerId });
      const tenantId = s.tenantId;

      await expect(as.query(api.clients.listClients, { tenantId })).rejects.toThrow(LOCKED);
      await expect(as.query(api.cantieri.listCantieri, { tenantId })).rejects.toThrow(LOCKED);
      await expect(as.query(api.surveys.list, { tenantId })).rejects.toThrow(LOCKED);
      await expect(as.query(api.installations.list, { tenantId })).rejects.toThrow(LOCKED);
      await expect(as.query(api.inspections.list, { tenantId })).rejects.toThrow(LOCKED);
      await expect(as.query(api.passports.list, { tenantId })).rejects.toThrow(LOCKED);
      await expect(
        as.mutation(api.clients.createClient, { tenantId, name: "Mario Rossi", type: "private" }),
      ).rejects.toThrow(LOCKED);

      const configuratorId = await seedPublishedConfigurator(t, tenantId, `MOD_${plan.toUpperCase()}`.slice(0, 16));
      await expect(
        as.mutation(api.quotes.createFieldQuote, {
          tenantId, configuratorId, leadName: "Mario", leadEmail: "mario@example.com", items: [sampleItem],
        }),
      ).rejects.toThrow(LOCKED);
    });
  }

  test("logistics: locked on Essentials and Essentials+, open on Max", async () => {
    const t = newDb();
    for (const plan of ["essentials", "essentials_plus"] as const) {
      const s = await seedTenant(t, { plan });
      await expect(
        t.withIdentity({ subject: s.ownerId }).query(api.logistics.listCarriers, { tenantId: s.tenantId }),
      ).rejects.toThrow(LOCKED);
    }
    const max = await seedTenant(t, { plan: "max" });
    const carriers = await t.withIdentity({ subject: max.ownerId }).query(api.logistics.listCarriers, { tenantId: max.tenantId });
    expect(Array.isArray(carriers)).toBe(true);
  });

  test("showroom: locked on Essentials, open on Essentials+ and Max", async () => {
    const t = newDb();
    const ess = await seedTenant(t, { plan: "essentials" });
    await seedPublishedConfigurator(t, ess.tenantId, "SHOW_E00001");
    const denied = await t.withIdentity({ subject: ess.ownerId }).query(api.calculations.getShowroomCatalog, { tenantId: ess.tenantId });
    expect(denied.ready).toBe(false);

    for (const plan of ["essentials_plus", "max"] as const) {
      const s = await seedTenant(t, { plan });
      await seedPublishedConfigurator(t, s.tenantId, `SHOW_${plan === "max" ? "M" : "P"}00001`);
      const as = t.withIdentity({ subject: s.ownerId });
      const ok = await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId });
      expect(ok.ready).toBe(true);
      const calc = await as.query(api.calculations.getCalculationPreview, { tenantId: s.tenantId, items: [sampleItem], options: showroomOptions });
      expect(calc.priceCents).toBeGreaterThan(0);
    }
  });

  test("requests (Richieste) stay open on every widget-first plan", async () => {
    const t = newDb();
    for (const plan of ["essentials", "essentials_plus", "max"] as const) {
      const s = await seedTenant(t, { plan });
      const rows = await t.withIdentity({ subject: s.ownerId }).query(api.quotes.listRequests, { tenantId: s.tenantId });
      expect(Array.isArray(rows)).toBe(true);
    }
  });

  test("full-platform plans keep every module (no access change)", async () => {
    const t = newDb();
    for (const plan of ["base", "pro", "agency", "enterprise"] as const) {
      const s = await seedTenant(t, { plan });
      const as = t.withIdentity({ subject: s.ownerId });
      await expect(as.query(api.clients.listClients, { tenantId: s.tenantId })).resolves.toBeDefined();
      await expect(as.query(api.cantieri.listCantieri, { tenantId: s.tenantId })).resolves.toBeDefined();
      await expect(as.query(api.surveys.list, { tenantId: s.tenantId })).resolves.toBeDefined();
      await expect(as.query(api.logistics.listCarriers, { tenantId: s.tenantId })).resolves.toBeDefined();
    }
  });
});
