import { CATEGORY_DEFS, defaultSashesFor, handleRange, type PieceCategory } from "./configurator-model";
import type { CatalogPayload, ProjectItem } from "./pricing";
import {
  SASH_MIN,
  normalizedRatios,
  sashTypeAllowedWith,
  violationsFor,
  type EditorSash,
  type SashKind,
} from "./sash-rules";
import { DIM_ABS_MAX, SINGLE_SASH_MAX_HEIGHT, SINGLE_SASH_MAX_WIDTH } from "./widget-types";

/**
 * Pure editing operations on a piece, shared by the B2B quote page and the
 * Showroom. Every operation returns a NEW item and keeps the leaves consistent:
 * ratios add up to 1, exactly one "principale" among the operable leaves, and
 * sliding / lift-slide never mix with hinged leaves.
 */

type Sash = ProjectItem["sashes"][number];
export const MAX_LEAVES = 6;
export const MIN_LEAF_RATIO = 0.05;

const asEditor = (s: Sash): EditorSash => s as unknown as EditorSash;

/** Re-normalise the ratios so they sum to exactly 1. */
export function withNormalizedRatios(sashes: Sash[]): Sash[] {
  const r = normalizedRatios(sashes.map(asEditor));
  return sashes.map((s, i) => ({ ...s, widthRatio: r[i] }));
}

/** Exactly one principale leaf: the first tilt-turn, else the first tilt/casement/sliding/lift-slide. */
export function electMain(sashes: Sash[]): Sash[] {
  const operable = sashes.map((s, i) => ({ s, i })).filter(({ s }) => s.active && s.type !== "fix");
  if (operable.length === 0) return sashes.map((s) => ({ ...s, main: false }));
  const explicit = operable.find(({ s }) => s.main === true);
  const keep =
    explicit ??
    operable.find(({ s }) => s.type === "tiltturn") ??
    operable.find(({ s }) => s.type === "tilt") ??
    operable[0];
  return sashes.map((s, i) => ({ ...s, main: i === keep.i }));
}

export function patchSash(item: ProjectItem, index: number, patch: Partial<Sash>): ProjectItem {
  if (index < 0 || index >= item.sashes.length) return item;
  let sashes = item.sashes.map((s, i) => (i === index ? { ...s, ...patch } : s));
  // Marking a leaf principale clears the flag on the others.
  if (patch.main === true) sashes = sashes.map((s, i) => ({ ...s, main: i === index }));
  return { ...item, sashes: electMain(sashes) };
}

/** Append a leaf of the family already in the frame (sliding / lift-slide / hinged). */
export function addSash(item: ProjectItem, payloadDefaults?: { hardware?: string; hardwareColor?: string }): ProjectItem {
  if (item.sashes.length >= MAX_LEAVES) return item;
  const has = (t: SashKind) => item.sashes.some((s) => (s.type as SashKind) === t);
  const type: SashKind = has("sliding") ? "sliding" : has("liftslide") ? "liftslide" : "classic";
  const n = item.sashes.length + 1;
  const last = item.sashes[item.sashes.length - 1];
  const sash: Sash = {
    type,
    direction: last?.direction === "left" ? "right" : "left",
    active: true,
    hardware: payloadDefaults?.hardware ?? last?.hardware ?? "standard",
    hardwareColor: payloadDefaults?.hardwareColor ?? last?.hardwareColor ?? "silver",
    widthRatio: 1 / n,
    handleHeightMm: Math.round(item.height / 2),
    main: false,
  };
  const scaled = item.sashes.map((s) => ({ ...s, widthRatio: (s.widthRatio ?? 1 / item.sashes.length) * (1 - 1 / n) }));
  return { ...item, sashes: electMain(withNormalizedRatios([...scaled, sash])) };
}

export function removeSash(item: ProjectItem, index: number): ProjectItem {
  if (item.sashes.length <= 1 || index < 0 || index >= item.sashes.length) return item;
  const rest = item.sashes.filter((_, i) => i !== index);
  return { ...item, sashes: electMain(withNormalizedRatios(rest)) };
}

/**
 * Drag a divider: `leftRatio` is the new absolute width ratio of leaf
 * `dividerIndex`; its right neighbour absorbs the difference. Both stay above
 * their minimum clear width.
 */
export function resizeDivider(item: ProjectItem, dividerIndex: number, leftRatio: number): ProjectItem {
  const ratios = normalizedRatios(item.sashes.map(asEditor));
  if (dividerIndex < 0 || dividerIndex + 1 >= ratios.length) return item;
  const pair = ratios[dividerIndex] + ratios[dividerIndex + 1];
  const minL = Math.max(MIN_LEAF_RATIO, SASH_MIN[item.sashes[dividerIndex].type as SashKind].w / item.width);
  const minR = Math.max(MIN_LEAF_RATIO, SASH_MIN[item.sashes[dividerIndex + 1].type as SashKind].w / item.width);
  if (minL + minR >= pair) return item;
  const left = Math.min(pair - minR, Math.max(minL, leftRatio));
  const next = [...ratios];
  next[dividerIndex] = left;
  next[dividerIndex + 1] = pair - left;
  return { ...item, sashes: item.sashes.map((s, i) => ({ ...s, widthRatio: next[i] })) };
}

