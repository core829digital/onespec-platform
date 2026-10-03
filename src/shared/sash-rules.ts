// Canonical sash model + geometry/combination rules for the B2B field-quote
// configurator. Shared between the interactive editor (client) and the Zod
// validation in widget-types.ts so the two can never disagree.
//
// Ported from the ONESPEC "Configuratore Avanzato Canate" prototype: same six
// sash kinds, the same per-type minimum widths/heights, and the same rule that
// sliding and lift-slide never mix with hinged sashes.

export type SashKind =
  | "fix"
  | "classic"
  | "tiltturn"
  | "tilt"
  | "sliding"
  | "liftslide";

export type SecurityClass = "standard" | "rc2" | "rc3";

/** The sash shape the editor reads/writes. A superset of the widget `Sash`. */
export interface EditorSash {
  type: SashKind;
  direction: "left" | "right";
  active: boolean;
  hardware: string;
  hardwareColor: string;
  /** Share of the frame width, 0..1. Absent → equal split with its siblings. */
  widthRatio?: number;
  /** Handle height from the sash floor, mm. Operable sashes only. */
  handleHeightMm?: number;
  /** The "principale" sash — the one opened first / carrying the main handle. */
  main?: boolean;
  securityClass?: SecurityClass;
}

/** Just the fields the geometry rules need from a project item. */
export interface SashHostItem {
  width: number;
  height: number;
  sashes: EditorSash[];
}

export const SASH_KINDS: SashKind[] = [
  "fix",
  "classic",
  "tiltturn",
  "tilt",
  "sliding",
  "liftslide",
];

/** Minimum clear width/height per sash kind, mm (structural). */
export const SASH_MIN: Record<SashKind, { w: number; h: number }> = {
  fix: { w: 300, h: 300 },
  classic: { w: 300, h: 400 },
  tiltturn: { w: 415, h: 415 },
  tilt: { w: 415, h: 415 },
  sliding: { w: 600, h: 400 },
  liftslide: { w: 800, h: 1500 },
};

export const SECURITY_CLASSES: SecurityClass[] = ["standard", "rc2", "rc3"];

export function isOperable(type: SashKind): boolean {
  return type !== "fix";
}

/** Equal width ratios for `n` sashes. */
export function equalRatios(n: number): number[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, () => 1 / n);
}

/**
 * Normalised width ratios for a sash list: any sash without an explicit
 * `widthRatio` gets an equal share of whatever is left, then the whole set is
 * scaled to sum exactly 1.
 */
export function normalizedRatios(sashes: EditorSash[]): number[] {
  const n = sashes.length;
  if (n === 0) return [];
  const explicit = sashes.map((s) =>
    typeof s.widthRatio === "number" && s.widthRatio > 0 ? s.widthRatio : null,
  );
  const known = explicit.filter((r): r is number => r !== null);
  const knownSum = known.reduce((a, b) => a + b, 0);
  const missing = n - known.length;
  const share = missing > 0 ? Math.max(0, (1 - knownSum) / missing) : 0;
  const raw = explicit.map((r) => (r === null ? share || 1 / n : r));
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((r) => r / total);
}

/**
 * Whether `candidate` can be added to / set on a sash sitting alongside
 * `siblings` (the other sashes' types). Sliding and lift-slide are exclusive
 * systems — every sash in one frame must be the same sliding family, and they
 * never mix with hinged sashes.
 */
/** Why two sash systems cannot share a frame — a stable code the UI translates (`reason` stays as the Italian fallback). */
export type SashMixCode = "slidingOnly" | "liftslideOnly" | "hingedVsSliding" | "hingedVsLiftslide";

export function sashTypeAllowedWith(
  siblings: SashKind[],
  candidate: SashKind,
): { ok: boolean; reason?: string; mix?: SashMixCode } {
  if (candidate === "fix") return { ok: true };
  const others = siblings.filter(Boolean);
  const hasSliding = others.includes("sliding");
  const hasLiftSlide = others.includes("liftslide");
  // A fixed leaf never moves, so it sits next to any system.
  const hasHinged = others.some((t) => t !== "sliding" && t !== "liftslide" && t !== "fix");

  if (candidate === "sliding") {
    if (hasHinged || hasLiftSlide) {
      return { ok: false, mix: "slidingOnly", reason: "Lo scorrevole si combina solo con altri scorrevoli." };
    }
  } else if (candidate === "liftslide") {
    if (hasHinged || hasSliding) {
      return { ok: false, mix: "liftslideOnly", reason: "L'alzante scorrevole si combina solo con altri alzanti." };
    }
  } else {
    if (hasSliding) {
      return { ok: false, mix: "hingedVsSliding", reason: "Non si può mischiare un'anta a battente con lo scorrevole." };
    }
    if (hasLiftSlide) {
      return { ok: false, mix: "hingedVsLiftslide", reason: "Non si può mischiare un'anta a battente con l'alzante scorrevole." };
    }
  }
  return { ok: true };
}

