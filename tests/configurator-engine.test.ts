import { describe, expect, test } from "vitest";
import {
  CATEGORY_DEFS,
  DEFAULT_ACCESSORIES,
  DEFAULT_FRAME_TYPES,
  PIECE_CATEGORIES,
  defaultSashesFor,
  handleRange,
  leafClass,
} from "../src/shared/configurator-model";
import { sashTypeAllowedWith } from "../src/shared/sash-rules";
import {
  accessoriesCents,
  calculatePrice,
  computeInstallation,
  computeItemThermal,
  computeOverallUw,
  type CatalogPayload,
  type ProjectItem,
} from "../src/shared/pricing";
import { ProjectItemSchema } from "../src/shared/widget-types";

const catalog = {
  configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
  branding: null,
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 20000, profilePerMlCents: 1000, uFrameBase: 1.3, sortOrder: 0, enabled: true }],
  qualityTiers: [{ materialKey: "pvc", key: "chamber5", labels: { it: "5" }, multiplier: 1, uAdjust: 0, sortOrder: 0, enabled: true }],
  profileSystems: [
    { materialKey: "pvc", key: "standard", labels: { it: "Std" }, multiplier: 1, sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "schuco", labels: { it: "Schüco" }, multiplier: 1.55, uFrame: 0.88, group: "tab2", sortOrder: 1, enabled: true },
  ],
  sizeConstraints: [],
  glazing: [
    { key: "double", labels: { it: "Doppio" }, priceCents: 0, uGlass: 1.0, sortOrder: 0, enabled: true },
    { key: "triple", labels: { it: "Triplo" }, priceCents: 0, uGlass: 0.6, psi: 0.032, multiplier: 1.24, sortOrder: 1, enabled: true },
  ],
  finish: [
    { key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true },
    { key: "wood", labels: { it: "Legno" }, priceCents: 0, multiplier: 1.3, sortOrder: 1, enabled: true },
  ],
  hardware: [
    { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 5000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "sashType", key: "tilt", labels: { it: "Vasistas" }, priceCents: 2000, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
    { kind: "hardware", key: "standard", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardware", key: "rc2", labels: { it: "RC2" }, priceCents: 5500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "hardwareColor", key: "silver", labels: { it: "Argento" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  ],
  frameTypes: DEFAULT_FRAME_TYPES,
  accessories: [
    { category: "zanz", key: "flat", labels: { it: "f" }, priceModel: "flat", priceCents: 4000, sortOrder: 0, enabled: true },
    { category: "cass", key: "m2", labels: { it: "m" }, priceModel: "perM2", priceCents: 10000, sortOrder: 0, enabled: true },
    { category: "avv", key: "ml", labels: { it: "l" }, priceModel: "perMl", priceCents: 2000, sortOrder: 0, enabled: true },
    { category: "pers", key: "off", labels: { it: "o" }, priceModel: "flat", priceCents: 9999, sortOrder: 0, enabled: false },
  ],
  productBase: [{ category: "porta", basePriceCents: 30000, enabled: true }],
} as unknown as CatalogPayload;

function item(over: Partial<ProjectItem> = {}): ProjectItem {
  return {
    productType: "window",
    category: "finestra1",
    material: "pvc",
    quality: { pvc: "chamber5" },
    width: 900,
    height: 1300,
    quantity: 1,
    sashes: [{ type: "tiltturn", direction: "left", active: true, hardware: "standard", hardwareColor: "silver", main: true }],
    glazing: "double",
    color: "white",
    insectScreen: false,
    ...over,
  };
}

describe("piece categories", () => {
  test("every category starts with the right number of leaves, ratios that add up and a main leaf when operable", () => {
    for (const key of PIECE_CATEGORIES) {
      const def = CATEGORY_DEFS[key];
      const sashes = defaultSashesFor(key, def.defaultHeightMm);
      expect(sashes.length, key).toBe(def.leaves);
      expect(sashes.reduce((s, x) => s + x.widthRatio, 0), key).toBeCloseTo(1, 6);
      if (sashes.some((s) => s.type !== "fix")) expect(sashes.filter((s) => s.main).length, key).toBe(1);
      const parsed = ProjectItemSchema.safeParse({
        ...item({ category: key, productType: def.productType, width: def.defaultWidthMm, height: def.defaultHeightMm }),
        sashes,
      });
      expect(parsed.success, key + (parsed.success ? "" : JSON.stringify(parsed.error.issues))).toBe(true);
    }
  });

  test("a sliding door is a sliding leaf plus a fixed glazed leaf, and that combination is allowed", () => {
    const s = defaultSashesFor("scorrevole", 2100);
    expect(s.map((x) => x.type)).toEqual(["sliding", "fix"]);
    expect(s.every((x) => x.active)).toBe(true);
    expect(sashTypeAllowedWith(["fix"], "sliding").ok).toBe(true);
    expect(sashTypeAllowedWith(["classic"], "sliding").ok).toBe(false);
  });

  test("leaf class and handle range", () => {
    expect([leafClass(1), leafClass(2), leafClass(3), leafClass(6)]).toEqual([0, 1, 2, 2]);
    expect(handleRange(700)).toEqual({ min: 100, max: 500, step: 10 });
    expect(handleRange(1400)).toEqual({ min: 600, max: 1200, step: 10 });
  });
});

describe("pricing extensions", () => {
  const plain = calculatePrice(catalog, [item()]);

  test("an item without any new field prices exactly as before", () => {
    // 1.17 m2 * 20000 = 23400 ; profile 4.4 m * 1000 = 4400 ; tiltturn 5000
    expect(plain.priceCents).toBe(23400 + 4400 + 5000);
  });

  test("telaio multiplier scales material AND profile cost", () => {
    const r = calculatePrice(catalog, [item({ frameType: "reno65" })]);
    expect(r.priceCents).toBe(Math.round(23400 * 1.12) + Math.round(4400 * 1.12) + 5000);
  });

  test("finish and glazing multipliers scale the material cost", () => {
    const wood = calculatePrice(catalog, [item({ color: "wood" })]);
    expect(wood.priceCents).toBe(Math.round(23400 * 1.3) + 4400 + 5000);
    const triple = calculatePrice(catalog, [item({ glazing: "triple" })]);
    expect(triple.priceCents).toBe(Math.round(23400 * 1.24) + 4400 + 5000);
  });

  test("profile series multiplier still applies", () => {
    const r = calculatePrice(catalog, [item({ profileSystem: "schuco" })]);
    expect(r.priceCents).toBe(Math.round(23400 * 1.55) + 4400 + 5000);
  });

  test("RC2 hardware is per active operable leaf; a tilt leaf is priced from its own row", () => {
    const two = item({
      sashes: [
        { type: "tilt", direction: "left", active: true, hardware: "rc2", hardwareColor: "silver" },
        { type: "fix", direction: "left", active: true, hardware: "rc2", hardwareColor: "silver" },
      ],
    });
    expect(calculatePrice(catalog, [two]).priceCents).toBe(23400 + 4400 + 2000 + 5500);
  });

  test("accessories: flat / per m2 / per ml, disabled rows ignored, own size wins", () => {
    const base = item({ width: 1000, height: 1000 });
    expect(accessoriesCents(catalog, { ...base, accessories: { zanz: "flat" } }, 1, 1)).toBe(4000);
    expect(accessoriesCents(catalog, { ...base, accessories: { cass: "m2" } }, 1, 1)).toBe(10000);
    expect(accessoriesCents(catalog, { ...base, accessories: { cass: "m2", width: 2000, height: 500 } }, 1, 1)).toBe(10000);
    expect(accessoriesCents(catalog, { ...base, accessories: { avv: "ml" } }, 1, 1)).toBe(8000);
    expect(accessoriesCents(catalog, { ...base, accessories: { pers: "off", zanz: "none" } }, 1, 1)).toBe(0);
  });

  test("optional per-category base price is added on top", () => {
    const a = calculatePrice(catalog, [item({ category: "porta" })]);
    expect(a.priceCents).toBe(plain.priceCents + 30000);
    expect(calculatePrice(catalog, [item({ category: "finestra1" })]).priceCents).toBe(plain.priceCents);
  });
});

describe("thermal model", () => {
  test("Uw = (Uf*Af + Ug*Ag + Psi*Lg)/A for a 900x1300 single leaf", () => {
    const t = computeItemThermal(catalog, item());
    expect(t.uf).toBeCloseTo(1.3, 6);
    expect(t.ug).toBeCloseTo(1.0, 6);
    expect(t.uw).toBeCloseTo(1.232, 3);
  });

  test("triple glazing and a better profile lower Uw; more leaves add glazing perimeter", () => {
    const base = computeItemThermal(catalog, item()).uw;
    expect(computeItemThermal(catalog, item({ glazing: "triple" })).uw).toBeLessThan(base);
    expect(computeItemThermal(catalog, item({ profileSystem: "schuco" })).uw).toBeLessThan(base);
    const two = item({
      width: 1200,
      sashes: [
        { type: "classic", direction: "left", active: true, hardware: "standard", hardwareColor: "silver" },
        { type: "tiltturn", direction: "right", active: true, hardware: "standard", hardwareColor: "silver" },
      ],
    });
    const one = { ...two, sashes: [two.sashes[0]] };
    expect(computeItemThermal(catalog, two).glazingPerimeterM).toBeGreaterThan(computeItemThermal(catalog, one).glazingPerimeterM);
  });

  test("the general Uw is weighted by area, not a plain mean", () => {
    const small = item({ width: 600, height: 600 });
    const big = item({ width: 2000, height: 1600, glazing: "triple" });
    const mean = (computeItemThermal(catalog, small).uw + computeItemThermal(catalog, big).uw) / 2;
    const weighted = computeOverallUw(catalog, [small, big]);
    expect(weighted).not.toBeCloseTo(mean, 3);
    expect(weighted).toBeLessThan(mean);
  });

  test("unresolvable pieces give zeros instead of NaN", () => {
    expect(computeItemThermal(catalog, item({ material: "nope" })).uw).toBe(0);
  });
});

describe("installation", () => {
  test("labour follows the real number of leaves, times quantity; disposal and scaffold per piece", () => {
    const one = item({ frameType: "dritto" });
    const three = item({
      frameType: "reno40",
      quantity: 2,
      sashes: [1, 2, 3].map(() => ({ type: "classic" as const, direction: "left" as const, active: true, hardware: "standard", hardwareColor: "silver" })),
    });
    const r = computeInstallation(catalog, [one, three]);
    expect(r.perItem[0].labourCents).toBe(16500);
    expect(r.perItem[1].labourCents).toBe(23000 * 2);
    expect(r.disposalCents).toBe(3500 * 3);
    expect(r.scaffoldCents).toBe(5500 * 3);
    expect(r.labourCents).toBe(16500 + 46000);
  });

  test("no telaio -> nothing computed (manual price applies)", () => {
    expect(computeInstallation(catalog, [item()]).labourCents).toBe(0);
  });
});

describe("seed catalogue", () => {
  test("accessories cover the four categories and start at 0 EUR", () => {
    expect(new Set(DEFAULT_ACCESSORIES.map((a) => a.category))).toEqual(new Set(["zanz", "cass", "avv", "pers"]));
    expect(DEFAULT_ACCESSORIES.every((a) => a.priceCents === 0)).toBe(true);
    expect(DEFAULT_FRAME_TYPES.map((f) => f.multiplier)).toEqual([1, 1.08, 1.12]);
  });
});
