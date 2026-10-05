// Standard price list for PVC windows in Italy, by zone (Nord / Centro / Sud). Public market prices 2024-2026,
// transcribed from the comparative table supplied by CORE829 (12 PVC profiles).
//
// "Complete" = frame + glass (4-16-4 low-e double) + standard hardware + basic installation, in EUR per m².
// "Frame only" = the bare window, about 60% of the complete price. The price list in the catalogue uses the MIDDLE of each
// range, so the installer only plays with the margin on top of it. Every price here is a whole euro; the engine works in cents.

export type PriceZone = "nord" | "centro" | "sud";
export const PRICE_ZONES: readonly PriceZone[] = ["nord", "centro", "sud"];

export type QualityClass = "economica" | "media" | "mediaSuperiore" | "premium";

type Range = readonly [min: number, max: number];

export interface ZonePrices {
  /** EUR per m², complete with glass, hardware and basic installation. */
  complete: Range;
  /** EUR per m², frame only (about 60% of complete). */
  frame: Range;
}

export interface StandardProfile {
  /** Catalogue key of the profile row (stable). */
  key: string;
  /** Brand / product names as the market knows them. */
  name: string;
  chambers: number;
  thicknessMm: string;
  /** Short technical note ("tripla guarnitura", "fibra carbon"...), if any; see FEATURE_LABEL for its translations. */
  feature?: string;
  /** Gasket system: "triple" when the profile is documented with a triple gasket, else the usual one. */
  gasket?: "standard" | "triple";
  klass: QualityClass;
  prices: Record<PriceZone, ZonePrices>;
  /** EUR per linear metre of a 6 m bar. */
  bar: Range;
  /** EUR per m² of glass alone. */
  glass: Range;
}

const p = (c: Range, f: Range): ZonePrices => ({ complete: c, frame: f });

export const STANDARD_PROFILES: readonly StandardProfile[] = [
  { key: "std_aluplast_ideal_4000", name: "Aluplast Ideal 4000", chambers: 5, thicknessMm: "70", klass: "economica",
    prices: { nord: p([260, 310], [145, 185]), centro: p([240, 290], [135, 175]), sud: p([220, 270], [125, 165]) }, bar: [9, 12], glass: [80, 110] },
  { key: "std_deceuninck_konig", name: "Deceuninck / König", chambers: 5, thicknessMm: "70", klass: "economica",
    prices: { nord: p([270, 320], [155, 195]), centro: p([250, 300], [145, 185]), sud: p([230, 280], [135, 175]) }, bar: [10, 13], glass: [80, 110] },
  { key: "std_aliplast", name: "Aliplast", chambers: 5, thicknessMm: "70", klass: "media",
    prices: { nord: p([280, 330], [165, 205]), centro: p([260, 310], [155, 195]), sud: p([240, 290], [145, 185]) }, bar: [11, 14], glass: [85, 115] },
  { key: "std_kommerling_76", name: "Kömmerling 76 / Veka Softline 76 / Salamander Streamline 76", chambers: 5, thicknessMm: "76", klass: "media",
    prices: { nord: p([295, 375], [165, 225]), centro: p([275, 355], [155, 215]), sud: p([255, 335], [145, 205]) }, bar: [12, 16], glass: [90, 120] },
  { key: "std_rehau_brillant_70", name: "Rehau Brillant Design 70 / Eurodesign 70", chambers: 5, thicknessMm: "70", klass: "media",
    prices: { nord: p([280, 320], [165, 195]), centro: p([260, 300], [155, 185]), sud: p([240, 280], [145, 175]) }, bar: [11, 15], glass: [85, 115] },
  { key: "std_veka_softline_82", name: "Veka Softline 82 / Aluplast Ideal 7000", chambers: 6, thicknessMm: "82-85", klass: "mediaSuperiore",
    prices: { nord: p([355, 435], [195, 260]), centro: p([335, 415], [185, 250]), sud: p([315, 395], [175, 240]) }, bar: [14, 19], glass: [110, 150] },
  { key: "std_salamander_bluevolution_82", name: "Salamander bluEvolution 82", chambers: 6, thicknessMm: "82", feature: "tripla guarnitura", gasket: "triple", klass: "mediaSuperiore",
    prices: { nord: p([355, 435], [195, 260]), centro: p([335, 415], [185, 250]), sud: p([315, 395], [175, 240]) }, bar: [14, 19], glass: [110, 150] },
  { key: "std_rehau_geneo_86", name: "Rehau Geneo 86 mm fibra carbon", chambers: 6, thicknessMm: "86", feature: "fibra carbon", klass: "premium",
    prices: { nord: p([450, 650], [250, 390]), centro: p([430, 630], [240, 380]), sud: p([410, 610], [230, 370]) }, bar: [18, 28], glass: [130, 180] },
  { key: "std_schuco_corona_ct70", name: "Schüco Corona CT70 / Living 82", chambers: 6, thicknessMm: "70-82", klass: "premium",
    prices: { nord: p([450, 650], [250, 390]), centro: p([430, 630], [240, 380]), sud: p([410, 610], [230, 370]) }, bar: [18, 30], glass: [130, 180] },
  { key: "std_gealan_s8000_74", name: "Gealan S8000 IQ 74 mm", chambers: 5, thicknessMm: "74", klass: "economica",
    prices: { nord: p([250, 300], [140, 175]), centro: p([230, 280], [130, 165]), sud: p([210, 260], [120, 155]) }, bar: [9, 12], glass: [80, 110] },
  { key: "std_gealan_s9000_83", name: "Gealan S9000 IQ 83 mm", chambers: 6, thicknessMm: "83", klass: "media",
    prices: { nord: p([295, 365], [165, 215]), centro: p([275, 345], [155, 205]), sud: p([255, 325], [145, 195]) }, bar: [12, 16], glass: [90, 120] },
  { key: "std_gealan_s9000_plus_83", name: "Gealan S9000 IQ Plus 83 mm", chambers: 7, thicknessMm: "83", feature: "IKD top", klass: "mediaSuperiore",
    prices: { nord: p([330, 410], [185, 245]), centro: p([310, 390], [175, 235]), sud: p([290, 370], [165, 225]) }, bar: [13, 18], glass: [110, 145] },
];

