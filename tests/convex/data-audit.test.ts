import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import { strictShapeProblem } from "../../convex/dataAudit";
import schema from "../../convex/schema";
import { newLegacyDb, seedTenant } from "./_helpers";

describe("strictShapeProblem", () => {
  test("labels must be a record of known languages to short texts", () => {
    expect(strictShapeProblem("catalogMaterials", { labels: { it: "PVC", en: "PVC" } })).toBeNull();
    expect(strictShapeProblem("catalogMaterials", { labels: "PVC" })).toMatch(/labels/);
    expect(strictShapeProblem("catalogMaterials", { labels: { xx: "PVC" } })).toMatch(/labels/);
    expect(strictShapeProblem("catalogMaterials", { labels: { it: 3 } })).toMatch(/labels/);
  });
  test("frame type descriptions are checked when present", () => {
    expect(strictShapeProblem("catalogFrameTypes", { labels: { it: "A" } })).toBeNull();
    expect(strictShapeProblem("catalogFrameTypes", { labels: { it: "A" }, descriptions: [1] })).toMatch(/descriptions/);
  });
  test("payload must be an object and items an array of objects", () => {
    expect(strictShapeProblem("catalogVersions", { payload: { materials: [] } })).toBeNull();
    expect(strictShapeProblem("catalogVersions", { payload: [] })).toMatch(/payload/);
    expect(strictShapeProblem("quoteRequests", { items: [{ width: 1000 }] })).toBeNull();
    expect(strictShapeProblem("quoteRequests", { items: {} })).toMatch(/items/);
    expect(strictShapeProblem("quoteRequests", { items: [1] })).toMatch(/items/);
  });
});

test("strictShapes reads a page, reports the non-conforming rows and writes nothing", async () => {
  // Validation off: the point is to seed a row the stricter validator would reject.
  const t = newLegacyDb();
  const s = await seedTenant(t);
  await t.run(async (ctx) => {
    const any = ctx.db as unknown as { insert: (table: string, doc: Record<string, unknown>) => Promise<string> };
    await any.insert("catalogMaterials", { tenantId: s.tenantId, key: "pvc", labels: { it: "PVC" }, enabled: true, sortOrder: 0 });
    await any.insert("catalogMaterials", { tenantId: s.tenantId, key: "alu", labels: "Alluminio", enabled: true, sortOrder: 1 });
  });
  const before = await t.run((ctx) => ctx.db.query("catalogMaterials").collect());
  const r = await t.query(internal.dataAudit.strictShapes, { table: "catalogMaterials" });
  expect(r.checked).toBe(2);
  expect(r.failingCount).toBe(1);
  expect(r.failing[0].problem).toMatch(/labels/);
  expect(r.done).toBe(true);
  const after = await t.run((ctx) => ctx.db.query("catalogMaterials").collect());
  expect(after).toEqual(before);
});

// convex-test 0.0.35 skips `v.record` when it validates writes, so pin the validators themselves: Convex enforces them.
test("the schema stores labels, catalog payloads and quote items with typed validators (issue #65 step B)", () => {
  const field = (table: string, name: string) => {
    const tables = schema.tables as unknown as Record<string, { validator: { fields: Record<string, { kind: string; isOptional: string }> } }>;
    return tables[table].validator.fields[name];
  };
  for (const table of ["catalogMaterials", "catalogQualityTiers", "catalogProfileSystems", "catalogGlazingOptions",
    "catalogFinishOptions", "catalogFrameTypes", "catalogAccessories", "catalogHardwareOptions"]) {
    expect(field(table, "labels").kind, table).toBe("record");
  }
  expect(field("catalogFrameTypes", "descriptions")).toMatchObject({ kind: "record", isOptional: "optional" });
  expect(field("catalogVersions", "payload").kind).toBe("record");
  expect(field("quoteRequests", "items").kind).toBe("array");
});