/**
 * Set leaf `index` to `next` and keep the frame physically possible: sliding / lift-slide
 * systems never share a frame with hinged leaves (or with each other). A customer-facing
 * form cannot refuse the click with an alert, so the other moving leaves follow the new
 * family instead; fixed leaves never change.
 */
export function retypeSash<T extends { type: SashKind; direction?: Side }>(sashes: T[], index: number, next: SashKind): T[] {
  const others = sashes.filter((_, j) => j !== index).map((x) => x.type);
  const conflict = !sashTypeAllowedWith(others, next).ok;
  // A changed leaf keeps the opening the customer picked ("Right" stays "Right"), whatever the family.
  const change = (sash: T): T => ({
    ...sash,
    type: next,
    ...(sash.direction ? { direction: directionOnRetype(sash.type, sash.direction, next) } : {}),
  });
  return sashes.map((sash, j) => {
    if (j === index) return change(sash);
    if (!conflict || sash.type === "fix") return sash;
    return change(sash);
  });
}

/**
 * What stands between two neighbouring leaves (technical rules of the frame):
 * - "fixedMullion": a fixed mullion on the frame. Tilt-turn next to tilt-turn, a vasistas next to anything that
 *   moves, and any hinged leaf next to a fixed one need it.
 * - "movableMullion": tilt-turn next to a casement (or two casements): the handle sits on the ACTIVE leaf (the
 *   tilt-turn one, automatically) and the other, handle-less leaf carries a movable mullion.
 * - "none": sliding families (rails) and fixed next to fixed.
 */
export type JointKind = "none" | "fixedMullion" | "movableMullion";

type LeafLike = { type: SashKind; active?: boolean; main?: boolean };

const effectiveType = (s: LeafLike): SashKind => (s.active === false ? "fix" : s.type);
const isSlidingFamily = (t: SashKind) => t === "sliding" || t === "liftslide";

export function jointBetween(a: SashKind, b: SashKind): JointKind {
  if (isSlidingFamily(a) || isSlidingFamily(b)) return "none";
  if (a === "fix" && b === "fix") return "none";
  if (a === "fix" || b === "fix") return "fixedMullion";
  if (a === "tilt" || b === "tilt") return "fixedMullion";
  if (a === "tiltturn" && b === "tiltturn") return "fixedMullion";
  return "movableMullion";
}

export interface Joint {
  /** The joint sits between leaf `index` and leaf `index + 1`. */
  index: number;
  kind: JointKind;
  /** Movable mullion only: the leaf that carries it (no handle). */
  inactive?: number;
  /** Movable mullion only: the leaf that carries the handle. */
  active?: number;
}

/** Joints between all neighbouring leaves, with the active / inactive leaf of every movable pair. */
export function jointsFor(sashes: LeafLike[]): Joint[] {
  const inactive = new Set<number>();
  const out: Joint[] = [];
  for (let i = 0; i + 1 < sashes.length; i++) {
    const a = effectiveType(sashes[i]);
    const b = effectiveType(sashes[i + 1]);
    const kind = jointBetween(a, b);
    if (kind !== "movableMullion") {
      out.push({ index: i, kind });
      continue;
    }
    let active = i;
    if (a === b) {
      // Two casements: the principale one keeps the handle, otherwise the left one (unless it already lost it).
      if (sashes[i + 1].main && !sashes[i].main) active = i + 1;
      else if (!sashes[i].main && inactive.has(i)) active = i + 1;
    } else {
      active = a === "tiltturn" ? i : i + 1;
    }
    const other = active === i ? i + 1 : i;
    inactive.add(other);
    out.push({ index: i, kind, active, inactive: other });
  }
  return out;
}

/** Leaves that carry no handle because a movable mullion sits on them. */
export function inactiveLeaves(sashes: LeafLike[]): Set<number> {
  return new Set(jointsFor(sashes).flatMap((j) => (j.inactive !== undefined ? [j.inactive] : [])));
}

/** A sliding frame with a fixed leaf: on the Aluplast series it becomes a lift-slide / tilt-slide system. */
export function slidingWithFixed(types: SashKind[]): boolean {
  return types.includes("fix") && types.some(isSlidingFamily);
}

/** What the technical rules say about one leaf, as a code the UI translates. */
export type LeafRule = "inactive" | "active" | "fixedMullion" | "slidingFixed";