const BY_KEY = new Map(STANDARD_PROFILES.map((x) => [x.key, x]));
export const standardProfileByKey = (key: string | undefined): StandardProfile | undefined => (key ? BY_KEY.get(key) : undefined);

/** Middle of a range in whole cents (EUR range -> cents): (min + max) / 2 * 100. */
export const midCents = (r: Range): number => Math.round((r[0] + r[1]) * 50);

/** The numbers the engine prices a profile with in one zone, in cents (per m², per linear metre). */
export interface ResolvedStandardPrice {
  completePerM2Cents: number;
  framePerM2Cents: number;
  glassPerM2Cents: number;
  barPerMlCents: number;
}

/**
 * Calibration of the market table to what the installer really pays: SUPPLY of the windows with the factory transport to the
 * installer, VAT excluded (no installation). The table's "complete" prices include the basic installation, so they sit above a
 * supplier quote. The reference is a Winarhi quote: Aluplast Ideal 4000, Centro, 1432 x 1548 mm, double glazing 24 mm, supply +
 * transport, no VAT = 420.00 EUR. At that price the Centro mid (265 EUR/m2) becomes 189.47 EUR/m2: the same factor is applied to
 * every profile, zone, frame-only price, bar and glass, so the zones keep their real distance.
 */
export const SUPPLY_FACTOR = { numerator: 18947, denominator: 26500 } as const;
export const SUPPLY_REFERENCE = { profileKey: "std_aluplast_ideal_4000", zone: "centro", widthMm: 1432, heightMm: 1548, netCents: 42000 } as const;

/** A market price in cents -> the supply price in cents. */
export const toSupplyCents = (marketCents: number): number => Math.round((marketCents * SUPPLY_FACTOR.numerator) / SUPPLY_FACTOR.denominator);

export function resolveStandardPrice(profile: StandardProfile, zone: PriceZone): ResolvedStandardPrice {
  const z = profile.prices[zone];
  return {
    completePerM2Cents: toSupplyCents(midCents(z.complete)),
    framePerM2Cents: toSupplyCents(midCents(z.frame)),
    glassPerM2Cents: toSupplyCents(midCents(profile.glass)),
    barPerMlCents: toSupplyCents(midCents(profile.bar)),
  };
}

/** Average complete price over the 12 profiles in a zone, EUR per m² (rounded). */
export function averageComplete(zone: PriceZone): number {
  const sum = STANDARD_PROFILES.reduce((n, x) => n + (x.prices[zone].complete[0] + x.prices[zone].complete[1]) / 2, 0);
  return Math.round(sum / STANDARD_PROFILES.length);
}

/** Triple glazing costs 40-80 EUR/m² more than double (middle: 60). */
export const TRIPLE_GLAZING_SURCHARGE_PER_M2_CENTS = 6000;

/** A coloured or foil-wrapped frame costs 15-25% more than white (middle: 20%). */
export const COLOUR_SURCHARGE_MULTIPLIER = 1.2;

/** The frame-only price is about this share of the complete price. */
export const FRAME_ONLY_SHARE = 0.6;

