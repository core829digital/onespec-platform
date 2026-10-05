import { describe, expect, it } from "vitest";
import { calculatePrice, installationIncluded, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { ProjectItemSchema } from "@/shared/widget-types";

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

// 1 m² of window = 200,00 €; fitting 80,00 €/m².
describe("fitting (posa) priced per m²", () => {
  it("without a posa price nothing changes and there is nothing to choose", () => {
    const p = calculatePrice(payload(), [item()]);
    expect(p.priceExVatCents).toBe(20000);
    expect(p.installation).toBeUndefined();
    expect(installationIncluded(payload(), [item()])).toBeUndefined();
  });

  it("included: supply + fitting, both totals reported", () => {
    const p = calculatePrice(payload({ installationPerM2Cents: 8000, installationDefault: "with" }), [item()]);
    expect(p.priceExVatCents).toBe(28000);
    expect(p.priceCents).toBe(28000 + Math.round(28000 * 0.22));
    expect(p.installation).toEqual({ perM2Cents: 8000, includedCents: 8000, exVatWithCents: 28000, exVatWithoutCents: 20000 });
    expect(p.items[0].installationCents).toBe(8000);
  });

  it("supply only: the customer fits the windows themselves", () => {
    const p = calculatePrice(payload({ installationPerM2Cents: 8000 }), [item({ withInstallation: false })]);
    expect(p.priceExVatCents).toBe(20000);
    expect(p.installation).toMatchObject({ includedCents: 0, exVatWithCents: 28000, exVatWithoutCents: 20000 });
    expect(p.items[0].installationCents).toBeUndefined();
  });

  it("the configurator default applies when the piece does not say, the piece wins when it does", () => {
    const cfg = { installationPerM2Cents: 8000, installationDefault: "without" as const };
    expect(calculatePrice(payload(cfg), [item()]).priceExVatCents).toBe(20000);
    expect(calculatePrice(payload(cfg), [item({ withInstallation: true })]).priceExVatCents).toBe(28000);
    expect(installationIncluded(payload(cfg), [item()])).toBe(false);
    expect(installationIncluded(payload(cfg), [item({ withInstallation: true })])).toBe(true);
  });

  it("the margin applies to the windows, not to the fitting price the installer typed", () => {
    const p = calculatePrice(payload({ marginPercent: 50, installationPerM2Cents: 8000 }), [item()]);
    expect(p.priceExVatCents).toBe(30000 + 8000);
    expect(p.installation?.exVatWithoutCents).toBe(30000);
  });

  it("area and quantity scale it; mixed pieces", () => {
    const p = calculatePrice(payload({ installationPerM2Cents: 8000 }), [item({ width: 1200, height: 1400, quantity: 2 }), item({ withInstallation: false })]);
    // 1.68 m² -> 134,40 per piece, two pieces; the second piece is supply only.
    expect(p.installation?.includedCents).toBe(2 * 13440);
    expect(p.installation!.exVatWithCents - p.installation!.exVatWithoutCents).toBe(2 * 13440 + 8000);
    expect(p.priceExVatCents).toBe(p.installation!.exVatWithoutCents + 2 * 13440);
  });

  it("the rounding step applies to every total", () => {
    const p = calculatePrice(payload({ priceRoundingStep: 500, installationPerM2Cents: 8100 }), [item()]);
    expect(p.priceExVatCents % 500).toBe(0);
    expect(p.installation!.exVatWithCents % 500).toBe(0);
    expect(p.installation!.exVatWithoutCents % 500).toBe(0);
  });

  it("the server schema keeps the flag and refuses a non-boolean", () => {
    const ok = ProjectItemSchema.safeParse(item({ withInstallation: false }));
    expect(ok.success && ok.data.withInstallation).toBe(false);
    expect(ProjectItemSchema.safeParse({ ...item(), withInstallation: "yes" }).success).toBe(false);
  });
});

import { fittingNote } from "@/shared/fitting";
import { exportInputFromQuote } from "@/lib/quote-export/from-quote";
import { buildTxt } from "@/lib/quote-export/generators";
import { buildExportModel } from "@/lib/quote-export/model";
import { calculate, defaultConfig, includesFitting } from "@/components/widget/widget-pricing";
import { catalogPricing, type WidgetCatalog } from "@/components/widget/widget-catalog";

describe("the same choice in the widget and on the server", () => {
  it("what the fitting adds is the same to the cent, whatever the rest of the catalogue prices", () => {
    const p = payload({ marginPercent: 12.5, installationPerM2Cents: 8050, installationDefault: "with" });
    const pricing = catalogPricing(p as unknown as WidgetCatalog);
    const serverAdds = (w: number, h: number, q: number) =>
      calculatePrice(p, [item({ width: w, height: h, quantity: q, withInstallation: true })]).priceExVatCents -
      calculatePrice(p, [item({ width: w, height: h, quantity: q, withInstallation: false })]).priceExVatCents;
    for (const [w, h, q] of [[1234, 1567, 2], [1000, 1000, 1], [987, 1763, 3]] as const) {
      const base = { ...defaultConfig(), width: w, height: h, quantity: q };
      const widgetAdds = calculate({ ...base, withInstallation: true }, pricing).totalPrice - calculate({ ...base, withInstallation: false }, pricing).totalPrice;
      expect(Math.round(widgetAdds * 100)).toBe(serverAdds(w, h, q));
    }
    expect(includesFitting({ withInstallation: undefined }, pricing)).toBe(true);
    expect(includesFitting({ withInstallation: false }, pricing)).toBe(false);
    expect(includesFitting({ withInstallation: true }, { ...pricing, installationPerM2: 0 })).toBe(false);
  });
});

describe("what the documents say", () => {
  it("one sentence per case in six languages, nothing when fitting is not priced by m²", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"]) {
      expect(fittingNote(true, l).length).toBeGreaterThan(10);
      expect(fittingNote(false, l)).not.toBe(fittingNote(true, l));
    }
    expect(fittingNote(undefined, "it")).toBe("");
    expect(fittingNote(false, "it")).toContain("Solo fornitura");
  });

  it("the text export of a saved quote carries it", () => {
    const p = payload({ installationPerM2Cents: 8000 });
    const quote = { _creationTime: 1, leadName: "Mario", items: [item({ withInstallation: false })], priceCents: 24400, vatRatePercent: 22, installationIncluded: false };
    const input = exportInputFromQuote(quote, p, { name: "Rossi Srl" }, { locale: "it" });
    expect(input.money.fittingNote).toContain("Solo fornitura");
    expect(input.money.supplyExVatCents).toBe(20000);
    expect(buildTxt(buildExportModel(input))).toContain("Solo fornitura");
  });
});
