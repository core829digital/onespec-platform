// Adapter: turn the tenant's sanitized catalogue payload into the option lists
// and price table the widget UI already consumes. When a dimension is missing
// from the payload the prototype defaults fill the gap, so a half-configured
// catalogue still renders.

import type { Material, Pricing } from "./widget-pricing";
import { defaultPricing } from "./widget-pricing";
import type { WidgetDict } from "./widget-i18n";

type Labels = Record<string, string> | undefined;

interface Row {
  key: string;
  labels?: Labels;
  priceCents?: number;
  sortOrder?: number;
  enabled?: boolean;
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
}
interface HardwareRow extends Row {
  kind: string;
}

export interface WidgetCatalog {
  materials?: MaterialRow[];
  qualityTiers?: QualityRow[];
  glazing?: Row[];
  finish?: Row[];
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
function pairsFrom(rows: Row[] | undefined, locale: string): [string, string][] | null {
  if (!rows || rows.length === 0) return null;
  const list = rows.filter(enabled).sort(bySort);
  if (list.length === 0) return null;
  return list.map((r) => [r.key, label(r.labels, locale, r.key)]);
}

export interface WidgetOptions {
  materials: { key: Material; label: string; swatch: string }[];
  quality: Record<string, [string, string][]>;
  glazing: [string, string][];
  color: [string, string][];
  sashTypes: [string, string][];
  hardware: [string, string][];
  hardwareColor: [string, string][];
  screenTypes: [string, string][];
}

const SWATCH: Record<Material, string> = {
  pvc: "#DCEAF0",
  wood: "#F1E4D2",
  aluminum: "#E6E9EA",
};

export function catalogOptions(
  cat: WidgetCatalog | undefined,
  dict: WidgetDict,
  locale: string,
): WidgetOptions {
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
  for (const m of CANONICAL_MATERIALS) {
    const tiers = cat?.qualityTiers?.filter((q) => q.materialKey === m);
    quality[m] = pairsFrom(tiers, locale) ?? dict.quality[m] ?? [];
  }

  return {
    materials: materials.length > 0 ? materials : [
      { key: "pvc", label: dict.materialPVC, swatch: SWATCH.pvc },
    ],
    quality,
    glazing: pairsFrom(cat?.glazing, locale) ?? dict.glazing,
    color: pairsFrom(cat?.finish, locale) ?? dict.color,
    sashTypes: pairsFrom(hw("sashType"), locale) ?? dict.sashTypes,
    hardware: pairsFrom(hw("hardware"), locale) ?? dict.hardwareBrands,
    hardwareColor: pairsFrom(hw("hardwareColor"), locale) ?? dict.hardwareColors,
    screenTypes: pairsFrom(hw("screen"), locale) ?? dict.insectScreenTypes,
  };
}

const cents = (c: number | undefined, fallbackEuros: number) =>
  typeof c === "number" ? c / 100 : fallbackEuros;

/** A `Pricing` table with catalogue values overlaid on the prototype defaults. */
export function catalogPricing(cat: WidgetCatalog | undefined): Pricing {
  const p = defaultPricing();
  if (!cat) return p;

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
  }

  const priceMap = (rows: Row[] | undefined) =>
    rows && rows.length > 0
      ? Object.fromEntries(rows.filter(enabled).map((r) => [r.key, cents(r.priceCents, 0)]))
      : null;

  const glazing = priceMap(cat.glazing);
  if (glazing) p.glazing = glazing;
  const color = priceMap(cat.finish);
  if (color) p.color = color;

  const hw = (kind: string) => priceMap(cat.hardware?.filter((h) => h.kind === kind));
  const sashType = hw("sashType");
  if (sashType) p.sashType = { ...p.sashType, ...sashType } as Pricing["sashType"];
  const hardware = hw("hardware");
  if (hardware) p.hardware = hardware;
  const hardwareColor = hw("hardwareColor");
  if (hardwareColor) p.hardwareColor = hardwareColor;
  const screen = hw("screen");
  if (screen) p.insectScreenType = { ...p.insectScreenType, ...screen };

  const threshold = cat.hardware?.find((h) => h.kind === "threshold" && enabled(h));
  if (threshold) p.balconyDoorThreshold = cents(threshold.priceCents, p.balconyDoorThreshold);

  return p;
}
