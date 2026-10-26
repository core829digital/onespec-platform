import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { computeCalculationPreview } from "../../convex/lib/calcPreview";
import { exportInputFromQuote } from "../../src/lib/quote-export/from-quote";
import { itSplitFromItems } from "../../convex/lib/fiscal";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The disposal of the old windows is one engine for every configurator: widget, wizard, Showroom and B2B quote. */
async function setup(opts: { model?: "perPiece" | "perJob"; priceCents?: number; def?: "with" | "without" } = {}) {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "DISP_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  if (opts.priceCents !== undefined) {
    await asOwner.mutation(api.pricing.setDisposal, { configuratorId, model: opts.model ?? "perPiece", priceCents: opts.priceCents, defaultMode: opts.def ?? "without" });
    await asOwner.mutation(api.configurators.publishConfigurator, { configuratorId });
  }
  const latest = await t.run(async (ctx) => (await ctx.db.query("catalogVersions").collect()).sort((a, b) => a.version - b.version).at(-1)!);
  const payload = latest.payload as unknown as CatalogPayload;
  return { t, seeded, configuratorId, asOwner, payload, version: latest.version };
}

const widgetQuote = (s: Awaited<ReturnType<typeof setup>>, items: object[]) =>
  s.t.mutation(internal.widget.insertQuote, {
    publicId: "DISP_01",
    configuratorId: s.configuratorId,
    catalogVersion: s.version,
    items,
    leadName: "Mario Rossi",
    leadEmail: "mario.rossi@example.com",
    leadLocale: "it",
  });

describe("disposal setting", () => {
  test("is published with the catalogue only when the installer sets a price", async () => {
    const off = await setup();
    expect(off.payload.configurator.disposalPriceCents).toBeUndefined();
    const on = await setup({ model: "perJob", priceCents: 15000, def: "with" });
    expect(on.payload.configurator).toMatchObject({ disposalModel: "perJob", disposalPriceCents: 15000, disposalDefault: "with" });
    // The widget gets the same figures: its public catalogue is the published snapshot.
    const publicCfg = await on.t.query(api.widget.getPublicConfigurator, { publicId: "DISP_01" });
    expect((publicCfg?.catalog as { configurator?: { disposalPriceCents?: number; disposalModel?: string } } | undefined)?.configurator).toMatchObject({ disposalPriceCents: 15000, disposalModel: "perJob" });
  });

  test("setting it back to 0 switches it off again", async () => {
    const s = await setup({ priceCents: 3500 });
    await s.asOwner.mutation(api.pricing.setDisposal, { configuratorId: s.configuratorId, model: "perPiece", priceCents: 0, defaultMode: "without" });
    await s.asOwner.mutation(api.configurators.publishConfigurator, { configuratorId: s.configuratorId });
    const after = await s.t.run(async (ctx) => (await ctx.db.query("catalogVersions").collect()).sort((a, b) => a.version - b.version).at(-1)!.payload);
    expect((after as unknown as CatalogPayload).configurator.disposalPriceCents).toBeUndefined();
  });

  test("validates the amount and the permissions", async () => {
    const s = await setup();
    for (const bad of [-1, 12.5, 1_000_001, Number.NaN]) {
      await expect(s.asOwner.mutation(api.pricing.setDisposal, { configuratorId: s.configuratorId, model: "perPiece", priceCents: bad, defaultMode: "with" })).rejects.toThrow();
    }
    // A stranger with no membership of this company cannot change it.
    const other = await seedTenant(s.t, { plan: "pro" });
    const asStranger = s.t.withIdentity({ subject: other.ownerId });
    await expect(asStranger.mutation(api.pricing.setDisposal, { configuratorId: s.configuratorId, model: "perPiece", priceCents: 3500, defaultMode: "with" })).rejects.toThrow();
  });
});

