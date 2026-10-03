import { normalizedRatios, type EditorSash } from "@/shared/sash-rules";
import { drawingLocale, PLAN } from "./drawing-text";
import { PALETTE } from "./finishes";
import { arcPoints, boundsOf, hatchSegments, line, place, poly, polyline, rect, text } from "./prims";
import type { DrawingInput, DrawingSash, Primitive, Scene } from "./types";

// Indicative construction depths, mm. The plan is a schematic of how the leaves move, not a joinery detail.
const WALL_T = 300;
const WALL_EXT = 260;
const FRAME_W = 45;
const FRAME_T = 70;
const FRAME_Y = 150;
const SASH_T = 60;
const SASH_Y = FRAME_Y + 5;
const TRACK_T = 30;
const FIT_W = 300;
const FIT_H = 250;
const MAX_SCALE = 0.34;
const PAD = 10;

const isHinged = (s: DrawingSash) => s.type === "classic" || s.type === "tiltturn";
const isSliding = (s: DrawingSash) => s.type === "sliding" || s.type === "liftslide";

export interface PlanLeaf {
  index: number;
  /** Cell between the frame jambs, mm from the left edge of the opening. */
  x0: number;
  x1: number;
  widthMm: number;
}

/** The leaf cells of the opening in mm, between the two frame jambs. */
export function planLeaves(input: DrawingInput): PlanLeaf[] {
  const ratios = normalizedRatios(input.sashes as unknown as EditorSash[]);
  const inner = input.widthMm - 2 * FRAME_W;
  const leaves: PlanLeaf[] = [];
  let x = FRAME_W;
  ratios.forEach((r, i) => {
    const w = i === ratios.length - 1 ? input.widthMm - FRAME_W - x : r * inner;
    leaves.push({ index: i, x0: x, x1: x + w, widthMm: Math.round(w) });
    x += w;
  });
  return leaves;
}

/** Depth the open hinged leaves reach into the room (the widest hinged leaf), or 0 when none opens inwards. */
export function swingClearanceMm(input: DrawingInput): number {
  const leaves = planLeaves(input);
  return input.sashes.reduce((max, s, i) => (s.active && isHinged(s) ? Math.max(max, leaves[i].widthMm) : max), 0);
}

/**
 * Plan view (horizontal section seen from above): the wall, the frame, each leaf closed and, for hinged leaves,
 * open with its swing arc and the room it needs; for sliding leaves the track and the travel. Outside is on top,
 * inside at the bottom, so "left" and "right" read as they do when standing inside.
 */
