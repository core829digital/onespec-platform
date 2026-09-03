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

/** Best-effort ISO-2 from an `Accept-Language` header. */
export function countryFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/[a-z]{2}-([A-Z]{2})/);
  if (m) return m[1];
  const lang = header.slice(0, 2).toLowerCase();
  const byLang: Record<string, string> = { it: "IT", fr: "FR", nl: "NL", de: "DE" };
  return byLang[lang] ?? null;
}
