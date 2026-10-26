import { describe, expect, it } from "vitest";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { ProjectItemSchema } from "@/shared/widget-types";
import { MAX_DISPOSAL_PRICE_CENTS, disposalCharge, disposalOffered, itemHasDisposal } from "@/shared/disposal";

const row = <T extends object>(r: T) => ({ sortOrder: 0, enabled: true, labels: { it: "x" }, ...r });
const payload = (cfg: Partial<CatalogPayload["configurator"]> = {}): CatalogPayload =>
  ({
    configurator: { publicId: "p", name: "t", defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR", ...cfg },
    branding: null,
    materials: [row({ key: "pvc", basePerM2Cents: 20000, profilePerMlCents: 0 })],
    qualityTiers: [row({ materialKey: "pvc", key: "c5", multiplier: 1 })],
    profileSystems: [],
    sizeConstraints: [],
    glazing: [row({ key: "double", priceCents: 0 })],
    finish: [row({ key: "white", priceCents: 0 })],
    hardware: [row({ kind: "sashType", key: "fix", priceCents: 0, appliesToOperableOnly: false })],
  }) as unknown as CatalogPayload;

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 1000, height: 1000, quantity: 1,
  sashes: [{ type: "fix", direction: "left", active: true, hardware: "", hardwareColor: "" }], glazing: "double", color: "white", insectScreen: false, ...over,
});

// 1 m² of window = 200,00 €. Disposal 35,00 € per piece, or 150,00 € per job.
const perPiece = { disposalModel: "perPiece" as const, disposalPriceCents: 3500, disposalDefault: "with" as const };
const perJob = { disposalModel: "perJob" as const, disposalPriceCents: 15000, disposalDefault: "with" as const };

describe("disposal of the old windows", () => {
  it("is not offered without a price: nothing changes", () => {
    const p = calculatePrice(payload(), [item()]);
    expect(p.priceExVatCents).toBe(20000);
    expect(p.disposal).toBeUndefined();
    expect(disposalOffered({})).toBe(false);
    expect(disposalOffered({ disposalPriceCents: 0, disposalModel: "perJob" })).toBe(false);
  });

  it("per piece: the price counts for every piece, quantity included", () => {
    const p = calculatePrice(payload(perPiece), [item({ quantity: 3 }), item({ quantity: 2 })]);
    expect(p.priceExVatCents).toBe(5 * 20000 + 5 * 3500);
    expect(p.disposal).toEqual({ model: "perPiece", priceCents: 3500, pieces: 5, includedCents: 17500 });
    // The pieces keep their own price: the disposal is a line of its own.
    expect(p.items[0].itemTotalCents).toBe(60000);
    expect(p.items[1].itemTotalCents).toBe(40000);
  });

  it("per job: one flat price however many pieces have it", () => {
    const one = calculatePrice(payload(perJob), [item()]);
    const many = calculatePrice(payload(perJob), [item({ quantity: 4 }), item({ quantity: 7 })]);
    expect(one.priceExVatCents).toBe(20000 + 15000);
    expect(many.priceExVatCents).toBe(11 * 20000 + 15000);
    expect(many.disposal).toEqual({ model: "perJob", priceCents: 15000, pieces: 11, includedCents: 15000 });
  });

  it("the customer opts in by default; the piece's own choice wins over the configurator's default", () => {
    const optIn = { disposalModel: "perPiece" as const, disposalPriceCents: 3500 };
    expect(calculatePrice(payload(optIn), [item()]).priceExVatCents).toBe(20000);
    expect(calculatePrice(payload(optIn), [item()]).disposal).toMatchObject({ pieces: 0, includedCents: 0 });
    expect(calculatePrice(payload(optIn), [item({ withDisposal: true })]).priceExVatCents).toBe(23500);
    expect(calculatePrice(payload(perPiece), [item({ withDisposal: false })]).priceExVatCents).toBe(20000);
    expect(itemHasDisposal(optIn, {})).toBe(false);
    expect(itemHasDisposal(perPiece, {})).toBe(true);
    expect(itemHasDisposal({}, { withDisposal: true })).toBe(false);
  });

  it("per piece counts only the pieces that have it", () => {
    const p = calculatePrice(payload(perPiece), [item({ quantity: 2 }), item({ quantity: 3, withDisposal: false })]);
    expect(p.disposal).toMatchObject({ pieces: 2, includedCents: 7000 });
    expect(p.priceExVatCents).toBe(5 * 20000 + 7000);
  });

  it("the margin applies to the windows only, not to the disposal price the installer typed", () => {
    const p = calculatePrice(payload({ ...perPiece, marginPercent: 50 }), [item()]);
    expect(p.priceExVatCents).toBe(30000 + 3500);
  });

  it("VAT is added on the whole net, disposal included, at any rate (0% too)", () => {
    const p = calculatePrice(payload(perPiece), [item()]);
    expect(p.priceCents).toBe(23500 + Math.round(23500 * 0.22));
    const zero = calculatePrice(payload({ ...perPiece, vatRatePercent: 0 }), [item()]);
    expect(zero.priceCents).toBe(23500);
  });

  it("works together with the fitting: both totals carry the disposal, the fitting figure stays the fitting only", () => {
    const p = calculatePrice(payload({ ...perJob, installationPerM2Cents: 8000, installationDefault: "with" }), [item()]);
    expect(p.priceExVatCents).toBe(20000 + 8000 + 15000);
    expect(p.installation).toEqual({ perM2Cents: 8000, includedCents: 8000, exVatWithCents: 43000, exVatWithoutCents: 35000 });
  });

  it("the price rounding step applies to the total, disposal included", () => {
    const p = calculatePrice(payload({ ...perPiece, priceRoundingStep: 1000 }), [item()]);
    expect(p.priceExVatCents).toBe(24000);
  });

  it("treats a price that is not a whole positive number of cents as not offered", () => {
    for (const bad of [-1, 0, 12.5, Number.NaN, MAX_DISPOSAL_PRICE_CENTS + 1]) {
      expect(disposalCharge({ disposalPriceCents: bad }, [item()])).toBeUndefined();
    }
    expect(disposalCharge({ disposalPriceCents: MAX_DISPOSAL_PRICE_CENTS, disposalDefault: "with" }, [item()])?.includedCents).toBe(MAX_DISPOSAL_PRICE_CENTS);
  });

  it("an unknown model falls back to per piece", () => {
    expect(disposalCharge({ disposalPriceCents: 3500, disposalModel: "weird" as never, disposalDefault: "with" }, [item({ quantity: 2 })])?.model).toBe("perPiece");
  });

  it("the public widget's item schema accepts the choice and rejects a non-boolean", () => {
    const base = JSON.parse(JSON.stringify(item()));
    expect(ProjectItemSchema.safeParse({ ...base, withDisposal: true }).success).toBe(true);
    expect(ProjectItemSchema.safeParse({ ...base, withDisposal: "yes" }).success).toBe(false);
  });
});