describe("same pieces, same price with the disposal in widget, wizard, Showroom and B2B quote", () => {
  const pieces: ProjectItem[] = [
    { ...sampleItem, width: 1200, height: 1400, quantity: 2 },
    { ...sampleItem, width: 900, height: 1300 },
  ] as ProjectItem[];

  test.each([
    { name: "per piece", model: "perPiece" as const, priceCents: 3500, extra: 3 * 3500 },
    { name: "per job", model: "perJob" as const, priceCents: 15000, extra: 15000 },
  ])("$name: engine, Showroom, B2B quote and widget request agree to the cent", async ({ model, priceCents, extra }) => {
    const s = await setup({ model, priceCents });
    const withIt = pieces.map((p) => ({ ...p, withDisposal: true }));
    const without = pieces.map((p) => ({ ...p, withDisposal: false }));
    const engine = calculatePrice(s.payload, withIt);
    expect(engine.priceExVatCents - calculatePrice(s.payload, without).priceExVatCents).toBe(extra);

    // Showroom preview.
    const showroom = computeCalculationPreview(s.payload, 1, withIt, { regionCode: "IT", buildingAge: 20, isEnergyRenovation: false, deductionPercent: 0 });
    expect(showroom.priceExVatCents).toBe(engine.priceExVatCents);
    expect(showroom.priceCents).toBe(engine.priceCents);
    expect(showroom.disposal?.includedCents).toBe(extra);
    // The Italian VAT split carries it too (as a service, with the labour): its taxable bases grow by exactly the disposal.
    const bases = (c: typeof showroom) => c.vatBreakdown.reduce((n, v) => n + v.baseCents, 0);
    const showroomWithout = computeCalculationPreview(s.payload, 1, without, { regionCode: "IT", buildingAge: 20, isEnergyRenovation: false, deductionPercent: 0 });
    expect(bases(showroom) - bases(showroomWithout)).toBe(extra);
    expect(itSplitFromItems(s.payload, withIt, engine).manoperaCents - itSplitFromItems(s.payload, without, calculatePrice(s.payload, without)).manoperaCents).toBe(extra);

    // B2B quote: stored price = the engine's, and the disposal choice is kept on the pieces.
    const created = await s.asOwner.mutation(api.quotes.createFieldQuote, { tenantId: s.seeded.tenantId, configuratorId: s.configuratorId, leadName: "Mario Rossi", leadEmail: "mario.rossi@example.com", items: withIt, vatRatePercent: 22 });
    const stored = await s.asOwner.query(api.quotes.getRequest, { quoteId: created.quoteId });
    expect(stored?.priceExVatCents).toBe(engine.priceExVatCents);
    expect((stored?.items as ProjectItem[]).every((i) => i.withDisposal === true)).toBe(true);

    // The document shows the disposal as its own line and the lines add up to the stored total.
    const doc = exportInputFromQuote(stored as never, s.payload, { name: "Serramenti" });
    expect(doc.money.demolitionCents).toBe(extra);
    expect(doc.money.supplyExVatCents + doc.money.demolitionCents).toBe(engine.priceExVatCents);

    // Public widget request: the server prices it the same way.
    const id = await widgetQuote(s, withIt);
    const request = await s.t.run((ctx) => ctx.db.get(id));
    expect(request?.priceExVatCents).toBe(engine.priceExVatCents);
  });

  test("a piece that opts out costs nothing extra, and the default applies when the piece does not say", async () => {
    const s = await setup({ model: "perPiece", priceCents: 3500, def: "with" });
    const none = calculatePrice(s.payload, pieces.map((p) => ({ ...p, withDisposal: false })));
    const dflt = calculatePrice(s.payload, pieces);
    expect(dflt.disposal?.pieces).toBe(3);
    expect(dflt.priceExVatCents - none.priceExVatCents).toBe(3 * 3500);
    expect(none.disposal).toMatchObject({ pieces: 0, includedCents: 0 });
  });

  test("a configurator that does not offer it ignores the flag everywhere", async () => {
    const s = await setup();
    const a = calculatePrice(s.payload, pieces.map((p) => ({ ...p, withDisposal: true })));
    const b = calculatePrice(s.payload, pieces);
    expect(a.priceExVatCents).toBe(b.priceExVatCents);
    expect(a.disposal).toBeUndefined();
    const id = await widgetQuote(s, pieces.map((p) => ({ ...p, withDisposal: true })));
    expect((await s.t.run((ctx) => ctx.db.get(id)))?.priceExVatCents).toBe(b.priceExVatCents);
  });
});