export function buildPlanScene(input: DrawingInput, localeInput?: string): Scene {
  const words = PLAN[drawingLocale(localeInput)];
  const W = Math.max(100, input.widthMm);
  const clearance = swingClearanceMm(input);
  const depth = WALL_T + clearance + 80;
  const scale = Math.min(MAX_SCALE, FIT_W / (W + 2 * WALL_EXT), FIT_H / depth);
  const u = (mm: number) => mm * scale;
  const out: Primitive[] = [];
  const leaves = planLeaves(input);

  // Wall sections, hatched.
  const wallStyle = { fill: "#E5E7EB", stroke: PALETTE.outline, strokeWidth: 0.9 };
  for (const [x0, x1] of [[-WALL_EXT, 0], [W, W + WALL_EXT]] as const) {
    const tag = { role: "frameOuter" as const, part: "wall" };
    out.push(rect(tag, u(x0), 0, u(x1 - x0), u(WALL_T), wallStyle));
    for (const [a, b, c, d] of hatchSegments(u(x0), 0, u(x1 - x0), u(WALL_T), 9)) {
      out.push(line({ role: "hatch" as const, part: "wall" }, a, b, c, d, { stroke: PALETTE.hatch, strokeWidth: 0.7, opacity: 0.55 }));
    }
  }

  // Frame jambs.
  for (const x0 of [0, W - FRAME_W]) {
    out.push(rect({ role: "frame" as const, part: "jamb" }, u(x0), u(FRAME_Y), u(FRAME_W), u(FRAME_T), { fill: "#FFFFFF", stroke: PALETTE.outline, strokeWidth: 1 }));
  }

  const guide = { stroke: PALETTE.guide, strokeWidth: 1, dash: "4 3" };

  input.sashes.forEach((s, i) => {
    const leaf = leaves[i];
    const tag = { role: "sashOutline" as const, sashIndex: i };
    if (isSliding(s)) {
      const track = i % 2;
      const y0 = track === 0 ? FRAME_Y + 2 : FRAME_Y + FRAME_T - TRACK_T - 2;
      out.push(rect(tag, u(leaf.x0), u(y0), u(leaf.x1 - leaf.x0), u(TRACK_T), { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 1 }));
      if (!s.active) return;
      const sign = s.direction === "left" ? -1 : 1;
      const room = sign > 0 ? W - FRAME_W - leaf.x1 : leaf.x0 - FRAME_W;
      const delta = sign * Math.max(0, Math.min(leaf.widthMm, room));
      if (Math.abs(delta) > 40) {
        out.push(rect({ role: "opening" as const, sashIndex: i, part: "ghost" }, u(leaf.x0 + delta), u(y0), u(leaf.x1 - leaf.x0), u(TRACK_T), { stroke: PALETTE.guide, strokeWidth: 1, dash: "4 3" }));
        const cy = u(y0 + TRACK_T / 2);
        const x1 = u((leaf.x0 + leaf.x1) / 2);
        const x2 = x1 + u(delta);
        const head = sign * 7;
        out.push(
          line({ role: "opening" as const, sashIndex: i, part: "slideArrow" }, x1, cy, x2, cy, { stroke: PALETTE.guide, strokeWidth: 1.5 }),
          poly({ role: "opening" as const, sashIndex: i, part: "slideArrow" }, [[x2, cy], [x2 - head, cy - 3.5], [x2 - head, cy + 3.5]], { fill: PALETTE.guide }),
        );
      }
      return;
    }

    // Hinged or fixed leaf, closed position.
    out.push(rect(tag, u(leaf.x0), u(SASH_Y), u(leaf.x1 - leaf.x0), u(SASH_T), { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 1 }));
    out.push(line({ role: "glass" as const, sashIndex: i }, u(leaf.x0 + 25), u(SASH_Y + SASH_T / 2), u(leaf.x1 - 25), u(SASH_Y + SASH_T / 2), { stroke: PALETTE.ink, strokeWidth: 0.7 }));
    if (!isHinged(s) || !s.active) return;

    const hingeLeft = s.direction === "left";
    const hx = hingeLeft ? leaf.x0 : leaf.x1;
    const hy = SASH_Y + SASH_T;
    const r = leaf.x1 - leaf.x0;
    // Open leaf: a plate standing in the room from the hinge, as thick as the sash.
    const x0 = hingeLeft ? hx : hx - SASH_T;
    out.push(
      rect({ role: "opening" as const, sashIndex: i, part: "openLeaf" }, u(x0), u(hy), u(SASH_T), u(r), { fill: "#FFFFFF", stroke: PALETTE.ink, strokeWidth: 1 }),
      polyline({ role: "opening" as const, sashIndex: i, part: "swing" }, arcPoints(u(hx), u(hy), u(r), hingeLeft ? 0 : Math.PI, Math.PI / 2).map(([x, y]) => [x, y] as [number, number]), guide),
      rect({ role: "hinge" as const, sashIndex: i }, u(hx) - 2, u(hy) - 4, 4, 8, { fill: PALETTE.hinge, radius: 0.8 }),
    );
    // Reach of the open leaf.
    const mid = Math.PI / 4;
    const lx = u(hx) + (hingeLeft ? 1 : -1) * u(r) * Math.cos(mid) * 0.78;
    const ly = u(hy) + u(r) * Math.sin(mid) * 0.78;
    out.push(text({ role: "dimension" as const, sashIndex: i, part: "swing" }, lx, ly, `${leaf.widthMm}`, { fontSize: 8, fill: PALETTE.guide, weight: "bold", anchor: "middle" }));
  });

  // Overall width above the wall (outside), room labels, and the room the open leaves need.
  const dimY = -16;
  out.push(
    line({ role: "dimension" as const, part: "width" }, u(0), dimY, u(W), dimY, { stroke: PALETTE.dimLine, strokeWidth: 0.8 }),
    line({ role: "dimension" as const, part: "width" }, u(0), dimY - 4, u(0), dimY + 4, { stroke: PALETTE.dimLine, strokeWidth: 0.8 }),
    line({ role: "dimension" as const, part: "width" }, u(W), dimY - 4, u(W), dimY + 4, { stroke: PALETTE.dimLine, strokeWidth: 0.8 }),
    text({ role: "dimension" as const, part: "width" }, u(W / 2), dimY - 6, `${W} mm`, { fontSize: 10, fill: PALETTE.dim, weight: "bold" }),
    // Room names sit beside the wall (not on it), outside at the top and inside at the bottom.
    text({ role: "dimension" as const, part: "exterior" }, u(-WALL_EXT) - 6, u(WALL_T * 0.28), words.exterior, { fontSize: 7, fill: PALETTE.dimLine, anchor: "end", weight: "bold" }),
    text({ role: "dimension" as const, part: "interior" }, u(-WALL_EXT) - 6, u(WALL_T * 0.9), words.interior, { fontSize: 7, fill: PALETTE.dimLine, anchor: "end", weight: "bold" }),
  );
  if (clearance > 0) {
    out.push(
      text({ role: "dimension" as const, part: "clearance" }, u(W / 2), u(WALL_T + clearance) + 22, words.clearance.replace("{mm}", String(clearance)), { fontSize: 8.5, fill: PALETTE.guide, weight: "bold" }),
    );
  }

  const b = boundsOf(out);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const w = r3(b.maxX - b.minX + 2 * PAD);
  const h = r3(b.maxY - b.minY + 2 * PAD);
  const frame = { x: r3(dx), y: r3(dy + u(FRAME_Y)), w: r3(u(W)), h: r3(u(FRAME_T)) };
  return {
    viewBox: { w, h },
    primitives: out.map((p) => place(p, dx, dy)),
    meta: {
      scale,
      widthMm: W,
      heightMm: 0,
      frame,
      inner: frame,
      sashInset: 0,
      cells: [],
      ratios: [],
      dividers: [],
      sashTypes: input.sashes.map((s) => s.type),
    },
  };
}
