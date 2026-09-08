/**
 * Region registry — the single source of truth for per-market policy.
 *
 * A "region" is the commercial market a tenant operates in. It is resolved from
 * the tenant's stored `country` (ISO-3166-1 alpha-2), never from a request
 * parameter, and it drives: the allowed VAT rates + how one is chosen, the
 * widget price-disclosure mode, the currency, the default technical catalogue
 * profile, and which compliance flags are offered.
 *
 * Country phases (21–26) fill in the technical-catalogue and pricing detail;
 * this file is the mechanism they all plug into.
 */

export type RegionCode = "IT" | "FR" | "BE" | "NL" | "DE" | "LU";

/** How the widget presents the price to the end visitor. */
export type WidgetMode = "lead_gen" | "transparent";

export interface VatRate {
  key: string;
  /** Percentage, e.g. 22 for 22%. */
  percent: number;
  /** Short label shown in the widget / editor, in the region's primary language. */
  label: string;
}

export interface RegionPolicy {
  code: RegionCode;
  /** ISO-2 country codes this region covers. */
  countries: string[];
  currency: "EUR";
  primaryLocale: string;
  widgetMode: WidgetMode;
  vatRates: VatRate[];
  defaultVatKey: string;
  /** Compliance toggles the editor may surface for this market (informational). */
  complianceFlags: string[];
}

const IT: RegionPolicy = {
  code: "IT",
  countries: ["IT", "SM", "VA"],
  currency: "EUR",
  primaryLocale: "it",
  widgetMode: "lead_gen",
  vatRates: [
    { key: "ordinaria", percent: 22, label: "IVA ordinaria 22%" },
    { key: "ristrutturazione", percent: 10, label: "Ristrutturazione 10%" },
  ],
  defaultVatKey: "ordinaria",
  complianceFlags: ["posa_uni_11673"],
};

const FR: RegionPolicy = {
  code: "FR",
  countries: ["FR", "MC"],
  currency: "EUR",
  primaryLocale: "fr",
  widgetMode: "lead_gen",
  vatRates: [
    { key: "neuf", percent: 20, label: "TVA 20% (neuf)" },
    { key: "renovation", percent: 10, label: "TVA 10% (rénovation)" },
    { key: "renovation_energetique", percent: 5.5, label: "TVA 5,5% (rénovation énergétique)" },
  ],
  defaultVatKey: "renovation",
  complianceFlags: ["rge", "dtu_36_5"],
};

const BE: RegionPolicy = {
  code: "BE",
  countries: ["BE"],
  currency: "EUR",
  primaryLocale: "fr",
  widgetMode: "lead_gen",
  vatRates: [
    { key: "standard", percent: 21, label: "TVA 21%" },
    { key: "renovation", percent: 6, label: "TVA 6% (logement > 10 ans)" },
  ],
  defaultVatKey: "renovation",
  complianceFlags: ["ventilation_grille", "warm_edge"],
};

const NL: RegionPolicy = {
  code: "NL",
  countries: ["NL"],
  currency: "EUR",
  primaryLocale: "nl",
  widgetMode: "transparent",
  vatRates: [{ key: "standaard", percent: 21, label: "21% btw" }],
  defaultVatKey: "standaard",
  complianceFlags: ["hvl_verbinding", "hr_plus_plus"],
};

const DE: RegionPolicy = {
  code: "DE",
  countries: ["DE", "AT"],
  currency: "EUR",
  primaryLocale: "de",
  widgetMode: "lead_gen",
  vatRates: [{ key: "regel", percent: 19, label: "19% MwSt." }],
  defaultVatKey: "regel",
  complianceFlags: ["ral_montage", "rc2_rc3", "warme_kante"],
};

const LU: RegionPolicy = {
  code: "LU",
  countries: ["LU"],
  currency: "EUR",
  primaryLocale: "fr",
  widgetMode: "lead_gen",
  vatRates: [
    { key: "super_reduit", percent: 3, label: "TVA 3% (super-réduit, sur accord)" },
    { key: "standard", percent: 17, label: "TVA 17%" },
  ],
  defaultVatKey: "standard",
  complianceFlags: ["ral_montage", "rc2_rc3", "bilingual_quote"],
};

export const REGIONS: Record<RegionCode, RegionPolicy> = { IT, FR, BE, NL, DE, LU };

export const DEFAULT_REGION: RegionCode = "IT";

