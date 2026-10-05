// Rules that tie quality, profile, glazing and gasket together, so every surface (B2B quote editor, showroom, widget,
// wizard, PDF, server) offers ONLY the choices that go with what was chosen before:
//   quality (number of chambers) -> profiles of that quality -> glazing units the profile can hold.
// Pure and shared; nothing here touches the database.

import type { CatalogPayload, ProjectItem } from "./pricing";
import { glazingShape, parseGlazingKey } from "./glazing-packages";
import { STANDARD_PROFILES, type QualityClass, type StandardProfile } from "./standard-pricing";

type Lang = "it" | "en" | "fr" | "de" | "nl" | "ro";
export type Gasket = "standard" | "triple";

/** The glass unit an installer can fit is about the frame depth minus the rebate and bead (indicative rule, not a data sheet). */
export const GLASS_ALLOWANCE_MM = 30;

type ProfileRow = NonNullable<CatalogPayload["profileSystems"]>[number];
type TierRow = CatalogPayload["qualityTiers"][number];

export const chamberQualityKey = (chambers: number) => `chamber${chambers}`;
export const chambersOfQualityKey = (key: string | undefined): number | undefined => {
  const m = /^chamber(\d{1,2})$/.exec(key ?? "");
  return m ? Number(m[1]) : undefined;
};

const WORD: Record<"chambers", Record<Lang, string>> = {
  chambers: { it: "camere", en: "chambers", fr: "chambres", de: "Kammern", nl: "kamers", ro: "camere" },
};
const LANGS = Object.keys(WORD.chambers) as Lang[];

/** Defaults of a "N chambers" quality tier: price multiplier (custom pricing only) and Uf correction, interpolated between the 5 and 7 chamber seeds. */
export function chamberTierDefaults(chambers: number): { multiplier: number; uAdjust: number } {
  const n = Math.min(8, Math.max(4, chambers));
  return { multiplier: Math.round((1 + 0.075 * (n - 5)) * 1000) / 1000, uAdjust: Math.round(-0.075 * (n - 5) * 1000) / 1000 };
}

export function chamberTierLabels(chambers: number): Record<string, string> {
  return Object.fromEntries(LANGS.map((l) => [l, `${chambers} ${WORD.chambers[l]}`]));
}

