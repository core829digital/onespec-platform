// Adapter: turn the tenant's sanitized catalogue payload into the option lists
// and price table the widget UI already consumes. When a dimension is missing
// from the payload the prototype defaults fill the gap, so a half-configured
// catalogue still renders.

import type { Material, Pricing } from "./widget-pricing";
import { defaultPricing } from "./widget-pricing";
import type { WidgetDict } from "./widget-i18n";
import { REGION_FLAT_OPTION_KINDS } from "@/shared/pricing";
import { glazingPackageRows } from "@/shared/glazing-packages";
import { glazingForProfile, nearestFittingGlazing, normalizeCatalog, profileQualityKey, profileSpec, qualityTiersFor, type ProfileSpec } from "@/shared/catalog-rules";
import type { CatalogPayload } from "@/shared/pricing";
import type { ConfigState } from "./widget-pricing";

type Labels = Record<string, string> | undefined;

interface Row {
  key: string;
  labels?: Labels;
  priceCents?: number;
  sortOrder?: number;
  enabled?: boolean;
}
interface FinishRow extends Row {
  multiplier?: number;
  swatchHex?: string;
  range?: "skin" | "nuance" | "rock";
  group?: string;
  texture?: string;
  textureW?: number;
  textureH?: number;
  warrantyYears?: number;
}
interface MaterialRow extends Row {
  basePerM2Cents: number;
  profilePerMlCents: number;
  uFrameBase?: number;
}
interface QualityRow extends Row {
  materialKey: string;
  multiplier: number;
  uAdjust?: number;
  /** Standard price list entry / quality tier of a profile (see shared/catalog-rules). */
  standardKey?: string;
  qualityKey?: string;
  /** Standard price list prices of a profile, resolved for the owner's zone (cents). */
  standard?: { completePerM2Cents: number };
}
interface GlazingRow extends Row {
  multiplier?: number;
  pricePerM2Cents?: number;
}
interface HardwareRow extends Row {
  kind: string;
}

export interface WidgetCatalog {
  configurator?: { pricingMode?: "standard" | "custom"; marginPercent?: number; deliveryMode?: "factory" | "own"; ownServicePerM2Cents?: number; installationPerM2Cents?: number; installationDefault?: "with" | "without" };
  materials?: MaterialRow[];
  qualityTiers?: QualityRow[];
  profileSystems?: QualityRow[];
  glazing?: GlazingRow[];
  finish?: FinishRow[];
  hardware?: HardwareRow[];
  sizeConstraints?: Array<{
    productType: "window" | "balconyDoor";
    sashCount: number;
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  }>;
}

const CANONICAL_MATERIALS: Material[] = ["pvc", "wood", "aluminum"];

const label = (labels: Labels, locale: string, fallback: string) =>
  labels?.[locale] ?? labels?.it ?? labels?.en ?? fallback;

const bySort = <T extends { sortOrder?: number }>(a: T, b: T) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

const enabled = <T extends { enabled?: boolean }>(r: T) => r.enabled !== false;

/** `[key, label]` pairs from a catalogue table, or `null` when it's empty. */
function pairsFrom(rows: Row[] | undefined, locale: string, keepOrder = false): [string, string][] | null {
  if (!rows || rows.length === 0) return null;
  const list = keepOrder ? rows.filter(enabled) : rows.filter(enabled).sort(bySort);
  if (list.length === 0) return null;
  return list.map((r) => [r.key, label(r.labels, locale, r.key)]);
}

export interface FinishMeta {
  hex?: string;
  texture?: { href: string; w: number; h: number };
  range?: "skin" | "nuance" | "rock";
  group?: string;
  warrantyYears?: number;
}