export function leafRule(sashes: LeafLike[], index: number): LeafRule | null {
  const joints = jointsFor(sashes);
  if (joints.some((j) => j.inactive === index)) return "inactive";
  if (joints.some((j) => j.active === index)) return "active";
  if (joints.some((j) => j.kind === "fixedMullion" && (j.index === index || j.index + 1 === index))) return "fixedMullion";
  const types = sashes.map(effectiveType);
  if (slidingWithFixed(types) && (types[index] === "fix" || isSlidingFamily(types[index]))) return "slidingFixed";
  return null;
}

/** Rules that apply to the frame as a whole (each code once), shown under the drawing. */
export function frameRules(sashes: LeafLike[]): Array<"fixedMullion" | "movableMullion" | "slidingFixed"> {
  const kinds = new Set(jointsFor(sashes).map((j) => j.kind));
  const out: Array<"fixedMullion" | "movableMullion" | "slidingFixed"> = [];
  if (kinds.has("fixedMullion")) out.push("fixedMullion");
  if (kinds.has("movableMullion")) out.push("movableMullion");
  if (slidingWithFixed(sashes.map(effectiveType))) out.push("slidingFixed");
  return out;
}

/** Type for a leaf added to a frame: it follows the moving leaves already there. */
export function typeForAddedSash(existing: SashKind[]): SashKind {
  const moving = existing.find((t) => t !== "fix");
  return moving === "sliding" || moving === "liftslide" ? moving : "tiltturn";
}

type Side = "left" | "right";

/** Leaf types that have a left/right opening to pick. Tilt-only (vasistas) and fixed leaves have none. */
export function hasOpeningDirection(type: string): boolean {
  return type === "classic" || type === "tiltturn" || type === "sliding" || type === "liftslide";
}

/**
 * The opening named in the UI and on paper: "Right" = the leaf opens FROM the right TO the left
 * (it starts on the right side), "Left" = from left to right. Hinged leaves store the hinge side,
 * which is the starting side already. Sliding leaves store the side the arrow points to, so their
 * starting side is the opposite one. The stored value never changes (saved quotes keep drawing
 * exactly as before); this is only how it is named and picked.
 */
export function openingSide(type: string, direction: Side): Side {
  if (type === "sliding" || type === "liftslide") return direction === "left" ? "right" : "left";
  return direction;
}

/** Inverse of `openingSide` (the mapping is its own inverse): stored direction for a picked opening. */
export function directionFromOpening(type: string, side: Side): Side {
  return openingSide(type, side);
}

/** Stored direction after a type change that keeps the picked opening (e.g. classic "Right" -> sliding "Right"). */
export function directionOnRetype(prevType: string, prevDirection: Side, nextType: string): Side {
  return directionFromOpening(nextType, openingSide(prevType, prevDirection));
}

export interface SashViolation {
  sashIndex: number;
  axis: "width" | "height";
  got: number;
  min: number;
  type: SashKind;
}

/** Every sash whose clear width or the item height is below its type minimum. */
export function violationsFor(item: SashHostItem): SashViolation[] {
  const ratios = normalizedRatios(item.sashes);
  const out: SashViolation[] = [];
  item.sashes.forEach((s, i) => {
    if (!s.active) return;
    const min = SASH_MIN[s.type];
    const clearW = Math.round(item.width * ratios[i]);
    if (clearW < min.w) {
      out.push({ sashIndex: i, axis: "width", got: clearW, min: min.w, type: s.type });
    }
    if (item.height < min.h) {
      out.push({ sashIndex: i, axis: "height", got: item.height, min: min.h, type: s.type });
    }
  });
  return out;
}

/** The smallest frame width that fits the current active sashes, mm. */
export function minFrameWidth(sashes: EditorSash[]): number {
  return sashes
    .filter((s) => s.active)
    .reduce((sum, s) => sum + SASH_MIN[s.type].w, 0);
}

/** The smallest frame height that fits the current active sashes, mm. */
export function minFrameHeight(sashes: EditorSash[]): number {
  const active = sashes.filter((s) => s.active);
  if (active.length === 0) return 0;
  return Math.max(...active.map((s) => SASH_MIN[s.type].h));
}

export const SASH_KIND_LABEL: Record<SashKind, string> = {
  fix: "Fissa",
  classic: "Battente",
  tiltturn: "Anta-ribalta",
  tilt: "Vasistas",
  sliding: "Scorrevole",
  liftslide: "Alzante scorrevole",
};

export const SECURITY_LABEL: Record<SecurityClass, string> = {
  standard: "Standard",
  rc2: "RC2 (antieffrazione)",
  rc3: "RC3 (alta sicurezza)",
};