/** "70-82" -> 70: the shallowest depth of a range is the safe one. */
export function depthFromThickness(thickness: string): number | undefined {
  const nums = (thickness.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return nums.length ? Math.min(...nums) : undefined;
}

export interface ProfileSpec {
  chambers?: number;
  depthMm?: number;
  gasket?: Gasket;
  /** Thickest glazing unit the profile holds, mm (frame depth minus the allowance). */
  maxGlassMm?: number;
  klass?: QualityClass;
  qualityKey?: string;
}

export function specOfStandard(sp: StandardProfile): ProfileSpec {
  const depthMm = depthFromThickness(sp.thicknessMm);
  return {
    chambers: sp.chambers,
    depthMm,
    gasket: sp.gasket ?? "standard",
    maxGlassMm: depthMm ? depthMm - GLASS_ALLOWANCE_MM : undefined,
    klass: sp.klass,
    qualityKey: chamberQualityKey(sp.chambers),
  };
}

const SPEC_BY_KEY = new Map(STANDARD_PROFILES.map((p) => [p.key, specOfStandard(p)]));

/** What is known about a catalogue profile row (empty for a custom profile the installer typed in). */
export function profileSpec(p: Pick<ProfileRow, "standardKey" | "qualityKey"> | undefined): ProfileSpec {
  if (!p) return {};
  const fromList = p.standardKey ? SPEC_BY_KEY.get(p.standardKey) : undefined;
  const spec: ProfileSpec = { ...(fromList ?? {}) };
  if (p.qualityKey) spec.qualityKey = p.qualityKey;
  if (!spec.chambers) spec.chambers = chambersOfQualityKey(spec.qualityKey);
  return spec;
}

/** Quality tier a profile belongs to; undefined = not classified (offered with every quality of its material). */
export function profileQualityKey(p: Pick<ProfileRow, "standardKey" | "qualityKey"> | undefined): string | undefined {
  return profileSpec(p).qualityKey;
}

const enabledSorted = <T extends { enabled: boolean; sortOrder?: number }>(rows: T[] | undefined) =>
  (rows ?? []).filter((r) => r.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

export function qualityTiersFor(payload: Pick<CatalogPayload, "qualityTiers">, materialKey: string): TierRow[] {
  return enabledSorted(payload.qualityTiers.filter((q) => q.materialKey === materialKey));
}

/**
 * Enabled profiles of a material that go with a quality: the ones classified under it, plus the unclassified ones
 * (a profile typed in by hand, never tied to a quality, stays available everywhere until the installer classifies it).
 * With `strict` the unclassified are left out.
 */
export function profilesForQuality<T extends Pick<ProfileRow, "materialKey" | "standardKey" | "qualityKey" | "enabled"> & { sortOrder?: number }>(
  rows: T[] | undefined,
  materialKey: string,
  qualityKey: string | undefined,
  opts: { strict?: boolean } = {},
): T[] {
  return enabledSorted((rows ?? []).filter((p) => p.materialKey === materialKey)).filter((p) => {
    const q = profileQualityKey(p);
    return q === undefined ? !opts.strict : q === qualityKey;
  });
}

/** Can this profile hold the glazing unit? Unknown profile depth or unit thickness = yes. */
export function glazingFitsProfile(glazingKey: string | undefined, p: Pick<ProfileRow, "standardKey" | "qualityKey"> | undefined): boolean {
  const max = profileSpec(p).maxGlassMm;
  if (max === undefined || !glazingKey) return true;
  return glazingShape(glazingKey).depthMm <= max;
}

export function glazingForProfile<T extends { key: string; enabled: boolean; sortOrder?: number }>(rows: T[] | undefined, p: Pick<ProfileRow, "standardKey" | "qualityKey"> | undefined): T[] {
  return enabledSorted(rows).filter((g) => glazingFitsProfile(g.key, p));
}

const findProfile = (payload: Pick<CatalogPayload, "profileSystems">, material: string, key: string | undefined) =>
  key ? payload.profileSystems?.find((p) => p.materialKey === material && p.key === key) : undefined;

/** The glazing row closest to `wanted` among the units that fit: same family and composition, then the deepest that fits, then the first that fits. */
export function nearestFittingGlazing(glazing: CatalogPayload["glazing"], p: Pick<ProfileRow, "standardKey" | "qualityKey"> | undefined, wanted: string): string | undefined {
  const fits = glazingForProfile(glazing, p);
  if (fits.some((g) => g.key === wanted)) return wanted;
  const w = parseGlazingKey(wanted);
  if (w) {
    const sameComposition = fits
      .map((g) => ({ g, parsed: parseGlazingKey(g.key) }))
      .filter((x) => x.parsed && x.parsed.composition.id === w.composition.id && x.parsed.family === w.family)
      .sort((a, b) => b.parsed!.depthMm - a.parsed!.depthMm);
    if (sameComposition[0]) return sameComposition[0].g.key;
    const sameFamily = fits.map((g) => ({ g, parsed: parseGlazingKey(g.key) })).filter((x) => x.parsed?.family === w.family).sort((a, b) => b.parsed!.depthMm - a.parsed!.depthMm);
    if (sameFamily[0]) return sameFamily[0].g.key;
  }
  return fits[0]?.key;
}

/**
 * Brings a piece back to a coherent set of choices, from the top down: a quality that exists, a profile of that quality, a
 * glazing unit that profile can hold. Returns the same object when nothing needs to change.
 */
export function reconcileItem(payload: Pick<CatalogPayload, "qualityTiers" | "profileSystems" | "glazing">, item: ProjectItem): ProjectItem {
  const tiers = qualityTiersFor(payload, item.material);
  let quality = item.quality[item.material];
  if (tiers.length > 0 && !tiers.some((t) => t.key === quality)) quality = tiers[0].key;
  const profiles = profilesForQuality(payload.profileSystems, item.material, quality);
  let profileSystem = item.profileSystem;
  if (profiles.length > 0 && !profiles.some((p) => p.key === profileSystem)) profileSystem = profiles[0].key;
  if (profiles.length === 0) profileSystem = undefined;
  const profile = findProfile(payload, item.material, profileSystem);
  const glazing = nearestFittingGlazing(payload.glazing, profile, item.glazing) ?? item.glazing;
  if (quality === item.quality[item.material] && profileSystem === item.profileSystem && glazing === item.glazing) return item;
  return { ...item, quality: { ...item.quality, [item.material]: quality ?? "" }, profileSystem, glazing };
}

export type ComboIssue =
  | { code: "profileUnknown"; key: string }
  | { code: "profileQuality"; profile: string; quality: string }
  | { code: "glazingDepth"; glazing: string; profile: string; maxMm: number; depthMm: number };

/** Combinations the catalogue does not allow (checked in the editors and again on the server). */
export function comboIssues(payload: Pick<CatalogPayload, "profileSystems">, item: ProjectItem): ComboIssue[] {
  const out: ComboIssue[] = [];
  const ofMaterial = (payload.profileSystems ?? []).filter((p) => p.materialKey === item.material && p.enabled);
  if (ofMaterial.length === 0 || !item.profileSystem) return out;
  const profile = ofMaterial.find((p) => p.key === item.profileSystem);
  if (!profile) {
    out.push({ code: "profileUnknown", key: item.profileSystem });
    return out;
  }
  const quality = item.quality[item.material];
  const pq = profileQualityKey(profile);
  if (pq !== undefined && quality !== undefined && pq !== quality) out.push({ code: "profileQuality", profile: profile.key, quality });
  const max = profileSpec(profile).maxGlassMm;
  if (max !== undefined && !glazingFitsProfile(item.glazing, profile)) {
    out.push({ code: "glazingDepth", glazing: item.glazing, profile: profile.key, maxMm: max, depthMm: glazingShape(item.glazing).depthMm });
  }
  return out;
}

/**
 * A catalogue payload where every profile carries its quality and every quality the profiles refer to exists. Pure: used when a
 * snapshot is published, previewed or loaded, so catalogues built before the classification keep working with no migration.
 */
export function normalizeCatalog<P extends Pick<CatalogPayload, "qualityTiers" | "profileSystems">>(payload: P): P {
  const profileSystems = payload.profileSystems?.map((p) => {
    const q = profileQualityKey(p);
    return q && q !== p.qualityKey ? { ...p, qualityKey: q } : p;
  });
  const tiers = [...payload.qualityTiers];
  for (const p of profileSystems ?? []) {
    if (!p.enabled || !p.qualityKey) continue;
    const n = chambersOfQualityKey(p.qualityKey);
    if (n && !tiers.some((t) => t.materialKey === p.materialKey && t.key === p.qualityKey)) {
      const max = tiers.filter((t) => t.materialKey === p.materialKey).reduce((m, t) => Math.max(m, t.sortOrder), -1);
      tiers.push({ materialKey: p.materialKey, key: p.qualityKey, labels: chamberTierLabels(n), ...chamberTierDefaults(n), sortOrder: max + 1, enabled: true });
    }
    // A tier the installer switched off stays off: its profiles are reported by catalogGaps, never silently re-enabled.
  }
  // Chamber tiers sort by number so "5, 6, 7" read in order whatever order they were created in.
  const sorted = tiers.sort((a, b) => (a.materialKey === b.materialKey ? chamberOrder(a, b) : 0));
  return { ...payload, profileSystems, qualityTiers: sorted };
}

function chamberOrder(a: TierRow, b: TierRow): number {
  const na = chambersOfQualityKey(a.key);
  const nb = chambersOfQualityKey(b.key);
  if (na !== undefined && nb !== undefined) return na - nb;
  return a.sortOrder - b.sortOrder;
}

export type CatalogGap =
  | { code: "noQuality"; material: string }
  | { code: "qualityWithoutProfiles"; material: string; quality: string }
  | { code: "profileUnclassified"; material: string; profile: string }
  | { code: "profileQualityOff"; material: string; profile: string; quality: string }
  | { code: "profileNoGlazing"; material: string; profile: string };

/** What is missing or inconsistent in a catalogue, for the "Controllo catalogo" panel and the publish check. */
export function catalogGaps(payload: Pick<CatalogPayload, "materials" | "qualityTiers" | "profileSystems" | "glazing">): CatalogGap[] {
  const out: CatalogGap[] = [];
  for (const m of payload.materials.filter((x) => x.enabled)) {
    const tiers = qualityTiersFor(payload, m.key);
    if (tiers.length === 0) {
      out.push({ code: "noQuality", material: m.key });
      continue;
    }
    const all = (payload.profileSystems ?? []).filter((p) => p.materialKey === m.key && p.enabled);
    if (all.length === 0) continue;
    for (const t of tiers) {
      if (profilesForQuality(all, m.key, t.key, { strict: true }).length === 0 && all.every((p) => profileQualityKey(p) !== undefined)) {
        out.push({ code: "qualityWithoutProfiles", material: m.key, quality: t.key });
      }
    }
    for (const p of all) {
      const q = profileQualityKey(p);
      if (q === undefined) out.push({ code: "profileUnclassified", material: m.key, profile: p.key });
      else if (!tiers.some((t) => t.key === q)) out.push({ code: "profileQualityOff", material: m.key, profile: p.key, quality: q });
      if (glazingForProfile(payload.glazing, p).length === 0) out.push({ code: "profileNoGlazing", material: m.key, profile: p.key });
    }
  }
  return out;
}