export interface WidgetOptions {
  materials: { key: Material; label: string; swatch: string }[];
  quality: Record<string, [string, string][]>;
  /** profile system / brand pairs per canonical material key ("pvc" | "aluminum") */
  profileSystems: Record<string, [string, string][]>;
  glazing: [string, string][];
  /** Profile rows per material with the quality and technical spec each one carries (drives the quality -> profile -> glazing filter). */
  profileRows: Record<string, Array<{ key: string; label: string; qualityKey?: string; standardKey?: string; spec: ProfileSpec }>>;
  color: [string, string][];
  /** Swatch colour, texture and library range/group of every finish key, for the swatch picker and the drawing. */
  colorMeta: Record<string, FinishMeta>;
  sashTypes: [string, string][];
  hardware: [string, string][];
  hardwareColor: [string, string][];
  screenTypes: [string, string][];
  screenColors: [string, string][];
  installations: [string, string][];
  /**
   * Region-specific flat option kinds → `[key, label]` pairs, keyed by catalog
   * `kind`. A list is empty unless the tenant's region enabled that kind.
   */
  regionOptions: Record<string, [string, string][]>;
}

const SWATCH: Record<Material, string> = {
  pvc: "#DCEAF0",
  wood: "#F1E4D2",
  aluminum: "#E6E9EA",
};

/** The catalogue with every profile's quality filled in and every quality the profiles use present (6-chamber tier of older snapshots). */
function normalized(cat: WidgetCatalog | undefined): WidgetCatalog | undefined {
  if (!cat) return cat;
  return normalizeCatalog(cat as unknown as CatalogPayload) as unknown as WidgetCatalog;
}

export function catalogOptions(
  rawCat: WidgetCatalog | undefined,
  dict: WidgetDict,
  locale: string,
): WidgetOptions {
  const cat = normalized(rawCat);
  const hw = (kind: string) => cat?.hardware?.filter((h) => h.kind === kind);

  const matRows = cat?.materials?.filter(enabled).sort(bySort);
  const materials =
    matRows && matRows.length > 0
      ? matRows
          .filter((m) => (CANONICAL_MATERIALS as string[]).includes(m.key))
          .map((m) => ({
            key: m.key as Material,
            label: label(
              m.labels,
              locale,
              m.key === "pvc" ? dict.materialPVC : m.key === "wood" ? dict.materialWood : dict.materialAluminum,
            ),
            swatch: SWATCH[m.key as Material] ?? "#E6E9EA",
          }))
      : [
          { key: "pvc" as Material, label: dict.materialPVC, swatch: SWATCH.pvc },
          { key: "wood" as Material, label: dict.materialWood, swatch: SWATCH.wood },
          { key: "aluminum" as Material, label: dict.materialAluminum, swatch: SWATCH.aluminum },
        ];

  const quality: Record<string, [string, string][]> = {};
  const profileSystems: Record<string, [string, string][]> = {};
  for (const m of CANONICAL_MATERIALS) {
    const tiers = cat?.qualityTiers?.filter((q) => q.materialKey === m);
    // Chamber tiers read 5, 6, 7 whatever order they were created in.
    quality[m] = (tiers && tiers.length > 0 ? pairsFrom(qualityTiersFor({ qualityTiers: tiers as unknown as CatalogPayload["qualityTiers"] }, m) as unknown as Row[], locale, true) : null) ?? dict.quality[m] ?? [];
    const systems = cat?.profileSystems?.filter((p) => p.materialKey === m);
    profileSystems[m] = pairsFrom(systems, locale) ?? dict.brands[m] ?? [];
  }

  return {
    materials: materials.length > 0 ? materials : [
      { key: "pvc", label: dict.materialPVC, swatch: SWATCH.pvc },
    ],
    quality,
    profileSystems,
    profileRows: Object.fromEntries(
      CANONICAL_MATERIALS.map((m) => [
        m,
        (cat?.profileSystems ?? [])
          .filter((r) => r.materialKey === m && enabled(r))
          .sort(bySort)
          .map((r) => ({ key: r.key, label: label(r.labels, locale, r.key), qualityKey: profileQualityKey(r), standardKey: r.standardKey, spec: profileSpec(r) })),
      ]),
    ),
    glazing: pairsFrom(cat?.glazing, locale) ?? [...dict.glazing, ...glazingPackageRows().map((r): [string, string] => [r.key, r.labels[locale] ?? r.labels.en])],
    color: pairsFrom(cat?.finish, locale) ?? dict.color,
    colorMeta: Object.fromEntries(
      (cat?.finish ?? []).filter(enabled).map((f): [string, FinishMeta] => [
        f.key,
        {
          hex: f.swatchHex,
          ...(f.texture && f.textureW && f.textureH ? { texture: { href: f.texture, w: f.textureW, h: f.textureH } } : {}),
          ...(f.range ? { range: f.range } : {}),
          ...(f.group ? { group: f.group } : {}),
          ...(f.warrantyYears ? { warrantyYears: f.warrantyYears } : {}),
        },
      ]),
    ),
    sashTypes: pairsFrom(hw("sashType"), locale) ?? dict.sashTypes,
    hardware: pairsFrom(hw("hardware"), locale) ?? dict.hardwareBrands,
    hardwareColor: pairsFrom(hw("hardwareColor"), locale) ?? dict.hardwareColors,
    screenTypes: pairsFrom(hw("screen"), locale) ?? dict.insectScreenTypes,
    screenColors: pairsFrom(hw("screenColor"), locale) ?? dict.insectScreenColors,
    installations: pairsFrom(hw("installation"), locale) ?? dict.installationOptions,
    regionOptions: Object.fromEntries(
      REGION_FLAT_OPTION_KINDS.map((k) => [k, pairsFrom(hw(k), locale) ?? []]),
    ),
  };
}

