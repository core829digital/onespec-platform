import { handleRange } from "@/shared/configurator-model";
import type { SceneMeta } from "./types";

/** Handle axis heights (mm from the floor) people expect to find: the usual 1000 and 1050 mm, and the leaf mid-height. */
export const STANDARD_HANDLE_HEIGHTS_MM = [1000, 1050] as const;

/** A drag within this many mm of a standard height lands exactly on it. */
const SNAP_MM = 15;

export interface SnappedHeight {
  mm: number;
  /** The standard height it snapped to, or null when it is a free value. */
  snappedTo: number | null;
  /** "mid" when the snap target is the middle of the leaf. */
  label: "standard" | "mid" | null;
}

/**
 * Turn a dragged handle height into a valid one: inside the allowed range, a multiple of 10 mm, and snapped
 * to a standard height when close to it.
 */
export function snapHandleHeight(rawMm: number, itemHeightMm: number): SnappedHeight {
  const { min, max, step } = handleRange(itemHeightMm);
  const clamped = Math.min(max, Math.max(min, Number.isFinite(rawMm) ? rawMm : min));
  const rounded = Math.min(max, Math.max(min, Math.round(clamped / step) * step));
  const mid = Math.round(itemHeightMm / 2 / step) * step;
  const targets: Array<{ mm: number; label: "standard" | "mid" }> = [
    ...STANDARD_HANDLE_HEIGHTS_MM.map((mm) => ({ mm: mm as number, label: "standard" as const })),
    { mm: mid, label: "mid" as const },
  ].filter((t) => t.mm >= min && t.mm <= max);
  let best: { mm: number; label: "standard" | "mid" } | null = null;
  for (const t of targets) {
    if (Math.abs(clamped - t.mm) <= SNAP_MM && (!best || Math.abs(clamped - t.mm) < Math.abs(clamped - best.mm))) best = t;
  }
  return best ? { mm: best.mm, snappedTo: best.mm, label: best.label } : { mm: rounded, snappedTo: null, label: null };
}

/** Handle height in mm for a handle axis at drawing-unit `y`. */
export function handleMmFromY(meta: Pick<SceneMeta, "frame" | "scale">, y: number): number {
  return (meta.frame.y + meta.frame.h - y) / meta.scale;
}

/** Drawing-unit y of a handle axis at `mm` from the floor. */
export function yFromHandleMm(meta: Pick<SceneMeta, "frame" | "scale">, mm: number): number {
  return meta.frame.y + meta.frame.h - mm * meta.scale;
}
