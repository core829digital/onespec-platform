import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";
import { glazingPackageRows } from "../../src/shared/glazing-packages";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("glazing packages in the catalogue", () => {
  test("a new configurator gets every package, once, next to the legacy glazing rows", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "agency" });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test" });
    const rows = await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect());
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("double");
    expect(keys).toContain("triple");
    for (const p of glazingPackageRows()) expect(keys).toContain(p.key);
  });

  test("seeding again inserts nothing and never overwrites a tenant's edited price", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "agency" });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test" });
    const configuratorId = (await t.run((ctx) => ctx.db.query("configurators").first()))!._id;
    const row = (await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect())).find((r) => r.key === "d24_floatBeArgon")!;
    await t.run((ctx) => ctx.db.patch(row._id, { priceCents: 12345 }));
    const before = (await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect())).length;
    await as.mutation(api.catalog.ensureCatalogExtras, { configuratorId });
    const after = await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect());
    expect(after).toHaveLength(before);
    expect(after.find((r) => r.key === "d24_floatBeArgon")!.priceCents).toBe(12345);
  });
});