const cents = (c: number | undefined, fallbackEuros: number) =>
  typeof c === "number" ? c / 100 : fallbackEuros;

/** A `Pricing` table with catalogue values overlaid on the prototype defaults. */
export function catalogPricing(rawCat: WidgetCatalog | undefined): Pricing {
  const p = defaultPricing();
  if (!rawCat) return p;
  const cat = normalized(rawCat) as WidgetCatalog;

  for (const key of CANONICAL_MATERIALS) {
    const m = cat.materials?.find((x) => x.key === key);
    if (m) {
      p.materials[key].basePerM2 = cents(m.basePerM2Cents, p.materials[key].basePerM2);
      p.materials[key].profilePerMl = cents(m.profilePerMlCents, p.materials[key].profilePerMl);
    }
    const tiers = cat.qualityTiers?.filter((q) => q.materialKey === key && enabled(q));
    if (tiers && tiers.length > 0) {
      p.materials[key].qualities = Object.fromEntries(
        tiers.map((t) => [t.key, t.multiplier]),
      );
    }
    if (key === "pvc" || key === "aluminum") {
      const systems = cat.profileSystems?.filter((s) => s.materialKey === key && enabled(s));
      if (systems && systems.length > 0) {
        p.brandMultiplier[key] = Object.fromEntries(systems.map((s) => [s.key, s.multiplier]));
      }
    }
  }

  const priceMap = (rows: Row[] | undefined) =>
    rows && rows.length > 0
      ? Object.fromEntries(rows.filter(enabled).map((r) => [r.key, cents(r.priceCents, 0)]))
      : null;

  const glazing = priceMap(cat.glazing);
  if (glazing) p.glazing = glazing;
  const color = priceMap(cat.finish);
  if (color) p.color = color;

  // Same inputs the server prices with: per-m² glazing, colour / glazing multipliers, the standard price list, the margin.
  const perM2 = (cat.glazing ?? []).filter((g) => enabled(g) && (g.pricePerM2Cents ?? 0) > 0);
  p.glazingPerM2 = Object.fromEntries(perM2.map((g) => [g.key, (g.pricePerM2Cents ?? 0) / 100]));
  p.glazingMult = Object.fromEntries((cat.glazing ?? []).filter((g) => enabled(g) && typeof g.multiplier === "number").map((g) => [g.key, g.multiplier as number]));
  p.colorMult = Object.fromEntries((cat.finish ?? []).filter((f) => enabled(f) && typeof f.multiplier === "number").map((f) => [f.key, f.multiplier as number]));
  if (cat.configurator?.pricingMode === "standard") {
    const rows = (cat.profileSystems ?? []).filter((s) => s.materialKey === "pvc" && enabled(s) && s.standard);
    p.standard = { completePerM2: Object.fromEntries(rows.map((s) => [s.key, (s.standard as { completePerM2Cents: number }).completePerM2Cents / 100])) };
  }
  const margin = cat.configurator?.marginPercent;
  p.marginPercent = typeof margin === "number" && Number.isFinite(margin) && margin > 0 ? margin : 0;
  const own = cat.configurator?.ownServicePerM2Cents;
  p.ownServicePerM2 = cat.configurator?.deliveryMode === "own" && typeof own === "number" && Number.isFinite(own) && own > 0 ? own / 100 : 0;

  const posa = cat.configurator?.installationPerM2Cents;
  p.installationPerM2 = typeof posa === "number" && Number.isFinite(posa) && posa > 0 ? posa / 100 : 0;
  p.installationDefault = cat.configurator?.installationDefault !== "without";

  const hw = (kind: string) => priceMap(cat.hardware?.filter((h) => h.kind === kind));
  const sashType = hw("sashType");
  if (sashType) p.sashType = { ...p.sashType, ...sashType } as Pricing["sashType"];
  const hardware = hw("hardware");
  if (hardware) p.hardware = hardware;
  const hardwareColor = hw("hardwareColor");
  if (hardwareColor) p.hardwareColor = hardwareColor;
  const screen = hw("screen");
  if (screen) p.insectScreenType = { ...p.insectScreenType, ...screen };
  const screenColor = hw("screenColor");
  if (screenColor) p.insectScreenColor = { ...p.insectScreenColor, ...screenColor };
  const installation = hw("installation");
  if (installation) p.installation = { ...p.installation, ...installation };
  for (const kind of REGION_FLAT_OPTION_KINDS) {
    const m = hw(kind);
    if (m) {
      const table = p[kind] as Record<string, number>;
      (p as Record<string, unknown>)[kind] = { ...table, ...m };
    }
  }

  const threshold = cat.hardware?.find((h) => h.kind === "threshold" && enabled(h));
  if (threshold) p.balconyDoorThreshold = cents(threshold.priceCents, p.balconyDoorThreshold);

  return p;
}