/** Typical Italian regions of each zone (ISTAT macro-areas), shown as help when choosing a zone. */
export const ZONE_REGIONS: Record<PriceZone, readonly string[]> = {
  nord: ["Piemonte", "Valle d'Aosta", "Lombardia", "Liguria", "Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia", "Emilia-Romagna"],
  centro: ["Toscana", "Umbria", "Marche", "Lazio"],
  sud: ["Abruzzo", "Molise", "Campania", "Puglia", "Basilicata", "Calabria", "Sicilia", "Sardegna"],
};

export function isPriceZone(v: unknown): v is PriceZone {
  return v === "nord" || v === "centro" || v === "sud";
}

/** Largest margin the installer can apply (percent over the price list), shared by the engine, the server and the UI. */
export const MAX_MARGIN_PERCENT = 300;

/** Margin as whole basis points (1.25% -> 125): the engine multiplies integers only, so cents never drift. */
export function marginBasisPoints(percent: number | undefined | null): number {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(Math.min(MAX_MARGIN_PERCENT, percent) * 100);
}

/** Price with the margin applied, in cents, rounded half up: price * (10000 + bp) / 10000. */
export function applyMarginCents(cents: number, percent: number | undefined | null): number {
  const bp = marginBasisPoints(percent);
  return bp === 0 ? cents : Math.round((cents * (10000 + bp)) / 10000);
}

/** The same margin read as profit on the selling price: 25% over cost is 20% of the price. */
export function marginOnPricePercent(markupPercent: number): number {
  const bp = marginBasisPoints(markupPercent);
  return bp === 0 ? 0 : Math.round((bp / (10000 + bp)) * 10000) / 100;
}

/** Normalise what the installer typed: a finite number clamped to 0..MAX, two decimals; comma or dot accepted. */
export function parseMarginInput(raw: string | number): number | null {
  const n = typeof raw === "number" ? raw : Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(MAX_MARGIN_PERCENT, Math.max(0, n)) * 100) / 100;
}

type Six = Record<"it" | "en" | "fr" | "de" | "nl" | "ro", string>;
const six = (it: string, en: string, fr: string, de: string, nl: string, ro: string): Six => ({ it, en, fr, de, nl, ro });

export const QUALITY_CLASS_LABEL: Record<QualityClass, Six> = {
  economica: six("Economica", "Economy", "Économique", "Economy", "Economisch", "Economică"),
  media: six("Media", "Medium", "Moyenne", "Mittel", "Middenklasse", "Medie"),
  mediaSuperiore: six("Media-superiore", "Upper-medium", "Moyenne supérieure", "Gehobene Mittelklasse", "Hogere middenklasse", "Medie-superioară"),
  premium: six("Premium", "Premium", "Premium", "Premium", "Premium", "Premium"),
};

/** Translations of the short technical notes of the profiles. */
export const FEATURE_LABEL: Record<string, Six> = {
  "tripla guarnitura": six("tripla guarnizione", "triple gasket", "triple joint", "dreifache Dichtung", "drievoudige afdichting", "garnitură triplă"),
  "fibra carbon": six("fibra di carbonio", "carbon fibre", "fibre de carbone", "Carbonfaser", "koolstofvezel", "fibră de carbon"),
  "IKD top": six("IKD top", "IKD top", "IKD top", "IKD top", "IKD top", "IKD top"),
};

/** The note of a profile in one language ("" when it has none). */
export const featureText = (profile: Pick<StandardProfile, "feature">, lang: keyof Six): string =>
  profile.feature ? (FEATURE_LABEL[profile.feature]?.[lang] ?? profile.feature) : "";

const CHAMBERS_WORD: Six = six("camere", "chambers", "chambres", "Kammern", "kamers", "camere");

/** Label of a profile row in every language: "Aluplast Ideal 4000 · 5 camere · 70 mm". */
export function standardProfileLabels(profile: StandardProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of Object.keys(CHAMBERS_WORD) as Array<keyof Six>) {
    out[l] = `${profile.name} · ${profile.chambers} ${CHAMBERS_WORD[l]} · ${profile.thicknessMm} mm${profile.feature ? ` · ${featureText(profile, l)}` : ""}`;
  }
  return out;
}

/** Keys of the profile rows older catalogues were seeded with (PVC): replaced, not deleted, when the standard list is applied. */
export const LEGACY_PVC_PROFILE_KEYS: readonly string[] = [
  "standard",
  "aluplast",
  "rehau",
  "kommerling",
  "deceuninck",
  "salamander",
  "aluplastEnergeto76",
  "kommerling76",
  "schuco",
];
