import type { CatalogPayload } from "@/shared/pricing";

type Labelled = { key: string; labels?: Record<string, string> };

/** A catalogue row's label in `locale`, falling back to Italian, English, then the key. */
export function labelOf(row: Labelled | undefined, locale: string): string {
  if (!row) return "";
  return row.labels?.[locale] || row.labels?.it || row.labels?.en || row.key;
}

const bySort = <T extends { enabled: boolean; sortOrder?: number }>(rows: T[] | undefined) =>
  (rows ?? []).filter((r) => r.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/** The enabled choices of each catalogue section, ready for <select>s. */
export function catalogChoices(payload: CatalogPayload, materialKey: string, locale: string) {
  const opt = (rows: Array<Labelled & { enabled: boolean; sortOrder?: number }> | undefined) =>
    bySort(rows).map((r) => ({ key: r.key, label: labelOf(r, locale) }));
  return {
    materials: opt(payload.materials),
    qualities: opt(payload.qualityTiers.filter((q) => q.materialKey === materialKey)),
    profiles: bySort(payload.profileSystems?.filter((p) => p.materialKey === materialKey)).map((p) => ({
      key: p.key,
      label: labelOf(p, locale),
      group: p.group,
      uFrame: p.uFrame,
    })),
    glazing: bySort(payload.glazing).map((g) => ({ key: g.key, label: labelOf(g, locale), uGlass: g.uGlass })),
    finishes: bySort(payload.finish).map((f) => ({ key: f.key, label: labelOf(f, locale), swatch: f.swatchHex })),
    frames: bySort(payload.frameTypes).map((f) => ({
      key: f.key,
      label: labelOf(f, locale),
      description: f.descriptions?.[locale] || f.descriptions?.it || "",
    })),
    hardware: bySort(payload.hardware.filter((h) => h.kind === "hardware")).map((h): [string, string] => [h.key, labelOf(h, locale)]),
    hardwareColors: bySort(payload.hardware.filter((h) => h.kind === "hardwareColor")).map((h): [string, string] => [h.key, labelOf(h, locale)]),
    accessories: (["zanz", "cass", "avv", "pers"] as const).map((category) => ({
      category,
      options: bySort(payload.accessories?.filter((a) => a.category === category)).map((a) => ({ key: a.key, label: labelOf(a, locale) })),
    })),
  };
}