/** Map an ISO-2 country to its region, or the default. */
export function regionForCountry(country: string | null | undefined): RegionPolicy {
  if (country) {
    const up = country.toUpperCase();
    for (const r of Object.values(REGIONS)) {
      if (r.countries.includes(up)) return r;
    }
  }
  return REGIONS[DEFAULT_REGION];
}

export interface VatBreakdownItem {
  rate: number;
  label: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
}

export interface VatCalculationInput {
  regionCode: RegionCode;
  /** Subtotal excluding VAT, in eurocents. */
  subtotalExVatCents: number;
  /** Whether the renovation qualifies for energy-efficiency reduced rate. */
  isEnergyRenovation?: boolean;
  /** Building age in years (for BE/LU reduced rates). */
  buildingAge?: number;
  /** For IT: split between manopera (10%), beni (10% up to manopera value, 22% above), altri (10%). */
  itSplit?: { manoperaCents: number; beniCents: number; altriCents: number };
}

/**
 * Calculate VAT breakdown for a region according to local rules.
 * Returns array of VatBreakdownItem with rate, label, base, VAT, and total.
 */
export function calculateVAT(input: VatCalculationInput): VatBreakdownItem[] {
  const region = REGIONS[input.regionCode];
  const breakdown: VatBreakdownItem[] = [];

  if (input.regionCode === "IT") {
    const split = input.itSplit ?? { manoperaCents: 0, beniCents: input.subtotalExVatCents, altriCents: 0 };
    const limitaBeniLa10 = split.manoperaCents + split.altriCents;
    const beni10 = Math.min(split.beniCents, limitaBeniLa10);
    const beni22 = Math.max(0, split.beniCents - limitaBeniLa10);

    const imponibile10 = split.manoperaCents + split.altriCents + beni10;
    const iva10 = Math.round(imponibile10 * 0.1);
    const imponibile22 = beni22;
    const iva22 = Math.round(imponibile22 * 0.22);

    breakdown.push({
      rate: 0.1,
      label: "IVA 10% (manopera + beni fino a concorrenza manopera)",
      baseCents: imponibile10,
      vatCents: iva10,
      totalCents: imponibile10 + iva10,
    });
    breakdown.push({
      rate: 0.22,
      label: "IVA 22% (beni eccedenti)",
      baseCents: imponibile22,
      vatCents: iva22,
      totalCents: imponibile22 + iva22,
    });
    return breakdown;
  }

  if (input.regionCode === "FR") {
    let vatKey = "renovation";
    if (input.isEnergyRenovation) vatKey = "renovation_energetique";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: input.subtotalExVatCents,
      vatCents: Math.round(input.subtotalExVatCents * vatRate.percent / 100),
      totalCents: input.subtotalExVatCents + Math.round(input.subtotalExVatCents * vatRate.percent / 100),
    });
    return breakdown;
  }

  if (input.regionCode === "BE") {
    const vatKey = (input.buildingAge ?? 0) > 10 ? "renovation" : "standard";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[0];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: input.subtotalExVatCents,
      vatCents: Math.round(input.subtotalExVatCents * vatRate.percent / 100),
      totalCents: input.subtotalExVatCents + Math.round(input.subtotalExVatCents * vatRate.percent / 100),
    });
    return breakdown;
  }

  if (input.regionCode === "LU") {
    const vatKey = input.isEnergyRenovation && (input.buildingAge ?? 0) > 10 ? "super_reduit" : "standard";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: input.subtotalExVatCents,
      vatCents: Math.round(input.subtotalExVatCents * vatRate.percent / 100),
      totalCents: input.subtotalExVatCents + Math.round(input.subtotalExVatCents * vatRate.percent / 100),
    });
    return breakdown;
  }

  // NL, DE - single rate
  const vatRate = region.vatRates.find((v) => v.key === region.defaultVatKey) || region.vatRates[0];
  breakdown.push({
    rate: vatRate.percent / 100,
    label: vatRate.label,
    baseCents: input.subtotalExVatCents,
    vatCents: Math.round(input.subtotalExVatCents * vatRate.percent / 100),
    totalCents: input.subtotalExVatCents + Math.round(input.subtotalExVatCents * vatRate.percent / 100),
  });
  return breakdown;
}

/** Best-effort ISO-2 from an `Accept-Language` header. */
export function countryFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/[a-z]{2}-([A-Z]{2})/);
  if (m) return m[1];
  const lang = header.slice(0, 2).toLowerCase();
  const byLang: Record<string, string> = { it: "IT", fr: "FR", nl: "NL", de: "DE" };
  return byLang[lang] ?? null;
}
