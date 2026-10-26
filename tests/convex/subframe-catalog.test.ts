import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The controtelaio (sub-frame) is an Italian way of fitting: seeded, priced and editable for an Italian company only. */
async function setup(country: string) {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country }));
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "CTEL_" + country);
  await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
  const asOwner = t.withIdentity({ subject: s.ownerId });
  await asOwner.mutation(api.configurators.publishConfigurator, { configuratorId });
  const latest = await t.run(async (ctx) => (await ctx.db.query("catalogVersions").collect()).sort((a, b) => a.version - b.version).at(-1)!);
  return { t, s, configuratorId, asOwner, payload: latest.payload as unknown as CatalogPayload, version: latest.version };
}

const ctel = (p: CatalogPayload) => (p.accessories ?? []).filter((a) => a.category === "ctel");

describe("controtelaio catalogue", () => {
  test("an Italian company gets the sub-frame rows, with depth and a price per linear metre, published with the catalogue", async () => {
    const it = await setup("IT");
    expect(ctel(it.payload).map((a) => a.key).sort()).toEqual(["isolato", "lamiera", "legno"]);
    for (const a of ctel(it.payload)) {
      expect(a.priceModel).toBe("perMl");
      expect(a.priceCents).toBeGreaterThan(0);
      expect(a.depthMm).toBeGreaterThanOrEqual(30);
    }
  });

  test("a company of any other market gets none, and cannot add one", async () => {
    for (const country of ["FR", "BE", "NL", "DE", "LU"]) {
      const s = await setup(country);
      expect(ctel(s.payload)).toHaveLength(0);
      await expect(s.asOwner.mutation(api.catalog.upsertAccessory, { configuratorId: s.configuratorId, category: "ctel", key: "x", labels: { it: "x" }, priceModel: "flat", priceCents: 1000, sortOrder: 0, enabled: true })).rejects.toThrow();
      // The other accessories are unaffected.
      expect((s.payload.accessories ?? []).some((a) => a.category === "zanz")).toBe(true);
    }
  });

  test("the installer sets the type, price model and depth; invalid depths and a depth on another category are refused", async () => {
    const s = await setup("IT");
    const base = { configuratorId: s.configuratorId, category: "ctel" as const, key: "monoblocco", labels: { it: "Monoblocco" }, priceModel: "flat" as const, priceCents: 9000, sortOrder: 5, enabled: true };
    await s.asOwner.mutation(api.catalog.upsertAccessory, { ...base, depthMm: 120 });
    const state = await s.asOwner.query(api.configurators.getEditorState, { configuratorId: s.configuratorId });
    expect(state?.accessories.find((a) => a.category === "ctel" && a.key === "monoblocco")).toMatchObject({ depthMm: 120, priceModel: "flat", priceCents: 9000 });
    for (const bad of [10, 29, 201, 500, 70.5, Number.NaN]) {
      await expect(s.asOwner.mutation(api.catalog.upsertAccessory, { ...base, key: "bad", depthMm: bad })).rejects.toThrow();
    }
    await expect(s.asOwner.mutation(api.catalog.upsertAccessory, { configuratorId: s.configuratorId, category: "zanz", key: "x", labels: { it: "x" }, priceModel: "flat", priceCents: 100, sortOrder: 0, enabled: true, depthMm: 70 })).rejects.toThrow();
    await s.asOwner.mutation(api.catalog.deleteAccessory, { configuratorId: s.configuratorId, category: "ctel", key: "monoblocco" });
    expect((await s.asOwner.query(api.configurators.getEditorState, { configuratorId: s.configuratorId }))?.accessories.some((a) => a.key === "monoblocco")).toBe(false);
  });

  test("a member without catalogue rights cannot change it", async () => {
    const s = await setup("IT");
    const asMember = s.t.withIdentity({ subject: s.s.memberId });
    await expect(asMember.mutation(api.catalog.upsertAccessory, { configuratorId: s.configuratorId, category: "ctel", key: "x", labels: { it: "x" }, priceModel: "flat", priceCents: 1000, sortOrder: 0, enabled: true })).rejects.toThrow();
  });
});

describe("controtelaio price", () => {
  const piece = (over: Partial<ProjectItem> = {}): ProjectItem => ({ ...sampleItem, width: 1200, height: 1400, ...over }) as ProjectItem;

  test("per linear metre of the opening: 2 × (width + height), quantity included", async () => {
    const s = await setup("IT");
    const row = ctel(s.payload).find((a) => a.key === "lamiera")!;
    const without = calculatePrice(s.payload, [piece()]);
    const withIt = calculatePrice(s.payload, [piece({ accessories: { ctel: "lamiera" } })]);
    expect(withIt.priceExVatCents - without.priceExVatCents).toBe(Math.round(row.priceCents * 2 * (1.2 + 1.4)));
    const three = calculatePrice(s.payload, [piece({ quantity: 3, accessories: { ctel: "lamiera" } })]);
    expect(three.items[0].itemTotalCents).toBe(3 * withIt.items[0].unitPrice);
  });

  test("follows the piece, never the size typed for a shutter box or a screen", async () => {
    const s = await setup("IT");
    const plain = calculatePrice(s.payload, [piece({ accessories: { ctel: "lamiera" } })]);
    const typed = calculatePrice(s.payload, [piece({ accessories: { ctel: "lamiera", width: 3000, height: 3000 } })]);
    expect(typed.priceExVatCents).toBe(plain.priceExVatCents);
  });

  test("the type chosen changes the price; an unknown or disabled key costs nothing", async () => {
    const s = await setup("IT");
    const a = calculatePrice(s.payload, [piece({ accessories: { ctel: "lamiera" } })]).priceExVatCents;
    const b = calculatePrice(s.payload, [piece({ accessories: { ctel: "isolato" } })]).priceExVatCents;
    expect(b).toBeGreaterThan(a);
    const base = calculatePrice(s.payload, [piece()]).priceExVatCents;
    expect(calculatePrice(s.payload, [piece({ accessories: { ctel: "nope" } })]).priceExVatCents).toBe(base);
    const disabled = { ...s.payload, accessories: (s.payload.accessories ?? []).map((x) => (x.category === "ctel" ? { ...x, enabled: false } : x)) } as CatalogPayload;
    expect(calculatePrice(disabled, [piece({ accessories: { ctel: "lamiera" } })]).priceExVatCents).toBe(base);
  });

  test("outside Italy the key costs nothing because the catalogue has no such row", async () => {
    const fr = await setup("FR");
    expect(calculatePrice(fr.payload, [piece({ accessories: { ctel: "lamiera" } })]).priceExVatCents).toBe(calculatePrice(fr.payload, [piece()]).priceExVatCents);
  });

  test("the public widget schema accepts it and the server prices the request the same way", async () => {
    const s = await setup("IT");
    const item = piece({ accessories: { ctel: "legno" } });
    expect(ProjectItemSchema.safeParse(JSON.parse(JSON.stringify(item))).success).toBe(true);
    expect(ProjectItemSchema.safeParse({ ...JSON.parse(JSON.stringify(item)), accessories: { ctel: 12 } }).success).toBe(false);
    const id = await s.t.mutation(internal.widget.insertQuote, { publicId: "CTEL_IT", configuratorId: s.configuratorId, catalogVersion: s.version, items: [item], leadName: "Mario Rossi", leadEmail: "mario.rossi@example.com", leadLocale: "it" });
    const stored = await s.t.run((ctx) => ctx.db.get(id));
    expect(stored?.priceExVatCents).toBe(calculatePrice(s.payload, [item]).priceExVatCents);
  });
});
