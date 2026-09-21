import { CATEGORY_DEFS, defaultSashesFor, type PieceCategory } from "./configurator-model";
import type { CatalogPayload, ProjectItem } from "./pricing";

type Row = { key: string; enabled: boolean; sortOrder?: number };

/** First enabled row (by sort order), preferring `preferred` keys when present. */
function pick<T extends Row>(rows: T[] | undefined, ...preferred: string[]): T | undefined {
  const enabled = (rows ?? []).filter((r) => r.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const key of preferred) {
    const hit = enabled.find((r) => r.key === key);
    if (hit) return hit;
  }
  return enabled[0];
}

/**
 * A ready-to-price piece of `category` built from the tenant's published
 * catalogue: every key it references really exists there, so a fresh piece never
 * prices at 0 because of a key that the catalogue does not know.
 */
export function defaultItem(
  payload: CatalogPayload,
  category: PieceCategory,
  size?: { width?: number; height?: number },
): ProjectItem {
  const def = CATEGORY_DEFS[category];
  const material = pick(payload.materials, "pvc");
  const materialKey = material?.key ?? "pvc";
  const quality = pick(payload.qualityTiers.filter((q) => q.materialKey === materialKey));
  const profile = pick(payload.profileSystems?.filter((p) => p.materialKey === materialKey), "standard");
  const glazing = pick(payload.glazing, "double");
  const finish = pick(payload.finish, "white");
  const hardware = pick(payload.hardware.filter((h) => h.kind === "hardware"), "standard");
  const hardwareColor = pick(payload.hardware.filter((h) => h.kind === "hardwareColor"), "silver", "white");
  const frame = pick(payload.frameTypes, "dritto");

  const width = size?.width ?? def.defaultWidthMm;
  const height = size?.height ?? def.defaultHeightMm;
  const sashes = defaultSashesFor(category, height).map((s) => ({
    ...s,
    hardware: hardware?.key ?? s.hardware,
    hardwareColor: hardwareColor?.key ?? s.hardwareColor,
  }));

  return {
    productType: def.productType,
    category,
    material: materialKey,
    quality: { [materialKey]: quality?.key ?? "" },
    profileSystem: profile?.key,
    width,
    height,
    quantity: 1,
    sashes,
    glazing: glazing?.key ?? "double",
    color: finish?.key ?? "white",
    insectScreen: false,
    frameType: frame?.key,
  };
}