/** Change the piece height and keep every handle inside the slider range. */
export function setHeight(item: ProjectItem, height: number): ProjectItem {
  const range = handleRange(height);
  const sashes = item.sashes.map((s) => {
    const h = s.handleHeightMm ?? Math.round(item.height / 2);
    const scaled = Math.round((h / item.height) * height);
    return { ...s, handleHeightMm: Math.min(range.max, Math.max(Math.min(range.min, height - 100), scaled)) };
  });
  return { ...item, height, sashes };
}

/** Start the piece over as `category`, keeping size, material and finishes. */
export function setCategory(item: ProjectItem, category: PieceCategory, keys?: { hardware?: string; hardwareColor?: string }): ProjectItem {
  const def = CATEGORY_DEFS[category];
  const sashes = defaultSashesFor(category, item.height).map((s) => ({
    ...s,
    hardware: keys?.hardware ?? s.hardware,
    hardwareColor: keys?.hardwareColor ?? s.hardwareColor,
  }));
  return { ...item, category, productType: def.productType, sashes };
}

/** Apply one telaio to every piece of the lot. */
export function applyFrameToAll(items: ProjectItem[], frameType: string): ProjectItem[] {
  return items.map((it) => ({ ...it, frameType }));
}

export function duplicateItem(items: ProjectItem[], index: number): ProjectItem[] {
  const src = items[index];
  if (!src) return items;
  const copy: ProjectItem = JSON.parse(JSON.stringify(src));
  return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
}

export function moveItem(items: ProjectItem[], from: number, to: number): ProjectItem[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export type PieceIssue =
  | { code: "size"; axis: "width" | "height"; min: number; max: number }
  | { code: "leafWidth" | "leafHeight"; leaf: number; min: number; got: number }
  | { code: "singleLeafMax"; axis: "width" | "height"; max: number }
  | { code: "mix"; reason: string }
  | { code: "unknownKey"; field: "material" | "quality" | "glazing" | "color" | "frameType" | "profileSystem" | "hardware"; key: string };

/**
 * Everything wrong with a piece, as data the UI translates. Hard problems (size
 * outside 200-6000, a single leaf above 1200x2800, unknown catalogue keys) block
 * saving; leaf-width issues are warnings but still listed.
 */
export function pieceIssues(item: ProjectItem, payload?: CatalogPayload): PieceIssue[] {
  const out: PieceIssue[] = [];
  if (item.width < 200 || item.width > DIM_ABS_MAX) out.push({ code: "size", axis: "width", min: 200, max: DIM_ABS_MAX });
  if (item.height < 200 || item.height > DIM_ABS_MAX) out.push({ code: "size", axis: "height", min: 200, max: DIM_ABS_MAX });
  if (item.sashes.length === 1) {
    if (item.width > SINGLE_SASH_MAX_WIDTH) out.push({ code: "singleLeafMax", axis: "width", max: SINGLE_SASH_MAX_WIDTH });
    if (item.height > SINGLE_SASH_MAX_HEIGHT) out.push({ code: "singleLeafMax", axis: "height", max: SINGLE_SASH_MAX_HEIGHT });
  }
  for (const v of violationsFor({ width: item.width, height: item.height, sashes: item.sashes.map(asEditor) })) {
    out.push({ code: v.axis === "width" ? "leafWidth" : "leafHeight", leaf: v.sashIndex, min: v.min, got: v.got });
  }
  const types = item.sashes.map((s) => s.type as SashKind);
  types.forEach((t, i) => {
    const check = sashTypeAllowedWith(types.filter((_, j) => j !== i), t);
    if (!check.ok && check.reason) out.push({ code: "mix", reason: check.reason });
  });
  if (payload) {
    const has = (rows: Array<{ key: string; enabled: boolean }> | undefined, key: string | undefined) =>
      !key || (rows ?? []).some((r) => r.key === key && r.enabled);
    if (!payload.materials.some((m) => m.key === item.material && m.enabled)) out.push({ code: "unknownKey", field: "material", key: item.material });
    if (!payload.qualityTiers.some((q) => q.materialKey === item.material && q.key === item.quality[item.material] && q.enabled)) {
      out.push({ code: "unknownKey", field: "quality", key: item.quality[item.material] ?? "" });
    }
    if (!has(payload.glazing, item.glazing)) out.push({ code: "unknownKey", field: "glazing", key: item.glazing });
    if (!has(payload.finish, item.color)) out.push({ code: "unknownKey", field: "color", key: item.color });
    if (item.frameType && payload.frameTypes && !has(payload.frameTypes, item.frameType)) out.push({ code: "unknownKey", field: "frameType", key: item.frameType });
  }
  return out;
}

/** Issues that must block saving the quote. */
export function blockingIssues(issues: PieceIssue[]): PieceIssue[] {
  return issues.filter((i) => i.code === "size" || i.code === "singleLeafMax" || i.code === "unknownKey" || i.code === "mix");
}