// ---- quality -> profile -> glazing: the same rules as the quote editor, on the widget's own option lists ----

/** Profiles of a material that go with a quality (hand-made, unclassified ones go with every quality). */
export function brandChoices(options: WidgetOptions, material: string, quality: string | undefined): [string, string][] {
  const rows = options.profileRows[material];
  if (!rows || rows.length === 0) return options.profileSystems[material] ?? [];
  return rows.filter((r) => r.qualityKey === undefined || r.qualityKey === quality).map((r): [string, string] => [r.key, r.label]);
}

/** Glazing units the chosen profile can hold (all of them for a profile with no known depth). */
export function glazingChoices(options: WidgetOptions, material: string, brandKey: string | undefined): [string, string][] {
  const row = options.profileRows[material]?.find((r) => r.key === brandKey);
  if (!row) return options.glazing;
  const fits = new Set(glazingForProfile(options.glazing.map(([key]) => ({ key, enabled: true })), row).map((g) => g.key));
  return options.glazing.filter(([k]) => fits.has(k));
}

/** Brings the widget's state to a coherent set from the top down: a quality, a profile of that quality, glazing that profile can hold. */
export function reconcileState(options: WidgetOptions, s: ConfigState): ConfigState {
  const qualities = options.quality[s.material] ?? [];
  const quality = qualities.length > 0 && !qualities.some(([k]) => k === s.quality[s.material]) ? qualities[0][0] : s.quality[s.material];
  let brand = s.brand;
  if (s.material === "pvc" || s.material === "aluminum") {
    const list = brandChoices(options, s.material, quality);
    const current = brand[s.material];
    if (list.length > 0 && !list.some(([k]) => k === current)) brand = { ...brand, [s.material]: list[0][0] };
    // No profile goes with this quality: nothing is sent (the widget tells the user to pick another quality).
    else if (list.length === 0 && (options.profileRows[s.material]?.length ?? 0) > 0 && current !== "") brand = { ...brand, [s.material]: "" };
  }
  const row = options.profileRows[s.material]?.find((r) => r.key === (s.material === "pvc" || s.material === "aluminum" ? brand[s.material] : undefined));
  const glazing = row ? nearestFittingGlazing(options.glazing.map(([key]) => ({ key, labels: {}, priceCents: 0, sortOrder: 0, enabled: true })), row, s.glazing) ?? s.glazing : s.glazing;
  if (quality === s.quality[s.material] && brand === s.brand && glazing === s.glazing) return s;
  return { ...s, quality: { ...s.quality, [s.material]: quality }, brand, glazing };
}
