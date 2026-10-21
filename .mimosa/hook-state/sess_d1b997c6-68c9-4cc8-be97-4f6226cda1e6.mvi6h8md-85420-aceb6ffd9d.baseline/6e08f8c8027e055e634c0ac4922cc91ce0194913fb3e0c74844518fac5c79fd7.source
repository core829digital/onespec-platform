import { describe, expect, it } from "vitest";
import { brandChoices, catalogOptions, catalogPricing, glazingChoices, reconcileState, type WidgetCatalog } from "@/components/widget/widget-catalog";
import { calculatePrice, type CatalogPayload } from "@/shared/pricing";
import { calculate, defaultConfig } from "@/components/widget/widget-pricing";
import { getDict } from "@/components/widget/widget-i18n";
import { glazingPackageRows } from "@/shared/glazing-packages";
import { STANDARD_PROFILES, resolveStandardPrice, standardProfileLabels } from "@/shared/standard-pricing";

const dict = getDict("it");

// A published catalogue of today: the 12 standard profiles, tiers 5 and 7 only.
const cat: WidgetCatalog = {
  configurator: { pricingMode: "standard", marginPercent: 0 },
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 0, enabled: true }],
  qualityTiers: [
    { materialKey: "pvc", key: "chamber5", labels: { it: "5 camere" }, multiplier: 1, sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "chamber7", labels: { it: "7 camere" }, multiplier: 1.15, sortOrder: 1, enabled: true },
  ],
  profileSystems: STANDARD_PROFILES.map((sp, i) => ({
    materialKey: "pvc", key: sp.key, labels: standardProfileLabels(sp), multiplier: 1, standardKey: sp.key, sortOrder: i, enabled: true, multiplierOnly: undefined,
    standard: resolveStandardPrice(sp, "centro"),
  })) as unknown as WidgetCatalog["profileSystems"],
  glazing: glazingPackageRows().map((r, i) => ({ key: r.key, labels: r.labels, priceCents: 0, sortOrder: i, enabled: true })),
  finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    ...["fix", "tiltturn", "classic", "tilt"].map((key) => ({ kind: "sashType", key, labels: { it: key }, priceCents: 0, sortOrder: 0, enabled: true })),
    ...["maco", "standard"].map((key) => ({ kind: "hardware", key, labels: { it: key }, priceCents: 0, sortOrder: 0, enabled: true })),
    ...["white", "silver"].map((key) => ({ kind: "hardwareColor", key, labels: { it: key }, priceCents: 0, sortOrder: 0, enabled: true })),
    { kind: "installation", key: "classico", labels: { it: "c" }, priceCents: 0, sortOrder: 0, enabled: true },
  ] as unknown as WidgetCatalog["hardware"],
};

const options = catalogOptions(cat, dict, "it");
const chambers = (key: string) => STANDARD_PROFILES.find((p) => p.key === key)!.chambers;

describe("widget: quality -> profile -> glazing", () => {
  it("lists 5, 6 and 7 chambers (6 added to an old snapshot)", () => {
    expect(options.quality.pvc.map(([k]) => k)).toEqual(["chamber5", "chamber6", "chamber7"]);
  });

  it.each([5, 6, 7])("with %i chambers only profiles with %i chambers are offered", (n) => {
    const list = brandChoices(options, "pvc", `chamber${n}`);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(([k]) => chambers(k) === n)).toBe(true);
  });

  it("a 70 mm profile is offered no 52 mm triple unit; an 82 mm profile is", () => {
    expect(glazingChoices(options, "pvc", "std_aluplast_ideal_4000").some(([k]) => k.startsWith("t52_"))).toBe(false);
    expect(glazingChoices(options, "pvc", "std_veka_softline_82").some(([k]) => k.startsWith("t52_"))).toBe(true);
  });

  it("the initial state is coherent: the default brand is a standard profile of the first quality", () => {
    const s = reconcileState(options, { ...defaultConfig(), glazing: "d24_floatBeArgon" });
    expect(s.quality.pvc).toBe("chamber5");
    expect(chambers(s.brand.pvc)).toBe(5);
    expect(s.glazing).toBe("d24_floatBeArgon");
  });

  it("changing quality swaps the brand; changing brand adapts the glazing; coherent state is untouched (same object)", () => {
    const s0 = reconcileState(options, { ...defaultConfig(), glazing: "t52_floatFloat331Be", quality: { pvc: "chamber6", wood: "pine", aluminum: "standard" } });
    expect(chambers(s0.brand.pvc)).toBe(6);
    expect(s0.glazing).toBe("t52_floatFloat331Be");
    const s1 = reconcileState(options, { ...s0, quality: { ...s0.quality, pvc: "chamber5" } });
    expect(chambers(s1.brand.pvc)).toBe(5);
    expect(s1.glazing).toBe("t40_floatFloat331Be");
    expect(reconcileState(options, s1)).toBe(s1);
  });

  it("an unknown quality falls back to the first one", () => {
    const s = reconcileState(options, { ...defaultConfig(), quality: { pvc: "ghost", wood: "pine", aluminum: "standard" } });
    expect(s.quality.pvc).toBe("chamber5");
  });

  it("price parity with the server for a 6-chamber piece in a snapshot without the 6-chamber tier", () => {
    const s = reconcileState(options, { ...defaultConfig(), quality: { pvc: "chamber6", wood: "pine", aluminum: "standard" }, glazing: "d24_floatBeArgon" });
    const client = calculate(s, catalogPricing(cat));
    const server = calculatePrice(cat as unknown as CatalogPayload, [{
      productType: "window", material: "pvc", quality: { pvc: "chamber6" }, profileSystem: s.brand.pvc, width: s.width, height: s.height, quantity: 1,
      sashes: s.sashes.map((x) => ({ ...x })), glazing: s.glazing, color: s.color, insectScreen: false,
    }] as never);
    expect(server.items[0].materialCost).toBeGreaterThan(0);
    // Client works in euros and rounds differently, so compare to the cent within rounding.
    expect(Math.abs(client.unitPrice * 100 - server.items[0].unitPrice)).toBeLessThanOrEqual(100);
  });
});
