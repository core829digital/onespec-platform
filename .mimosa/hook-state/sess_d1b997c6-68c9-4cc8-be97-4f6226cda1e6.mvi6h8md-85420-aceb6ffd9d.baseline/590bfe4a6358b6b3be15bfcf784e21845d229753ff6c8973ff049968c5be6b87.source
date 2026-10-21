import { describe, expect, test } from "vitest";
import {
  regionForCountry,
  countryFromAcceptLanguage,
  REGIONS,
  DEFAULT_REGION,
} from "../../convex/lib/regions";
import { resolveEffectiveConfig } from "../../convex/lib/configResolution";
import { entitlementsFor } from "../../convex/lib/entitlements";

const baseCfg = {
  defaultLocale: "it",
  defaultTheme: "auto" as const,
  currency: "EUR",
  vatRatePercent: 22,
  priceRoundingStep: 1,
  showPricesToEndUser: true,
};

describe("region registry", () => {
  test("maps countries to regions, unknown → default", () => {
    expect(regionForCountry("IT").code).toBe("IT");
    expect(regionForCountry("fr").code).toBe("FR");
    expect(regionForCountry("BE").code).toBe("BE");
    expect(regionForCountry("NL").code).toBe("NL");
    expect(regionForCountry("DE").code).toBe("DE");
    expect(regionForCountry("AT").code).toBe("DE"); // Austria folded into DE region
    expect(regionForCountry("LU").code).toBe("LU");
    expect(regionForCountry("US").code).toBe(DEFAULT_REGION);
    expect(regionForCountry(null).code).toBe(DEFAULT_REGION);
  });

  test("NL is the only transparent-pricing market", () => {
    const transparent = Object.values(REGIONS).filter((r) => r.widgetMode === "transparent");
    expect(transparent.map((r) => r.code)).toEqual(["NL"]);
  });

  test("VAT rate sets match the known country rules", () => {
    expect(REGIONS.FR.vatRates.map((v) => v.percent).sort((a, b) => a - b)).toEqual([5.5, 10, 20]);
    expect(REGIONS.LU.vatRates.map((v) => v.percent).sort((a, b) => a - b)).toEqual([3, 17]);
    expect(REGIONS.DE.vatRates[0].percent).toBe(19);
  });

  test("countryFromAcceptLanguage extracts the region tag or a language guess", () => {
    expect(countryFromAcceptLanguage("fr-BE,fr;q=0.9")).toBe("BE");
    expect(countryFromAcceptLanguage("nl,en;q=0.5")).toBe("NL");
    expect(countryFromAcceptLanguage("en-US")).toBe("US");
    expect(countryFromAcceptLanguage(null)).toBeNull();
  });
});

describe("configResolution — region layer", () => {
  test("region + widgetMode resolve from the tenant country", () => {
    const nl = resolveEffectiveConfig({
      entitlements: entitlementsFor("business"),
      country: "NL",
      configurator: baseCfg,
      branding: null,
    });
    expect(nl.region).toEqual({ value: "NL", source: "region" });
    expect(nl.widgetMode).toEqual({ value: "transparent", source: "region" });

    const it = resolveEffectiveConfig({
      entitlements: entitlementsFor("starter"),
      configurator: baseCfg,
      branding: null,
    });
    expect(it.region.value).toBe("IT");
    expect(it.widgetMode.value).toBe("lead_gen");
  });
});
