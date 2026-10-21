import { describe, expect, it } from "vitest";
import {
  STANDARD_PROFILES,
  PRICE_ZONES,
  applyMarginCents,
  averageComplete,
  marginBasisPoints,
  marginOnPricePercent,
  midCents,
  parseMarginInput,
  resolveStandardPrice,
  toSupplyCents,
  standardProfileByKey,
  MAX_MARGIN_PERCENT,
} from "@/shared/standard-pricing";

describe("standard price list", () => {
  it("has the 12 profiles of the source table, unique keys, in the four quality classes", () => {
    expect(STANDARD_PROFILES).toHaveLength(12);
    expect(new Set(STANDARD_PROFILES.map((x) => x.key)).size).toBe(12);
    expect(new Set(STANDARD_PROFILES.map((x) => x.klass))).toEqual(new Set(["economica", "media", "mediaSuperiore", "premium"]));
    for (const x of STANDARD_PROFILES) expect(x.key).toMatch(/^std_[a-z0-9_]{3,40}$/);
  });

  it("the averages of the complete price match the ones printed in the source table (365 / 345 / 325 EUR per m²)", () => {
    expect(averageComplete("nord")).toBe(365);
    expect(averageComplete("centro")).toBe(345);
    expect(averageComplete("sud")).toBe(325);
  });

  it("every range is ordered, frame-only is below complete, and prices fall from Nord to Centro to Sud", () => {
    for (const x of STANDARD_PROFILES) {
      for (const z of PRICE_ZONES) {
        const { complete, frame } = x.prices[z];
        expect(complete[0]).toBeLessThan(complete[1]);
        expect(frame[0]).toBeLessThan(frame[1]);
        expect(frame[1]).toBeLessThan(complete[1]);
        expect(frame[0]).toBeLessThan(complete[0]);
      }
      expect(x.prices.nord.complete[0]).toBeGreaterThan(x.prices.centro.complete[0]);
      expect(x.prices.centro.complete[0]).toBeGreaterThan(x.prices.sud.complete[0]);
      expect(x.prices.nord.complete[1]).toBeGreaterThan(x.prices.centro.complete[1]);
      expect(x.prices.centro.complete[1]).toBeGreaterThan(x.prices.sud.complete[1]);
      expect(x.bar[0]).toBeLessThan(x.bar[1]);
      expect(x.glass[0]).toBeLessThan(x.glass[1]);
    }
  });

  it("Nord vs Sud differs by 10-15% on the complete price, as the source states (average, 40 EUR per m² on most rows)", () => {
    const delta = (averageComplete("nord") - averageComplete("sud")) / averageComplete("nord");
    expect(delta).toBeGreaterThan(0.1);
    expect(delta).toBeLessThan(0.15);
  });

  it("spot checks against rows of the source table", () => {
    const row = (k: string) => standardProfileByKey(k)!;
    expect(row("std_aluplast_ideal_4000").prices.nord).toEqual({ complete: [260, 310], frame: [145, 185] });
    expect(row("std_aluplast_ideal_4000").prices.sud).toEqual({ complete: [220, 270], frame: [125, 165] });
    expect(row("std_rehau_geneo_86").prices.centro).toEqual({ complete: [430, 630], frame: [240, 380] });
    expect(row("std_schuco_corona_ct70").bar).toEqual([18, 30]);
    expect(row("std_gealan_s9000_plus_83").chambers).toBe(7);
    expect(row("std_gealan_s9000_plus_83").glass).toEqual([110, 145]);
    expect(row("std_salamander_bluevolution_82").prices.nord.complete).toEqual([355, 435]);
    expect(row("std_veka_softline_82").prices.nord).toEqual(row("std_salamander_bluevolution_82").prices.nord);
  });

  it("resolves to whole cents at the middle of the ranges", () => {
    expect(midCents([260, 310])).toBe(28500);
    const r = resolveStandardPrice(standardProfileByKey("std_aluplast_ideal_4000")!, "nord");
    // Market mid prices (285 / 165 EUR/m2, glass 95, bar 10.50) scaled to supply prices.
    expect(r).toEqual({ completePerM2Cents: toSupplyCents(28500), framePerM2Cents: toSupplyCents(16500), glassPerM2Cents: toSupplyCents(9500), barPerMlCents: toSupplyCents(1050) });
    for (const x of STANDARD_PROFILES) for (const z of PRICE_ZONES) for (const v of Object.values(resolveStandardPrice(x, z))) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("margin arithmetic", () => {
  it("works in basis points: decimals are exact", () => {
    expect(marginBasisPoints(25)).toBe(2500);
    expect(marginBasisPoints(12.5)).toBe(1250);
    expect(marginBasisPoints(0.07)).toBe(7);
    expect(marginBasisPoints(0)).toBe(0);
    expect(marginBasisPoints(-5)).toBe(0);
    expect(marginBasisPoints(Number.NaN)).toBe(0);
    expect(marginBasisPoints(undefined)).toBe(0);
    expect(marginBasisPoints(10_000)).toBe(MAX_MARGIN_PERCENT * 100);
  });

  it("applies the margin to cents with half-up rounding and no floating drift", () => {
    expect(applyMarginCents(10000, 25)).toBe(12500);
    expect(applyMarginCents(10000, 12.5)).toBe(11250);
    expect(applyMarginCents(33333, 7.5)).toBe(35833); // 33333 * 1.075 = 35832.975
    expect(applyMarginCents(1, 50)).toBe(2); // 1.5 rounds half up
    expect(applyMarginCents(19999, 0.01)).toBe(20001); // 19999 * 1.0001 = 20000.9999
    expect(applyMarginCents(28500, 0)).toBe(28500);
    expect(applyMarginCents(0, 40)).toBe(0);
    // Never lower than the list price and monotonic in the margin.
    let last = 0;
    for (let m = 0; m <= 100; m += 0.25) {
      const v = applyMarginCents(123457, m);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("shows the same margin as profit on the selling price", () => {
    expect(marginOnPricePercent(25)).toBe(20);
    expect(marginOnPricePercent(100)).toBe(50);
    expect(marginOnPricePercent(0)).toBe(0);
    expect(marginOnPricePercent(12.5)).toBe(11.11);
  });

  it("reads what the installer types, with comma or dot, clamped and at two decimals", () => {
    expect(parseMarginInput("12,5")).toBe(12.5);
    expect(parseMarginInput("12.345")).toBe(12.35);
    expect(parseMarginInput(" 7 ")).toBe(7);
    expect(parseMarginInput("-3")).toBe(0);
    expect(parseMarginInput("999")).toBe(MAX_MARGIN_PERCENT);
    expect(parseMarginInput("abc")).toBeNull();
    expect(parseMarginInput("")).toBe(0);
    expect(parseMarginInput(18.5)).toBe(18.5);
  });
});
