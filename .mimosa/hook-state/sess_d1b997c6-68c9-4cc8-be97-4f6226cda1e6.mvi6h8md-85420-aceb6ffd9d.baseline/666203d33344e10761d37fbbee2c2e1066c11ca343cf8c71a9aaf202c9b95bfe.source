import { PALETTE } from "./finishes";
import { circle, line, rect, type Tag } from "./prims";
import type { Primitive } from "./types";

/** Thickness of the plate of a handle on the top rail (vasistas). */
export const HANDLE_RAIL = 5;

/** How far a handle reaches above / below its axis (the plate centre), per kind — for clamping inside a leaf. */
export function handleExtent(kind: "lever" | "doorLever" | "pull" | "tilt"): { up: number; down: number } {
  if (kind === "lever") return { up: 6, down: 19 };
  if (kind === "pull") return { up: 10, down: 10 };
  return { up: 7, down: 7 };
}

export type HandleKind =
  /** Window lever: plate + pivot + lever hanging down (closed position). */
  | "lever"
  /** Door / lift-slide lever: plate + pivot + horizontal lever pointing towards the leaf centre. */
  | "doorLever"
  /** Sliding leaf: slim flush pull on the leading edge. */
  | "pull"
  /** Vasistas: horizontal plate on the top rail with the lever hanging down. */
  | "tilt";

export interface HandleSpec {
  kind: HandleKind;
  /** Centre of the plate, in drawing units. */
  cx: number;
  cy: number;
  /** +1 when the leaf centre is to the right of the stile, -1 when it is to the left (doorLever only). */
  inward: 1 | -1;
  /** Stile thickness available for the plate. */
  stile: number;
  /** Hardware finish (fill of plate and lever). */
  fill: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The technical handle symbol, front view from inside. The FIRST primitive is always the back plate
 * (its centre is the handle height), the next ones are the pivot and the lever. One geometry shared by
 * the platform drawings, the PDFs and the widget so a handle looks the same everywhere.
 */
export function handleShapes(tag: Tag, spec: HandleSpec): Primitive[] {
  const { kind, cx, cy, inward, stile, fill } = spec;
  const edge = { stroke: PALETTE.hinge, strokeWidth: 0.8 };
  const pw = clamp(stile * 1.4, 5, 8);
  const pivot = (x: number, y: number, r: number) =>
    circle({ ...tag, part: "pivot" }, x, y, r, { fill: PALETTE.hinge, stroke: "none", strokeWidth: 0 });

  if (kind === "tilt") {
    const plateW = 14;
    return [
      rect({ ...tag, part: "plate" }, cx - plateW / 2, cy - HANDLE_RAIL / 2, plateW, HANDLE_RAIL, { fill, ...edge, radius: 1.8 }),
      rect({ ...tag, part: "lever" }, cx - 1.8, cy, 3.6, 9, { fill, ...edge, radius: 1.8 }),
      pivot(cx, cy, 1.5),
    ];
  }

  if (kind === "pull") {
    const w = clamp(pw * 0.7, 3.5, 5.5);
    const h = 20;
    return [
      rect({ ...tag, part: "plate" }, cx - w / 2, cy - h / 2, w, h, { fill, ...edge, radius: 1.4 }),
      line({ ...tag, part: "grip" }, cx, cy - h / 2 + 4, cx, cy + h / 2 - 4, { stroke: PALETTE.hinge, strokeWidth: 0.9, round: true }),
    ];
  }

  // The plate is the short rosette plate on the stile: its centre is the handle axis (the handle height).
  const plateH = 12;
  const plate = rect({ ...tag, part: "plate" }, cx - pw / 2, cy - plateH / 2, pw, plateH, { fill, ...edge, radius: 2 });

  if (kind === "doorLever") {
    const len = 17;
    const lw = Math.min(pw * 0.7, 4);
    const x = inward > 0 ? cx - lw / 2 : cx + lw / 2 - len;
    return [plate, rect({ ...tag, part: "lever" }, x, cy - lw / 2, len, lw, { fill, ...edge, radius: lw / 2 }), pivot(cx, cy, 1.7)];
  }

  // Window lever in closed position: rosette plate on the stile, lever hanging down.
  const lw = Math.min(pw * 0.72, 4.4);
  return [plate, rect({ ...tag, part: "lever" }, cx - lw / 2, cy - 2, lw, 21, { fill, ...edge, radius: lw / 2 }), pivot(cx, cy, 1.7)];
}

/** Which symbol a leaf type uses. */
export function handleKindFor(type: string, door: boolean): HandleKind {
  if (type === "tilt") return "tilt";
  if (type === "sliding") return "pull";
  if (type === "liftslide") return "doorLever";
  return door ? "doorLever" : "lever";
}
