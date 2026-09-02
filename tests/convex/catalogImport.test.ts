import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { parseCsv } from "../../src/lib/csv-parse";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("parseCsv", () => {
  test("handles ; delimiter, quotes and doubled quotes", () => {
    const rows = parseCsv('key;label;price\r\npvc;"PVC ""5 cam""";180,00\n');
    expect(rows).toEqual([
      ["key", "label", "price"],
      ["pvc", 'PVC "5 cam"', "180,00"],
    ]);
  });
});

describe("catalogImport.importRows", () => {
  test("creates + updates materials, rejects bad rows, and can be undone", async () => {
    const t = newDb();
    const { tenantId, ownerId, memberId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    const as = t.withIdentity({ subject: ownerId });

    // one existing live material so the import can exercise the update path
    await t.run((ctx) =>
      ctx.db.insert("catalogMaterials", {
        tenantId,
        configuratorId,
        key: "pvc",
        labels: { it: "PVC" },
        basePerM2Cents: 18000,
        profilePerMlCents: 2800,
        sortOrder: 0,
        enabled: true,
      }),
    );

    const res = await as.mutation(api.catalogImport.importRows, {
      configuratorId,
      target: "materials",
      rows: [
        { key: "pvc", label: "PVC Premium", basePerM2Cents: 20000, profilePerMlCents: 3000 }, // updates seed pvc
        { key: "legno", label: "Legno", basePerM2Cents: 32000, profilePerMlCents: 4500 }, // new
        { key: "bad key!", label: "x", basePerM2Cents: 1, profilePerMlCents: 1 }, // rejected
      ],
    });

    expect(res.summary).toEqual({ created: 1, updated: 1, rejected: 1 });
    expect(res.rejected[0].row).toBe(3);

    const afterImport = await t.run((ctx) =>
      ctx.db
        .query("catalogMaterials")
        .withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId))
        .collect(),
    );
    expect(afterImport.find((m) => m.key === "pvc")?.basePerM2Cents).toBe(20000);
    expect(afterImport.some((m) => m.key === "legno")).toBe(true);
    expect(afterImport).toHaveLength(2);

    const imports = await as.query(api.catalogImport.listImports, { configuratorId });
    expect(imports).toHaveLength(1);

    await as.mutation(api.catalogImport.undoImport, { importId: imports[0]._id });
    const restored = await t.run((ctx) =>
      ctx.db
        .query("catalogMaterials")
        .withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId))
        .collect(),
    );
    expect(restored).toHaveLength(1);
    expect(restored.find((m) => m.key === "pvc")?.basePerM2Cents).toBe(18000); // pre-import value back
    expect(restored.some((m) => m.key === "legno")).toBe(false);

    // member cannot import
    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.catalogImport.importRows, {
        configuratorId,
        target: "materials",
        rows: [{ key: "x", label: "x", basePerM2Cents: 1, profilePerMlCents: 1 }],
      }),
    ).rejects.toThrow();
  });
});
