import { drawingLocale, LEGEND, TITLES, type LegendKey } from "./drawing-text";
import { hardwareFill, PALETTE } from "./finishes";
import { handleShapes } from "./handle-shapes";
import { line, poly, rect, text, type Tag } from "./prims";
import type { Primitive, Scene } from "./types";

const ROW_H = 30;
const ICON_W = 44;
const PAD = 8;
const WIDTH = 270;
const TITLE_H = 18;

type Draw = (tag: Tag) => Primitive[];

const SYMBOL = { stroke: PALETTE.ink, strokeWidth: 1.1 };
const LEAF = { stroke: PALETTE.outline, strokeWidth: 0.9, fill: PALETTE.glass };

/** The small leaf outline every icon sits in (x 0..38, y 0..24). */
const leaf = (tag: Tag): Primitive => rect(tag, 0, 0, 38, 24, LEAF);

const ICONS: Record<LegendKey, Draw> = {
  casement: (tag) => [
    leaf(tag),
    line(tag, 0, 0, 38, 12, SYMBOL),
    line(tag, 0, 24, 38, 12, SYMBOL),
    rect(tag, -2, 3, 4, 7, { fill: PALETTE.hinge, radius: 0.8 }),
    rect(tag, -2, 14, 4, 7, { fill: PALETTE.hinge, radius: 0.8 }),
  ],
  tilt: (tag) => [leaf(tag), line(tag, 0, 24, 19, 0, SYMBOL), line(tag, 38, 24, 19, 0, SYMBOL)],
  sliding: (tag) => [
    leaf(tag),
    line(tag, 6, 12, 32, 12, { stroke: PALETTE.ink, strokeWidth: 1.4 }),
    poly(tag, [[32, 12], [26, 8], [26, 16]], { fill: PALETTE.ink }),
  ],
  liftslide: (tag) => [
    leaf(tag),
    line(tag, 6, 14, 32, 14, { stroke: PALETTE.ink, strokeWidth: 1.4 }),
    poly(tag, [[32, 14], [26, 10], [26, 18]], { fill: PALETTE.ink }),
    poly(tag, [[19, 2], [15, 8], [23, 8]], { fill: PALETTE.ink }),
  ],
  handle: (tag) => [
    rect(tag, 0, 0, 38, 30, { stroke: "none", fill: "none" }),
    ...handleShapes(tag, { kind: "lever", cx: 19, cy: 6, inward: 1, stile: 4, fill: hardwareFill("silver") }),
  ],
  hinge: (tag) => [rect(tag, 12, 3, 4, 10, { fill: PALETTE.hinge, radius: 0.8 }), rect(tag, 12, 15, 4, 10, { fill: PALETTE.hinge, radius: 0.8 })],
  guide: (tag) => [
    line(tag, 4, 12, 34, 12, { stroke: PALETTE.guide, strokeWidth: 1.1, dash: "4 3" }),
    line(tag, 0, 12, 8, 12, { stroke: PALETTE.guide, strokeWidth: 1.1 }),
  ],
};

const ORDER: LegendKey[] = ["casement", "tilt", "sliding", "liftslide", "handle", "hinge", "guide"];

/** The symbol legend as a scene: one row per symbol, icon on the left, text on the right. */
export function buildLegendScene(localeInput?: string): Scene {
  const locale = drawingLocale(localeInput);
  const words = LEGEND[locale];
  const out: Primitive[] = [];
  out.push(text({ role: "dimension" }, PAD, 12, TITLES[locale].legend, { fontSize: 9, fill: PALETTE.ink, anchor: "start", weight: "bold" }));
  ORDER.forEach((key, i) => {
    const y = TITLE_H + i * ROW_H;
    const tag: Tag = { role: "opening", part: `legend-${key}` };
    for (const p of ICONS[key](tag)) out.push(shift(p, PAD + 4, y + 3));
    const lines = words[key];
    const first = y + (lines.length === 1 ? 15 : 11);
    lines.forEach((l, k) => out.push(text(tag, PAD + ICON_W + 8, first + k * 9, l, { fontSize: 7.5, fill: PALETTE.ink, anchor: "start" })));
  });
  const h = TITLE_H + ORDER.length * ROW_H + PAD;
  return {
    viewBox: { w: WIDTH, h },
    primitives: out,
    meta: {
      scale: 1,
      widthMm: 0,
      heightMm: 0,
      frame: { x: 0, y: 0, w: WIDTH, h },
      inner: { x: 0, y: 0, w: WIDTH, h },
      sashInset: 0,
      cells: [],
      ratios: [],
      dividers: [],
      sashTypes: [],
    },
  };
}

function shift(p: Primitive, dx: number, dy: number): Primitive {
  switch (p.type) {
    case "rect":
      return { ...p, x: p.x + dx, y: p.y + dy };
    case "line":
      return { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy };
    case "polygon":
    case "polyline":
      return { ...p, points: p.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    case "circle":
      return { ...p, cx: p.cx + dx, cy: p.cy + dy };
    case "text":
      return { ...p, x: p.x + dx, y: p.y + dy };
  }
}
