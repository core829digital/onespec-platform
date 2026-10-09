import { describe, expect, it } from "vitest";
import { calculatePrice, isBicolor, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
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
    finish: [
      row({ key: "white", priceCents: 0 }),
      row({ key: "anthracite", priceCents: 4000, multiplier: 1.2 }),
      row({ key: "woodgrain", priceCents: 8000, multiplier: 1.4 }),
    ],
    hardware: [row({ kind: "sashType", key: "fix", priceCents: 0, appliesToOperableOnly: false })],
  }) as unknown as CatalogPayload;

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 1000, height: 1000, quantity: 1,
  sashes: [{ type: "fix", direction: "left", active: true, hardware: "", hardwareColor: "" }], glazing: "double", color: "white", insectScreen: false, ...over,
});

const price = (cfg: Partial<CatalogPayload["configurator"]>, over: Partial<ProjectItem>) => calculatePrice(payload(cfg), [item(over)]).priceExVatCents;

describe("bicolour (different finish inside and outside)", () => {
  it("is only a bicolour when the inside differs", () => {
    expect(isBicolor({ color: "white" })).toBe(false);
    expect(isBicolor({ color: "white", colorInside: "white" })).toBe(false);
    expect(isBicolor({ color: "white", colorInside: "anthracite" })).toBe(true);
  });

  it("same finish on both faces costs exactly the one-colour price", () => {
    expect(price({}, { color: "anthracite", colorInside: "anthracite" })).toBe(price({}, { color: "anthracite" }));
  });

  it("different faces average multiplier and flat price", () => {
    // 1 m²: 200,00 × mean(1.2, 1.0) = 220,00 + mean(40,00, 0) = 20,00
    expect(price({}, { color: "anthracite", colorInside: "white" })).toBe(24000);
    // symmetric
    expect(price({}, { color: "white", colorInside: "anthracite" })).toBe(24000);
    // 200 × mean(1.2, 1.4) = 260 + mean(40, 80) = 60
    expect(price({}, { color: "anthracite", colorInside: "woodgrain" })).toBe(32000);
  });

  it("adds the installer's bicolour surcharge per m², not for one colour", () => {
    expect(price({ bicolorPerM2Cents: 2500 }, { color: "anthracite", colorInside: "white" })).toBe(24000 + 2500);
    expect(price({ bicolorPerM2Cents: 2500 }, { color: "anthracite" })).toBe(price({}, { color: "anthracite" }));
  });

  it("switched off: the inside choice is ignored, never charged", () => {
    expect(price({ bicolorEnabled: false, bicolorPerM2Cents: 2500 }, { color: "anthracite", colorInside: "white" })).toBe(price({}, { color: "anthracite" }));
  });

  it("an unknown inside finish is ignored for the price", () => {
    expect(price({}, { color: "anthracite", colorInside: "nope" })).toBe(price({}, { color: "anthracite" }));
  });

  it("the public widget schema accepts the inside colour", () => {
    const parsed = ProjectItemSchema.safeParse({
      productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 1000, height: 1000, quantity: 1,
      sashes: [{ type: "fix", direction: "left", active: true, hardware: "x", hardwareColor: "y" }], glazing: "double", color: "anthracite", colorInside: "white", insectScreen: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.colorInside).toBe("white");
  });
});
