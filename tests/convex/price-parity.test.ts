import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { computeCalculationPreview } from "../../convex/lib/calcPreview";
import { pricingPayload } from "../../src/components/widget/widget-catalog";
import { quoteTotals, regionalExtrasCents } from "../../src/shared/quote-totals";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * The three configurators (public widget, Showroom, B2B quote) must show the same price for the same pieces.
 * Each is driven here the way it is in the product, from the same published catalogue.
 */
const pieces: ProjectItem[] = [
  { ...sampleItem, width: 1200, height: 1400 },
  { ...sampleItem, width: 900, height: 1300, quantity: 2, profileSystem: "premium", insectScreen: true, insectScreenType: "molla", insectScreenColor: "brown" },
  { ...sampleItem, width: 1000, height: 2400, quantity: 1, installation: "posaClima", transoms: [800] },
] as ProjectItem[];

async function setup() {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "PARITY_01");
  const payload = (await t.run(async (ctx) => (await ctx.db.query("catalogVersions").first())!.payload)) as unknown as CatalogPayload;
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  return { t, seeded, configuratorId, payload, asOwner };
}

describe("same pieces, same price in widget, Showroom and B2B quote", () => {
  test("engine, Showroom and widget agree to the cent", async () => {
    const { payload } = await setup();
    const engine = calculatePrice(payload, pieces);

    // Showroom: the preview the in-app calculator shows.
    const showroom = computeCalculationPreview(payload, 1, pieces, { regionCode: "IT", buildingAge: 20, isEnergyRenovation: false, deductionPercent: 0 });
    expect(showroom.priceExVatCents).toBe(engine.priceExVatCents);
    expect(showroom.priceCents).toBe(engine.priceCents);

    // Widget: per-piece totals from the published catalogue, then VAT in whole cents.
    const wp = pricingPayload(payload as never)!;
    const perPiece = pieces.map((p) => calculatePrice(wp, [p]).items[0].itemTotalCents);
    const net = perPiece.reduce((s, c) => s + c, 0);
    expect(net).toBe(engine.priceExVatCents);
    const gross = quoteTotals({ supplyExVatCents: net, installCents: 0, demolitionCents: 0, regionalCents: 0, discountPercent: 0, vatPercent: 22 }).grossCents;
    expect(gross).toBe(engine.priceCents);
  });

  test("a B2B quote with no extras records exactly the engine's price", async () => {
    const { payload, asOwner, seeded, configuratorId } = await setup();
    const engine = calculatePrice(payload, pieces);
    const { priceCents } = await asOwner.mutation(api.quotes.createFieldQuote, {
      tenantId: seeded.tenantId,
      configuratorId,
      leadName: "Mario",
      leadEmail: "m@example.com",
      items: pieces,
      vatRatePercent: 22,
      asDraft: true,
    });
    expect(priceCents).toBe(engine.priceCents);
  });

  test("Showroom VAT panel pairs the region rate with its own amounts, not the configurator's (#34)", async () => {
    const { payload } = await setup();
    // A French configurator at its default 10% — the region policy selects 5.5%
    // (energy renovation) and 21% (BE, young building) while the configurator
    // prices at 10%: the displayed row must derive its cents from the SAME
    // rate as its label.
    const fr = { ...payload, configurator: { ...payload.configurator, vatRatePercent: 10 } };
    const net = calculatePrice(fr, [sampleItem]).priceExVatCents;

    const frEnergy = computeCalculationPreview(fr, 1, [sampleItem], { regionCode: "FR", buildingAge: 20, isEnergyRenovation: true, deductionPercent: 0 });
    expect(frEnergy.vatBreakdown[0]!.rate).toBe(0.055);
    expect(frEnergy.vatBreakdown[0]!.vatCents).toBe(Math.round(net * 0.055));
    expect(frEnergy.vatBreakdown[0]!.totalCents).toBe(net + Math.round(net * 0.055));

    const be = computeCalculationPreview(fr, 1, [sampleItem], { regionCode: "BE", buildingAge: 5, isEnergyRenovation: false, deductionPercent: 0 });
    expect(be.vatBreakdown[0]!.rate).toBe(0.21);
    expect(be.vatBreakdown[0]!.vatCents).toBe(Math.round(net * 0.21));
    expect(be.vatBreakdown[0]!.totalCents).toBe(net + Math.round(net * 0.21));
  });

  test("IT eligibility badge and funding document share one Uw limit (#43)", async () => {
    const { payload } = await setup();
    // Push the weighted Uw into the interval where the two old constants
    // disagreed: (1.3, 1.4]. The badge and the ENEA document must give the
    // same verdict — one limit (1.4, DM 6 agosto 2020 for serramenti).
    const glazed = { ...payload, glazing: payload.glazing.map((g) => ({ ...g, uGlass: 1.2 })) };
    const preview = computeCalculationPreview(glazed, 1, [sampleItem], { regionCode: "IT", buildingAge: 20, isEnergyRenovation: false, deductionPercent: 0 });
    expect(preview.uwWeightedAverage).toBeGreaterThan(1.3);
    expect(preview.uwWeightedAverage).toBeLessThanOrEqual(1.4);
    expect(preview.uwEligible).toBe(true);
    expect(preview.fundingDocParams!.conform).toBe(preview.uwEligible);
    expect(preview.fundingDocParams!.uwLimit).toBe(1.4);
  });

  test("B2B extras: the editor's arithmetic and the server's are one function", async () => {
    const { payload, asOwner, seeded, configuratorId, t } = await setup();
    const engine = calculatePrice(payload, pieces);
    const expected = quoteTotals({ supplyExVatCents: engine.priceExVatCents, installCents: 25_000, demolitionCents: 5_000, regionalCents: 0, discountPercent: 7.5, vatPercent: 22 });
    const { quoteId, priceCents } = await asOwner.mutation(api.quotes.createFieldQuote, {
      tenantId: seeded.tenantId,
      configuratorId,
      leadName: "Mario",
      leadEmail: "m@example.com",
      items: pieces,
      vatRatePercent: 22,
      installationPriceCents: 25_000,
      demolitionPriceCents: 5_000,
      discountPercent: 7.5,
      asDraft: true,
    });
    expect(priceCents).toBe(expected.grossCents);
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.priceExVatCents).toBe(expected.discountedExVatCents);
  });

  test("a fresh quote adds nothing the other two do not: every regional lump starts at zero", () => {
    for (const region of ["IT", "FR", "BE", "NL", "DE", "LU"]) {
      expect(regionalExtrasCents(region, { hvlJointCount: 0, isostoneSill: false, inmeetServiceEuros: 0, rensonGrilleWidthMm: 0, voletMonoblocHeightMm: 0, ralMontage: false, rcSecurityLevel: "standard", pieceCount: 3 })).toBe(0);
    }
  });
});
