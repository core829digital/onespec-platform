import { describe, expect, test } from "vitest";
import { resolveEffectiveConfig, PLATFORM_DEFAULTS } from "../../convex/lib/configResolution";
import { entitlementsFor } from "../../convex/lib/entitlements";

const baseCfg = {
  defaultLocale: "it",
  defaultTheme: "auto" as const,
  currency: "EUR",
  vatRatePercent: 22,
  priceRoundingStep: 1,
  showPricesToEndUser: true,
};

describe("resolveEffectiveConfig", () => {
  test("untouched configurator values report the platform layer", () => {
    const r = resolveEffectiveConfig({
      entitlements: entitlementsFor("starter"),
      configurator: baseCfg,
      branding: null,
    });
    expect(r.vatRatePercent).toEqual({ value: 22, source: "platform" });
    expect(r.locale.source).toBe("platform");
    expect(r.whiteLabel).toEqual({ value: false, source: "platform" });
  });

  test("a changed configurator value reports the configurator layer", () => {
    const r = resolveEffectiveConfig({
      entitlements: entitlementsFor("starter"),
      configurator: { ...baseCfg, vatRatePercent: 10, defaultTheme: "dark" },
      branding: null,
    });
    expect(r.vatRatePercent).toEqual({ value: 10, source: "configurator" });
    expect(r.theme).toEqual({ value: "dark", source: "configurator" });
  });

  test("white-label comes from the plan on Business, from the widget when branding forces it", () => {
    const plan = resolveEffectiveConfig({
      entitlements: entitlementsFor("business"),
      configurator: baseCfg,
      branding: { whiteLabel: false },
    });
    expect(plan.whiteLabel).toEqual({ value: true, source: "plan" });

    const widget = resolveEffectiveConfig({
      entitlements: entitlementsFor("starter"),
      configurator: baseCfg,
      branding: { whiteLabel: true },
    });
    expect(widget.whiteLabel).toEqual({ value: true, source: "widget" });
  });

  test("plan-scoped quotas flow through the plan layer", () => {
    const r = resolveEffectiveConfig({
      entitlements: entitlementsFor("business"),
      configurator: baseCfg,
      branding: null,
    });
    expect(r.maxQuotesPerMonth).toEqual({ value: 300, source: "plan" });
    expect(r.analytics).toEqual({ value: "advanced", source: "plan" });
  });

  test("PLATFORM_DEFAULTS stays the documented product baseline", () => {
    expect(PLATFORM_DEFAULTS.vatRatePercent).toBe(22);
    expect(PLATFORM_DEFAULTS.currency).toBe("EUR");
  });
});
