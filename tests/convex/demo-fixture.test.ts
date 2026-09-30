import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * The public website demo runs the REAL widget and the REAL showroom calculator on
 * a static catalogue. That catalogue is generated here from the real code path
 * (create configurator → seed defaults → publish → public read), so it can never
 * drift from the product: if the catalogue code changes, this test fails until the
 * fixture is regenerated with `UPDATE_DEMO_FIXTURE=1 npx vitest run tests/convex/demo-fixture.test.ts`.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const FILE = "src/lib/demo/demo-data.json";

async function build() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "agency" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country: "IT", name: "Serramenti Demo" }));
  const as = t.withIdentity({ subject: s.ownerId });
  await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Serramenti Demo" });
  const configuratorId = (await t.run((ctx) => ctx.db.query("configurators").first()))!._id;
  // createConfigurator already seeds the default catalogue: seeding again duplicated every option.
  await as.mutation(api.configurators.publishConfigurator, { configuratorId });
  const publicId = (await t.run((ctx) => ctx.db.get(configuratorId)))!.publicId;
  const configurator = await t.query(api.widget.getPublicConfigurator, { publicId });
  const showroom = await as.query(api.calculations.getShowroomCatalog, { tenantId: s.tenantId });
  if (!configurator || !showroom.ready) throw new Error("demo catalogue could not be built");
  const built = {
    configurator: { ...configurator, name: "Serramenti Demo", privacyUrl: null },
    showroom: { regionCode: showroom.regionCode, payload: showroom.payload },
  };
  // The random public id also appears inside the catalogue snapshot: pin it everywhere.
  return JSON.parse(JSON.stringify(built).split(publicId).join("DEMO000000"));
}

describe("demo fixture", () => {
  test("is generated from the real catalogue pipeline and stays in sync", async () => {
    const built = JSON.parse(JSON.stringify(await build()));
    if (process.env.UPDATE_DEMO_FIXTURE === "1" || !existsSync(FILE)) {
      mkdirSync("src/lib/demo", { recursive: true });
      writeFileSync(FILE, JSON.stringify(built, null, 1) + "\n");
    }
    expect(built.configurator.catalog).toBeTruthy();
    // No option may appear twice: the catalogue was once seeded two times, doubling every choice.
    const cat = built.showroom.payload as Record<string, unknown>;
    for (const [name, rows] of Object.entries(cat)) {
      if (!Array.isArray(rows)) continue;
      const ids = rows.map((r) => JSON.stringify(r));
      expect(new Set(ids).size, `${name} has duplicated options`).toBe(ids.length);
    }
    expect(JSON.parse(readFileSync(FILE, "utf8"))).toEqual(built);
  });
});
