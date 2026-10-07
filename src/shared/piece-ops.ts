import { CATEGORY_DEFS, defaultSashesFor, handleRange, type PieceCategory } from "./configurator-model";
import type { CatalogPayload, ProjectItem } from "./pricing";
import { comboIssues, qualityTiersFor, virtualQualityTier } from "./catalog-rules";
import {
  SASH_MIN,
  normalizedRatios,
  sashTypeAllowedWith,
  violationsFor,
  type EditorSash,
  type SashKind,
  type SashMixCode,
} from "./sash-rules";
import { leafWidthLimits, leafWidthsMm, setLeafWidth, type LeafWidthLimits } from "./leaf-widths";
import { FIELD_OPENING_TYPES, leafFieldOpenings, leafTransoms, normalizeTransoms, suggestTransom, type FieldOpening } from "./transoms";
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
  // A tilt-turn beside a casement is the active leaf (it carries the handle): the main flag follows it.
  const hasTiltTurn = operable.some(({ s }) => s.type === "tiltturn");
  const explicit = operable.find(({ s }) => s.main === true && !(hasTiltTurn && s.type === "classic"));
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

/** Hardware colour of one leaf, or of every leaf that has hardware (fixed leaves have none). */
export function setHardwareColor(item: ProjectItem, index: number, key: string, allLeaves: boolean): ProjectItem {
  if (!allLeaves) return patchSash(item, index, { hardwareColor: key });
  return {
    ...item,
    sashes: item.sashes.map((s) => ((s.type as SashKind) === "fix" ? s : { ...s, hardwareColor: key })),
  };
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
    // A new leaf is the outermost one on the right: hinge on the right edge, handle
    // towards the middle, so the passage between the leaves stays free.
    direction: "right",
    active: true,
    hardware: payloadDefaults?.hardware ?? last?.hardware ?? "standard",
    hardwareColor: payloadDefaults?.hardwareColor ?? last?.hardwareColor ?? "silver",
    widthRatio: 1 / n,
    handleHeightMm: Math.round(item.height / 2),
    main: false,
  };
  const scaled = item.sashes.map((s, i) => ({
    ...s,
    // Going from one leaf to a pair: the first leaf hinges on the left (outer) edge.
    ...(n === 2 && i === 0 && type === "classic" && s.type !== "sliding" ? { direction: "left" as const } : {}),
    widthRatio: (s.widthRatio ?? 1 / item.sashes.length) * (1 - 1 / n),
  }));
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

/** Minimum clear width of every leaf, mm (the same minimums the drawing's red warning and the divider drag use). */
export function sashMinWidths(item: Pick<ProjectItem, "sashes">): number[] {
  return item.sashes.map((s) => SASH_MIN[s.type as SashKind].w);
}

/** What each leaf may be set to when its width is typed in: its own minimum up to the frame minus the minimum of the others. */
export function leafWidthRanges(item: Pick<ProjectItem, "width" | "sashes">): LeafWidthLimits[] {
  const mins = sashMinWidths(item);
  return mins.map((_, i) => leafWidthLimits(item.width, mins, i));
}

/** Whole-millimetre width of every leaf; always adds up to the frame width. */
export function sashWidthsMm(item: Pick<ProjectItem, "width" | "sashes">): number[] {
  return leafWidthsMm(item.width, normalizedRatios(item.sashes.map(asEditor)));
}

/**
 * Type the width of one leaf (whole mm). The other leaves share what is left in proportion to their widths, none under its minimum.
 * Refused (with the allowed range) when no arrangement can hold the value.
 */
export function setSashWidth(item: ProjectItem, index: number, mm: number): { ok: true; item: ProjectItem } | { ok: false; reason: "range" | "index"; min?: number; max?: number } {
  const r = setLeafWidth(item.width, normalizedRatios(item.sashes.map(asEditor)), sashMinWidths(item), index, mm);
  if (!r.ok) return r;
  return { ok: true, item: { ...item, sashes: item.sashes.map((s, i) => ({ ...s, widthRatio: r.ratios[i] })) } };
}

