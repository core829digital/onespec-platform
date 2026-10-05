import { describe, expect, it } from "vitest";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { resolveStandardPrice, standardProfileByKey, toSupplyCents } from "@/shared/standard-pricing";
import { calculate, defaultConfig } from "@/components/widget/widget-pricing";
import { catalogPricing, type WidgetCatalog } from "@/components/widget/widget-catalog";

const PROFILE = "std_aluplast_ideal_4000";
// Market mid prices (260-310, 240-290, 220-270 EUR/m2) turned into supply prices by the calibration factor.
const NORD = toSupplyCents(28500);
const CENTRO = toSupplyCents(26500);
const SUD = toSupplyCents(24500);
const row = <T extends object>(r: T) => ({ sortOrder: 0, enabled: true, labels: { it: "x" }, ...r });

function payload(over: { configurator?: Partial<CatalogPayload["configurator"]>; zone?: "nord" | "centro" | "sud"; finishMult?: number; triple?: boolean } = {}): CatalogPayload {
  const zone = over.zone ?? "nord";
  const std = resolveStandardPrice(standardProfileByKey(PROFILE)!, zone);
  return {
    configurator: { publicId: "p", name: "t", defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR", ...over.configurator },
    branding: null,
    materials: [row({ key: "pvc", basePerM2Cents: 18000, profilePerMlCents: 2800 })],
    qualityTiers: [row({ materialKey: "pvc", key: "chamber5", multiplier: 1 })],
    profileSystems: [
      row({ materialKey: "pvc", key: PROFILE, multiplier: 1, standardKey: PROFILE, standard: std }),
      row({ materialKey: "pvc", key: "legacy", multiplier: 1.5 }),
    ],
    sizeConstraints: [],
    glazing: [
      row({ key: "double", priceCents: 0 }),
      row({ key: "triple", priceCents: 0, pricePerM2Cents: 6000 }),
    ],
    finish: [
      row({ key: "white", priceCents: 0 }),
      row({ key: "ral", priceCents: 0, multiplier: over.finishMult ?? 1.2 }),
    ],
    hardware: [
      row({ kind: "sashType", key: "tiltturn", priceCents: 0, appliesToOperableOnly: true }),
      row({ kind: "sashType", key: "classic", priceCents: 0, appliesToOperableOnly: true }),
      row({ kind: "hardware", key: "maco", priceCents: 0, appliesToOperableOnly: true }),
      row({ kind: "hardwareColor", key: "white", priceCents: 0, appliesToOperableOnly: true }),
      row({ kind: "installation", key: "classico", priceCents: 0, appliesToOperableOnly: false }),
    ],
  } as unknown as CatalogPayload;
}

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window",
  material: "pvc",
  quality: { pvc: "chamber5" },
  profileSystem: PROFILE,
  width: 1200,
  height: 1400,
  quantity: 1,
  glazing: "double",
  color: "white",
  insectScreen: false,
  sashes: [
    { type: "classic", direction: "left", active: true, hardware: "maco", hardwareColor: "white" },
    { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
  ],
  ...over,
} as ProjectItem);

const unit = (p: CatalogPayload, it: ProjectItem) => calculatePrice(p, [it]).items[0];

