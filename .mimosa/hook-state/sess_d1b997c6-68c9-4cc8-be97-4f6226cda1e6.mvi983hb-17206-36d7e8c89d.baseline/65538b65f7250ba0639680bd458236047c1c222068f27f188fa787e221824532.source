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

describe("finish library in the catalogue", () => {
  test("a new configurator gets the whole library once, and re-seeding keeps tenant edits", async () => {
    const { finishLibraryRows } = await import("../../src/shared/finish-library");
    const t = newDb();
    const s = await seedTenant(t, { plan: "agency" });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test" });
    const configuratorId = (await t.run((ctx) => ctx.db.query("configurators").first()))!._id;
    const rows = await t.run((ctx) => ctx.db.query("catalogFinishOptions").collect());
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("white");
    for (const r of finishLibraryRows()) expect(keys).toContain(r.key);
    const row = rows.find((r) => r.key === "s01")!;
    expect(row.texture).toBe("/finishes/s01.jpg");
    await t.run((ctx) => ctx.db.patch(row._id, { priceCents: 777 }));
    await as.mutation(api.catalog.ensureCatalogExtras, { configuratorId });
    const after = await t.run((ctx) => ctx.db.query("catalogFinishOptions").collect());
    expect(after).toHaveLength(rows.length);
    expect(after.find((r) => r.key === "s01")!.priceCents).toBe(777);
  });
});

describe("one-command seeding of the libraries", () => {
  test("seedCatalogLibraries fills every existing configurator by itself, and again does nothing", async () => {
    const { internal } = await import("../../convex/_generated/api");
    const { glazingPackageRows } = await import("../../src/shared/glazing-packages");
    const { finishLibraryRows } = await import("../../src/shared/finish-library");
    const t = newDb();
    const s = await seedTenant(t, { plan: "agency" });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test uno" });
    // An older configurator: wipe the libraries so it looks like one created before them.
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query("catalogGlazingOptions").collect()) if (/^[dt]\d\d_/.test(r.key)) await ctx.db.delete(r._id);
      for (const r of await ctx.db.query("catalogFinishOptions").collect()) if (r.range) await ctx.db.delete(r._id);
    });
    const first = await t.mutation(internal.migrations.seedCatalogLibraries, {});
    expect(first).toEqual({ scheduled: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const glazing = await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect());
    const finish = await t.run((ctx) => ctx.db.query("catalogFinishOptions").collect());
    for (const p of glazingPackageRows()) expect(glazing.map((g) => g.key)).toContain(p.key);
    for (const f of finishLibraryRows()) expect(finish.map((x) => x.key)).toContain(f.key);
    await t.mutation(internal.migrations.seedCatalogLibraries, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("catalogFinishOptions").collect())).toHaveLength(finish.length);
    expect(await t.run((ctx) => ctx.db.query("catalogGlazingOptions").collect())).toHaveLength(glazing.length);
  });
});