/** Change the piece height and keep every handle inside the slider range. */
export function setHeight(item: ProjectItem, height: number): ProjectItem {
  const range = handleRange(height);
  const sashes = item.sashes.map((s) => {
    const h = s.handleHeightMm ?? Math.round(item.height / 2);
    const scaled = Math.round((h / item.height) * height);
    const own = s.transoms === undefined ? undefined : normalizeTransoms(height, s.transoms.map((t) => Math.round((t / item.height) * height)));
    const bars = leafTransoms(height, { transoms: own }, undefined).length;
    return { ...s, ...(s.transoms !== undefined ? { transoms: own, fields: s.fields ? leafFieldOpenings(bars, s.fields) : undefined } : {}), handleHeightMm: Math.min(range.max, Math.max(Math.min(range.min, height - 100), scaled)) };
  });
  // The bars keep their proportional place on the taller / lower piece, and are dropped if they no longer fit.
  const transoms = item.transoms && item.transoms.length > 0
    ? normalizeTransoms(height, item.transoms.map((t) => Math.round((t / item.height) * height)))
    : undefined;
  return { ...item, height, sashes, ...(transoms && transoms.length > 0 ? { transoms } : { transoms: undefined }) };
}

/** Add a horizontal bar in the middle of the tallest field. No-op when no bar fits. */
export function addTransom(item: ProjectItem): ProjectItem {
  const pos = suggestTransom(item.height, item.transoms ?? []);
  return pos === null ? item : { ...item, transoms: normalizeTransoms(item.height, [...(item.transoms ?? []), pos]) };
}

export function removeTransom(item: ProjectItem, index: number): ProjectItem {
  const next = (item.transoms ?? []).filter((_, i) => i !== index);
  return { ...item, transoms: next.length > 0 ? next : undefined };
}

/** Move one bar (height from the sill, mm). A position that does not fit leaves the piece as it was. */
export function setTransomHeight(item: ProjectItem, index: number, mm: number): ProjectItem {
  const list = [...(item.transoms ?? [])];
  if (index < 0 || index >= list.length) return item;
  list[index] = Math.round(mm);
  const next = normalizeTransoms(item.height, list);
  return next.length === list.length ? { ...item, transoms: next } : item;
}

// --- Bars on a single leaf ------------------------------------------------------------------------------------------------

/** The bars this leaf has now (its own list, or the piece's). */
export function barsOfLeaf(item: ProjectItem, sashIndex: number): number[] {
  return leafTransoms(item.height, item.sashes[sashIndex], item.transoms);
}

function withLeafBars(item: ProjectItem, sashIndex: number, bars: number[], fields?: FieldOpening[]): ProjectItem {
  const kept = leafFieldOpenings(bars.length, fields ?? item.sashes[sashIndex]?.fields);
  return {
    ...item,
    sashes: item.sashes.map((s, i) => (i === sashIndex ? { ...s, transoms: bars, fields: bars.length > 0 ? kept : undefined } : s)),
  };
}

/** Put a bar on ONE leaf, in the middle of its tallest field. The leaf then carries its own list (no longer the piece's). No-op when none fits. */
export function addLeafTransom(item: ProjectItem, sashIndex: number): ProjectItem {
  if (!item.sashes[sashIndex]) return item;
  const current = barsOfLeaf(item, sashIndex);
  const pos = suggestTransom(item.height, current);
  if (pos === null) return item;
  const bars = normalizeTransoms(item.height, [...current, pos]);
  // The new field above the new bar starts as fixed glass (a fanlight); existing fields keep their opening.
  const old = leafFieldOpenings(current.length, item.sashes[sashIndex].fields);
  const at = bars.indexOf(pos);
  const fields = [...old.slice(0, at), { type: "fix" as const, direction: "left" as const }, ...old.slice(at)];
  return withLeafBars(item, sashIndex, bars, fields);
}

export function removeLeafTransom(item: ProjectItem, sashIndex: number, barIndex: number): ProjectItem {
  if (!item.sashes[sashIndex]) return item;
  const current = barsOfLeaf(item, sashIndex);
  if (barIndex < 0 || barIndex >= current.length) return item;
  const fields = leafFieldOpenings(current.length, item.sashes[sashIndex].fields).filter((_, i) => i !== barIndex);
  return withLeafBars(item, sashIndex, current.filter((_, i) => i !== barIndex), fields);
}

/** Move one bar of one leaf (height from the sill, mm). A position that does not fit leaves the piece as it was. */
export function setLeafTransomHeight(item: ProjectItem, sashIndex: number, barIndex: number, mm: number): ProjectItem {
  if (!item.sashes[sashIndex]) return item;
  const list = [...barsOfLeaf(item, sashIndex)];
  if (barIndex < 0 || barIndex >= list.length) return item;
  list[barIndex] = Math.round(mm);
  const next = normalizeTransoms(item.height, list);
  return next.length === list.length ? withLeafBars(item, sashIndex, next) : item;
}