describe("standard price list in the price engine", () => {
  const AREA = 1.2 * 1.4; // 1.68 m²

  it("prices a profile at its complete price per m² of the zone (middle of the range)", () => {
    expect(unit(payload({ configurator: { pricingMode: "standard" } }), item()).unitPrice).toBe(Math.round(NORD * AREA));
    expect(unit(payload({ configurator: { pricingMode: "standard" }, zone: "sud" }), item()).unitPrice).toBe(Math.round(SUD * AREA));
    expect(unit(payload({ configurator: { pricingMode: "standard" }, zone: "centro" }), item()).unitPrice).toBe(Math.round(CENTRO * AREA));
  });

  it("is off unless the catalogue is in standard mode: the catalogue's own prices stay in charge", () => {
    const custom = unit(payload(), item());
    expect(custom.unitPrice).toBe(Math.round(18000 * AREA) + Math.round(2800 * 2 * (1.2 + 1.4)));
    expect(unit(payload({ configurator: { pricingMode: "custom" } }), item()).unitPrice).toBe(custom.unitPrice);
  });

  it("a profile without a price list entry falls back to the catalogue's price even in standard mode", () => {
    const std = payload({ configurator: { pricingMode: "standard" } });
    expect(unit(std, item({ profileSystem: "legacy" })).unitPrice).toBe(Math.round(18000 * 1.5 * AREA) + Math.round(2800 * 2 * (1.2 + 1.4)));
  });

  it("a coloured frame adds the colour surcharge; triple glazing adds its price per m²", () => {
    const std = payload({ configurator: { pricingMode: "standard" } });
    expect(unit(std, item({ color: "ral" })).unitPrice).toBe(Math.round(NORD * 1.2 * AREA));
    expect(unit(std, item({ glazing: "triple" })).unitPrice).toBe(Math.round(NORD * AREA) + Math.round(6000 * AREA));
  });

  it("the margin is applied to the whole unit price, with decimals, in whole cents", () => {
    const base = Math.round(NORD * AREA);
    for (const [m, expected] of [[0, base], [25, Math.round((base * 12500) / 10000)], [12.5, Math.round((base * 11250) / 10000)], [7.35, Math.round((base * 10735) / 10000)], [0.01, Math.round((base * 10001) / 10000)]] as const) {
      const r = unit(payload({ configurator: { pricingMode: "standard", marginPercent: m } }), item());
      expect(r.unitPrice).toBe(expected);
      expect(r.marginCents ?? 0).toBe(expected - base);
    }
  });

  it("the margin also works on catalogues without the price list, and multiplies by the quantity", () => {
    const r = unit(payload({ configurator: { marginPercent: 10 } }), item({ quantity: 3 }));
    const base = Math.round(18000 * AREA) + Math.round(2800 * 2 * (1.2 + 1.4));
    expect(r.unitPrice).toBe(Math.round(base * 1.1));
    expect(r.itemTotalCents).toBe(Math.round(base * 1.1) * 3);
  });

  it("a negative, zero or absurd margin cannot lower the price or run away", () => {
    const base = unit(payload({ configurator: { pricingMode: "standard" } }), item()).unitPrice;
    expect(unit(payload({ configurator: { pricingMode: "standard", marginPercent: -20 } }), item()).unitPrice).toBe(base);
    expect(unit(payload({ configurator: { pricingMode: "standard", marginPercent: 1e9 } }), item()).unitPrice).toBe(Math.round(base * 4));
  });
});

describe("calibration to the Winarhi reference quote", () => {
  it("Aluplast Ideal 4000, Centro, 1432 x 1548, double glazing, no margin: 420.00 EUR net (supply + factory transport), VAT added on top", () => {
    const p = payload({ configurator: { pricingMode: "standard" }, zone: "centro" });
    const r = calculatePrice(p, [item({ width: 1432, height: 1548 })]);
    expect(r.priceExVatCents).toBe(42000);
    expect(r.priceCents).toBe(42000 + Math.round(42000 * 0.22));
  });

  it("the same factor moves every zone and profile: the zones keep their distance", () => {
    const at = (zone: "nord" | "centro" | "sud") => calculatePrice(payload({ configurator: { pricingMode: "standard" }, zone }), [item({ width: 1432, height: 1548 })]).priceExVatCents;
    expect(at("nord")).toBeGreaterThan(at("centro"));
    expect(at("centro")).toBeGreaterThan(at("sud"));
    // Market ratio nord:centro = 285:265
    expect(at("nord") / at("centro")).toBeCloseTo(285 / 265, 3);
  });
});

