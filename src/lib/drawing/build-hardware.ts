import { drawingLocale, HARDWARE, type HardwareWord } from "./drawing-text";
import { PALETTE } from "./finishes";
import { buildScene } from "./build-scene";
import { boundsOf, circle, line, place, polyline, rect, text } from "./prims";
import type { DrawingInput, DrawingSash, Primitive, Scene } from "./types";

const PAD = 10;
const isHinged = (s: DrawingSash) => s.type === "classic" || s.type === "tiltturn";

/** Hinges per leaf: two on a normal leaf, three once it is tall or heavy. */
export function hingeCount(leafHeightMm: number): 2 | 3 {
  return leafHeightMm > 1600 ? 3 : 2;
}

/** Locking points along the handle stile, growing with the leaf height. */
export function lockCount(leafHeightMm: number): number {
  if (leafHeightMm <= 800) return 1;
  if (leafHeightMm <= 1300) return 2;
  if (leafHeightMm <= 1900) return 3;
  if (leafHeightMm <= 2300) return 4;
  return 5;
}

const HARDWARE_ROLE = { role: "hinge" as const, part: "hardware" };

/**
 * Hardware layout: the elevation (no dimensions) with the hinges, locking points, tilt stays, carriages and
 * lifting mechanisms marked on every leaf, plus a key. Positions are indicative.
 */
