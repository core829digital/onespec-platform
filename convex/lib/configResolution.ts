/**
 * Effective-configuration resolver.
 *
 * A configurator's runtime settings are layered. Lowest priority first:
 *
 *   platform  → hard-coded product defaults (this file)
 *   plan      → entitlements derived from the tenant's plan (lib/entitlements)
 *   region    → per-region policy (reserved; contributes nothing yet)
 *   tenant    → tenant-wide overrides (reserved; contributes nothing yet)
 *   configurator → the configurator document (VAT, rounding, theme, locale, …)
 *   widget    → branding / per-embed overrides (colours, font, white-label)
 *
 * Every resolved value carries the layer that produced it, so the dashboard can
 * show operators exactly why a setting has the value it does.
 */

import type { Entitlements } from "./entitlements";
import { regionForCountry, type RegionPolicy, type WidgetMode } from "./regions";

export type ConfigLayer =
  | "platform"
  | "plan"
  | "region"
  | "tenant"
  | "configurator"
  | "widget";

export const CONFIG_LAYERS: ConfigLayer[] = [
  "platform",
  "plan",
  "region",
  "tenant",
  "configurator",
  "widget",
];

export interface Resolved<T> {
  value: T;
  source: ConfigLayer;
}

export const PLATFORM_DEFAULTS = {
  locale: "it",
  theme: "auto" as "light" | "dark" | "auto",
  currency: "EUR",
  vatRatePercent: 22,
  priceRoundingStep: 1,
  showPricesToEndUser: true,
  whiteLabel: false,
  fontFamily: "geist",
  colorAccent: "#16d19d",
};

export interface ResolverInput {
  entitlements: Entitlements;
  /** ISO-2 country of the tenant; resolves the region policy. */
  country?: string | null;
  configurator: {
    defaultLocale: string;
    defaultTheme: "light" | "dark" | "auto";
    currency: string;
    vatRatePercent: number;
    priceRoundingStep: number;
    showPricesToEndUser: boolean;
  };
  branding: {
    whiteLabel?: boolean;
    fontFamily?: string;
    colorAccent?: string;
  } | null;
}

export interface EffectiveConfig {
  locale: Resolved<string>;
  theme: Resolved<"light" | "dark" | "auto">;
  currency: Resolved<string>;
  vatRatePercent: Resolved<number>;
  priceRoundingStep: Resolved<number>;
  showPricesToEndUser: Resolved<boolean>;
  whiteLabel: Resolved<boolean>;
  advancedPricingRules: Resolved<boolean>;
  multiCatalog: Resolved<boolean>;
  analytics: Resolved<"basic" | "advanced">;
  maxConfigurators: Resolved<number>;
  maxQuotesPerMonth: Resolved<number>;
  fontFamily: Resolved<string>;
  colorAccent: Resolved<string>;
  region: Resolved<string>;
  widgetMode: Resolved<WidgetMode>;
}

/** Configurator value wins unless it equals the platform default. */
function fromConfigurator<T>(value: T, platformDefault: T): Resolved<T> {
  return value === platformDefault
    ? { value, source: "platform" }
    : { value, source: "configurator" };
}

export function resolveEffectiveConfig(input: ResolverInput): EffectiveConfig {
  const { entitlements: ent, configurator: cfg, branding } = input;
  const d = PLATFORM_DEFAULTS;
  const region: RegionPolicy = regionForCountry(input.country);

  const whiteLabel: Resolved<boolean> = branding?.whiteLabel
    ? { value: true, source: "widget" }
    : ent.whiteLabel
      ? { value: true, source: "plan" }
      : { value: false, source: "platform" };

  return {
    region: { value: region.code, source: "region" },
    widgetMode: { value: region.widgetMode, source: "region" },
    locale: fromConfigurator(cfg.defaultLocale, d.locale),
    theme: fromConfigurator(cfg.defaultTheme, d.theme),
    currency: fromConfigurator(cfg.currency, d.currency),
    vatRatePercent: fromConfigurator(cfg.vatRatePercent, d.vatRatePercent),
    priceRoundingStep: fromConfigurator(cfg.priceRoundingStep, d.priceRoundingStep),
    showPricesToEndUser: fromConfigurator(cfg.showPricesToEndUser, d.showPricesToEndUser),
    whiteLabel,
    advancedPricingRules: { value: ent.advancedPricingRules, source: "plan" },
    multiCatalog: { value: ent.multiCatalog, source: "plan" },
    analytics: { value: ent.analytics, source: "plan" },
    maxConfigurators: { value: ent.maxConfigurators, source: "plan" },
    maxQuotesPerMonth: { value: ent.maxQuotesPerMonth, source: "plan" },
    fontFamily:
      branding?.fontFamily && branding.fontFamily !== d.fontFamily
        ? { value: branding.fontFamily, source: "widget" }
        : { value: branding?.fontFamily ?? d.fontFamily, source: "platform" },
    colorAccent:
      branding?.colorAccent && branding.colorAccent.toLowerCase() !== d.colorAccent
        ? { value: branding.colorAccent, source: "widget" }
        : { value: branding?.colorAccent ?? d.colorAccent, source: "platform" },
  };
}