describe("the widget's live estimate agrees with the server price", () => {
  const cases: Array<{ name: string; cfg: Partial<CatalogPayload["configurator"]>; zone?: "nord" | "centro" | "sud"; glazing?: string; color?: string; w?: number; h?: number; q?: number }> = [
    { name: "standard Nord", cfg: { pricingMode: "standard" } },
    { name: "standard Sud with margin 12.5%", cfg: { pricingMode: "standard", marginPercent: 12.5 }, zone: "sud" },
    { name: "standard Centro, triple glazing, colour, margin 7.35%, 3 pieces", cfg: { pricingMode: "standard", marginPercent: 7.35 }, zone: "centro", glazing: "triple", color: "ral", q: 3 },
    { name: "custom catalogue with margin", cfg: { marginPercent: 20 } },
    { name: "odd size", cfg: { pricingMode: "standard", marginPercent: 33.33 }, w: 987, h: 1763 },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const p = payload({ configurator: c.cfg, zone: c.zone });
      const it_ = item({ glazing: c.glazing ?? "double", color: c.color ?? "white", width: c.w ?? 1200, height: c.h ?? 1400, quantity: c.q ?? 1 });
      const server = unit(p, it_);
      const pricing = catalogPricing(p as unknown as WidgetCatalog);
      const state = { ...defaultConfig(), brand: { pvc: PROFILE, aluminum: "aluprof" }, width: it_.width, height: it_.height, glazing: it_.glazing, color: it_.color, quantity: it_.quantity, installation: "classico" };
      const widget = calculate(state, pricing);
      expect(Math.round(widget.unitPrice * 100)).toBe(server.unitPrice);
      expect(Math.round(widget.totalPrice * 100)).toBe(server.itemTotalCents);
    });
  }
});

describe("delivery by the installer's own transporter / fitter (EUR per m2, VAT excluded)", () => {
  const AREA = 1.2 * 1.4;
  const base = Math.round(toSupplyCents(26500) * AREA);
  const centro = (over: object) => unit(payload({ configurator: { pricingMode: "standard", ...over } as never, zone: "centro" }), item());

  it("factory mode (default): nothing is added; own mode adds rate x area to each piece, before the margin", () => {
    expect(centro({}).unitPrice).toBe(base);
    expect(centro({ deliveryMode: "factory", ownServicePerM2Cents: 1500 }).unitPrice).toBe(base);
    const own = centro({ deliveryMode: "own", ownServicePerM2Cents: 1500 });
    expect(own.serviceCost).toBe(Math.round(1500 * AREA));
    expect(own.unitPrice).toBe(base + Math.round(1500 * AREA));
    const withMargin = centro({ deliveryMode: "own", ownServicePerM2Cents: 1500, marginPercent: 10 });
    expect(withMargin.unitPrice).toBe(Math.round(((base + Math.round(1500 * AREA)) * 11000) / 10000));
  });

  it("a negative or missing rate adds nothing; the quantity multiplies", () => {
    expect(centro({ deliveryMode: "own", ownServicePerM2Cents: -500 }).unitPrice).toBe(base);
    expect(centro({ deliveryMode: "own" }).unitPrice).toBe(base);
    const q = unit(payload({ configurator: { pricingMode: "standard", deliveryMode: "own", ownServicePerM2Cents: 1500 } as never, zone: "centro" }), item({ quantity: 3 }));
    expect(q.itemTotalCents).toBe(q.unitPrice * 3);
  });

  it("the widget's live estimate agrees with the server price (decimals included)", () => {
    for (const [rateCents, margin] of [[1500, 0], [1234, 12.5], [1, 0.01], [99999, 7.35]] as const) {
      const configurator = { pricingMode: "standard" as const, deliveryMode: "own" as const, ownServicePerM2Cents: rateCents, marginPercent: margin };
      const p = payload({ configurator, zone: "centro" });
      const server = unit(p, item({ width: 1432, height: 1548 })).unitPrice;
      const pricing = catalogPricing({
        configurator,
        materials: p.materials, qualityTiers: p.qualityTiers, profileSystems: p.profileSystems, glazing: p.glazing, finish: p.finish, hardware: p.hardware,
      } as unknown as WidgetCatalog);
      const state = { ...defaultConfig(), width: 1432, height: 1548, quality: { pvc: "chamber5", wood: "pine", aluminum: "standard" }, brand: { pvc: PROFILE, aluminum: "x" }, glazing: "double", color: "white" };
      const client = calculate({ ...state, sashes: [{ type: "classic", direction: "left", active: true, hardware: "maco", hardwareColor: "white" }, { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" }] } as never, pricing).unitPrice;
      expect(Math.abs(client * 100 - server)).toBeLessThanOrEqual(1);
    }
  });
});
