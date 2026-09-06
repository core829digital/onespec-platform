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
export function sashTypeAllowedWith(
  siblings: SashKind[],
  candidate: SashKind,
): { ok: boolean; reason?: string } {
  const others = siblings.filter(Boolean);
  const hasSliding = others.includes("sliding");
  const hasLiftSlide = others.includes("liftslide");
  const hasHinged = others.some((t) => t !== "sliding" && t !== "liftslide");

  if (candidate === "sliding") {
    if (hasHinged || hasLiftSlide) {
      return { ok: false, reason: "Lo scorrevole si combina solo con altri scorrevoli." };
    }
  } else if (candidate === "liftslide") {
    if (hasHinged || hasSliding) {
      return { ok: false, reason: "L'alzante scorrevole si combina solo con altri alzanti." };
    }
  } else {
    if (hasSliding) {
      return { ok: false, reason: "Non si può mischiare un'anta a battente con lo scorrevole." };
    }
    if (hasLiftSlide) {
      return { ok: false, reason: "Non si può mischiare un'anta a battente con l'alzante scorrevole." };
    }
  }
  return { ok: true };
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