export function buildHardwareScene(input: DrawingInput, localeInput?: string): Scene {
  const words = HARDWARE[drawingLocale(localeInput)];
  const base = buildScene(input, { showDimensions: false, showMainBadge: false, handleGuide: "none" });
  const { cells, scale } = base.meta;
  const out: Primitive[] = base.primitives.filter((p) => p.role !== "hit" && p.role !== "hinge" && p.role !== "badge" && p.role !== "selection");
  const ink = PALETTE.outline;
  const used = new Set<HardwareWord>();
  const inset = Math.max(2.5, base.meta.sashInset);
  const heightMm = base.meta.heightMm;

  cells.forEach((c) => {
    const s = input.sashes[c.sashIndex];
    if (!s || s.type === "fix") return;
    const x0 = c.x + inset;
    const x1 = c.x + c.w - inset;
    const y0 = c.y + inset;
    const y1 = c.y + c.h - inset;
    const leafMm = Math.max(1, (y1 - y0) / scale);
    const hingeRight = s.direction === "right";
    const along = (n: number, a: number, b: number, i: number) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1));

    const rod = (x: number) => out.push(line({ role: "hinge", part: "rod", sashIndex: c.sashIndex }, x, y0 + 8, x, y1 - 8, { stroke: PALETTE.guide, strokeWidth: 0.8, dash: "2 2", opacity: 0.7 }));

    if (isHinged(s)) {
      const hx = hingeRight ? x1 : x0;
      const lx = hingeRight ? x0 : x1;
      const n = hingeCount(leafMm);
      for (let i = 0; i < n; i++) {
        const y = along(n, y0 + 14, y1 - 14, i);
        out.push(rect({ ...HARDWARE_ROLE, sashIndex: c.sashIndex }, hx - 2.5, y - 5, 5, 10, { fill: ink, stroke: ink, strokeWidth: 0.6, radius: 1 }));
      }
      used.add("hinge");
      rod(lx);
      const locks = lockCount(leafMm);
      for (let i = 0; i < locks; i++) {
        const y = along(locks, y0 + 12, y1 - 12, i);
        out.push(circle({ role: "hinge", part: "lock", sashIndex: c.sashIndex }, lx, y, 3.2, { fill: "#F59E0B", stroke: ink, strokeWidth: 0.7 }));
      }
      used.add("lock");
      if (s.type === "tiltturn") {
        const mx = (x0 + x1) / 2;
        out.push(polyline({ role: "hinge", part: "stay", sashIndex: c.sashIndex }, [[x0 + 10, y0 + 7], [mx, y0 + 16], [x1 - 10, y0 + 7]], { stroke: ink, strokeWidth: 1.4 }));
        used.add("stay");
      }
    } else if (s.type === "tilt") {
      const n = 2;
      for (let i = 0; i < n; i++) {
        const x = along(n, x0 + 14, x1 - 14, i);
        out.push(rect({ ...HARDWARE_ROLE, sashIndex: c.sashIndex }, x - 5, y1 - 2.5, 10, 5, { fill: ink, stroke: ink, strokeWidth: 0.6, radius: 1 }));
      }
      used.add("hinge");
      const mx = (x0 + x1) / 2;
      out.push(circle({ role: "hinge", part: "lock", sashIndex: c.sashIndex }, mx, y0 + 4, 3.2, { fill: "#F59E0B", stroke: ink, strokeWidth: 0.7 }));
      used.add("lock");
    } else {
      // Sliding / lift-slide: carriages at the bottom corners, one lock on the meeting stile.
      for (const x of [x0 + 10, x1 - 10]) {
        out.push(circle({ role: "hinge", part: "roller", sashIndex: c.sashIndex }, x, y1 - 4, 3.4, { fill: "#FFFFFF", stroke: ink, strokeWidth: 1.2 }));
      }
      used.add("roller");
      const lx = s.direction === "right" ? x1 : x0;
      const locks = Math.min(3, lockCount(leafMm));
      for (let i = 0; i < locks; i++) {
        out.push(circle({ role: "hinge", part: "lock", sashIndex: c.sashIndex }, lx, along(locks, y0 + 14, y1 - 14, i), 3.2, { fill: "#F59E0B", stroke: ink, strokeWidth: 0.7 }));
      }
      used.add("lock");
      if (s.type === "liftslide") {
        const mx = (x0 + x1) / 2;
        out.push(rect({ role: "hinge", part: "lift", sashIndex: c.sashIndex }, mx - 14, y1 - 9, 28, 5, { fill: PALETTE.guide, stroke: ink, strokeWidth: 0.6, radius: 1 }));
        used.add("lift");
      }
    }
  });
  if (used.size === 0) used.add("none");
  void heightMm;

  const b0 = boundsOf(out);
  const keyOrder: HardwareWord[] = ["hinge", "lock", "stay", "roller", "lift", "none"];
  const rows = keyOrder.filter((k) => used.has(k));
  let y = b0.maxY + 16;
  const x = b0.minX;
  rows.forEach((k) => {
    if (k === "hinge") out.push(rect({ ...HARDWARE_ROLE }, x, y - 6, 5, 9, { fill: ink, stroke: ink, strokeWidth: 0.6, radius: 1 }));
    else if (k === "lock") out.push(circle({ role: "hinge", part: "lock" }, x + 2.5, y - 1.5, 3.2, { fill: "#F59E0B", stroke: ink, strokeWidth: 0.7 }));
    else if (k === "stay") out.push(polyline({ role: "hinge", part: "stay" }, [[x - 2, y - 4], [x + 3, y], [x + 8, y - 4]], { stroke: ink, strokeWidth: 1.4 }));
    else if (k === "roller") out.push(circle({ role: "hinge", part: "roller" }, x + 2.5, y - 1.5, 3.4, { fill: "#FFFFFF", stroke: ink, strokeWidth: 1.2 }));
    else if (k === "lift") out.push(rect({ role: "hinge", part: "lift" }, x - 3, y - 4, 14, 5, { fill: PALETTE.guide, stroke: ink, strokeWidth: 0.6, radius: 1 }));
    out.push(text({ role: "dimension", part: "key" }, x + 16, y, words[k], { fontSize: 8, fill: PALETTE.ink, anchor: "start" }));
    y += 13;
  });
  out.push(text({ role: "dimension", part: "note" }, x, y + 3, words.note, { fontSize: 6.8, fill: PALETTE.dimLine, anchor: "start" }));

  const b = boundsOf(out);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    viewBox: { w: r3(b.maxX - b.minX + 2 * PAD), h: r3(b.maxY - b.minY + 2 * PAD) },
    primitives: out.map((p) => place(p, dx, dy)),
    meta: { ...base.meta, handles: [], dimensions: {}, cells: cells.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })), dividers: base.meta.dividers.map((d) => d + dx) },
  };
}
