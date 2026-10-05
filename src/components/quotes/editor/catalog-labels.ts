import type { CatalogPayload } from "@/shared/pricing";
import { glazingForProfile, normalizeCatalog, profileSpec, profilesForQuality, qualityTiersFor, type ProfileSpec } from "@/shared/catalog-rules";

type Labelled = { key: string; labels?: Record<string, string> };

/** A catalogue row's label in `locale`, falling back to Italian, English, then the key. */
export function labelOf(row: Labelled | undefined, locale: string): string {
  if (!row) return "";
  return row.labels?.[locale] || row.labels?.it || row.labels?.en || row.key;
}

const bySort = <T extends { enabled: boolean; sortOrder?: number }>(rows: T[] | undefined) =>
  (rows ?? []).filter((r) => r.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/**
 * The enabled choices of each catalogue section, ready for <select>s. With a `selection` the lists follow it from the top down:
 * the profiles are the ones of the chosen quality, the glazing the units the chosen profile can hold.
 */
export function catalogChoices(raw: CatalogPayload, materialKey: string, locale: string, selection?: { quality?: string; profile?: string }) {
  const payload = normalizeCatalog(raw);
  const opt = (rows: Array<Labelled & { enabled: boolean; sortOrder?: number }> | undefined) =>
    bySort(rows).map((r) => ({ key: r.key, label: labelOf(r, locale) }));
  const ofMaterial = (payload.profileSystems ?? []).filter((p) => p.materialKey === materialKey);
  const inQuality = selection?.quality !== undefined ? profilesForQuality(ofMaterial, materialKey, selection.quality) : bySort(ofMaterial);
  const chosen = ofMaterial.find((p) => p.key === selection?.profile);
  return {
    materials: opt(payload.materials),
    qualities: qualityTiersFor(payload, materialKey).map((q) => ({ key: q.key, label: labelOf(q, locale) })),
    profiles: inQuality.map((p) => ({
      key: p.key,
      label: labelOf(p, locale),
      group: p.group,
      uFrame: p.uFrame,
      spec: profileSpec(p) as ProfileSpec,
    })),
    /** How many profiles the material has in total (to tell "none for this quality" from "no profile list"). */
    profileCount: bySort(ofMaterial).length,
    glazing: bySort(glazingForProfile(payload.glazing, chosen)).map((g) => ({ key: g.key, label: labelOf(g, locale), uGlass: g.uGlass })),
    glazingTotal: bySort(payload.glazing).length,
    finishes: bySort(payload.finish).map((f) => ({ key: f.key, label: labelOf(f, locale), swatch: f.swatchHex, texture: f.texture, range: f.range, group: f.group, warrantyYears: f.warrantyYears })),
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