/** Choose how the field ABOVE bar `barIndex` of a leaf opens (fixed glass, tilt, hinged, tilt-and-turn) and on which hinge side. */
export function setLeafFieldOpening(item: ProjectItem, sashIndex: number, barIndex: number, opening: FieldOpening): ProjectItem {
  const sash = item.sashes[sashIndex];
  if (!sash || !(FIELD_OPENING_TYPES as readonly string[]).includes(opening.type)) return item;
  const bars = barsOfLeaf(item, sashIndex);
  if (barIndex < 0 || barIndex >= bars.length) return item;
  const fields = leafFieldOpenings(bars.length, sash.fields).map((f, i) => (i === barIndex ? { type: opening.type, direction: opening.direction } : f));
  return withLeafBars(item, sashIndex, bars, fields);
}

/** Give every leaf the same bars and field openings as leaf `sashIndex` (the piece's own bars are cleared: each leaf now carries its list). */
export function applyLeafBarsToAll(item: ProjectItem, sashIndex: number): ProjectItem {
  const from = item.sashes[sashIndex];
  if (!from) return item;
  const bars = barsOfLeaf(item, sashIndex);
  const fields = leafFieldOpenings(bars.length, from.fields);
  return {
    ...item,
    transoms: undefined,
    sashes: item.sashes.map((s) => ({ ...s, transoms: [...bars], fields: bars.length > 0 ? fields.map((f) => ({ ...f })) : undefined })),
  };
}

/** Join the piece to an assembly (or leave it: `undefined`). */
export function setComposition(item: ProjectItem, placement: ProjectItem["composition"]): ProjectItem {
  return { ...item, composition: placement };
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

/** Most pieces one quote may carry — the server rejects more (convex/lib/quoteItems). */
export const MAX_PIECES = 50;

export function duplicateItem(items: ProjectItem[], index: number): ProjectItem[] {
  const src = items[index];
  if (!src || items.length >= MAX_PIECES) return items;
  const copy: ProjectItem = JSON.parse(JSON.stringify(src));
  // The copy is a separate piece: it does not take over the cell of the original in an assembly.
  delete copy.composition;
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
  | { code: "mix"; reason: string; mix?: SashMixCode }
  | { code: "profileQuality"; profile: string; quality: string }
  | { code: "glazingDepth"; glazing: string; profile: string; maxMm: number; depthMm: number }
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
    if (!check.ok && check.reason) out.push({ code: "mix", reason: check.reason, mix: check.mix });
  });
  if (payload) {
    const has = (rows: Array<{ key: string; enabled: boolean }> | undefined, key: string | undefined) =>
      !key || (rows ?? []).some((r) => r.key === key && r.enabled);
    if (!payload.materials.some((m) => m.key === item.material && m.enabled)) out.push({ code: "unknownKey", field: "material", key: item.material });
    const combo = comboIssues(payload, item);
    const wantedQuality = item.quality[item.material];
    const qualityKnown = qualityTiersFor(payload, item.material).some((q) => q.key === wantedQuality) || !!virtualQualityTier(payload, item.material, wantedQuality);
    if (!qualityKnown) out.push({ code: "unknownKey", field: "quality", key: wantedQuality ?? "" });
    for (const c of combo) {
      if (c.code === "profileUnknown") out.push({ code: "unknownKey", field: "profileSystem", key: c.key });
      else if (c.code === "profileQuality") out.push({ code: "profileQuality", profile: c.profile, quality: c.quality });
      else if (c.code === "glazingDepth") out.push({ code: "glazingDepth", glazing: c.glazing, profile: c.profile, maxMm: c.maxMm, depthMm: c.depthMm });
    }
    if (!has(payload.glazing, item.glazing)) out.push({ code: "unknownKey", field: "glazing", key: item.glazing });
    if (!has(payload.finish, item.color)) out.push({ code: "unknownKey", field: "color", key: item.color });
    if (item.frameType && payload.frameTypes && !has(payload.frameTypes, item.frameType)) out.push({ code: "unknownKey", field: "frameType", key: item.frameType });
  }
  return out;
}

/** Issues that must block saving the quote. */
export function blockingIssues(issues: PieceIssue[]): PieceIssue[] {
  return issues.filter((i) => i.code === "size" || i.code === "singleLeafMax" || i.code === "unknownKey" || i.code === "mix" || i.code === "profileQuality" || i.code === "glazingDepth");
}
