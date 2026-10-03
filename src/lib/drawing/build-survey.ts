import { drawingLocale, SURVEY } from "./drawing-text";
import { PALETTE } from "./finishes";
import { boundsOf, hatchSegments, line, place, rect, text } from "./prims";
import type { Primitive, Scene } from "./types";

export interface SurveySheetInput {
  label: string;
  widthMm: number;
  heightMm: number;
  room?: string;
  floor?: string;
}

/** Length of the theoretical diagonal of a rectangular opening, mm, rounded. */
export function theoreticalDiagonalMm(widthMm: number, heightMm: number): number {
  return Math.round(Math.hypot(Math.max(0, widthMm), Math.max(0, heightMm)));
}

const FIT_W = 230;
const FIT_H = 200;
const WALL = 28;
const PAD = 12;

/**
 * Survey sheet of one opening: the hole in the wall with its size, the two diagonals (theoretical length to check
 * squareness) and three measuring points per axis to fill in on site. Not to scale in its details.
 */
export function buildSurveySheetScene(input: SurveySheetInput, localeInput?: string): Scene {
  const words = SURVEY[drawingLocale(localeInput)];
  const W = Math.max(100, input.widthMm);
  const H = Math.max(100, input.heightMm);
  const k = Math.min(FIT_W / W, FIT_H / H);
  const w = W * k;
  const h = H * k;
  const out: Primitive[] = [];
  const ink = PALETTE.ink;

  // Wall around the hole, hatched; the hole itself stays white.
  const wall = { fill: "#E5E7EB", stroke: PALETTE.outline, strokeWidth: 0.9 };
  out.push(rect({ role: "frameOuter", part: "wall" }, -WALL, -WALL, w + 2 * WALL, h + 2 * WALL, wall));
  for (const [a, b, c, d] of hatchSegments(-WALL, -WALL, w + 2 * WALL, h + 2 * WALL, 9)) out.push(line({ role: "hatch", part: "wall" }, a, b, c, d, { stroke: PALETTE.hatch, strokeWidth: 0.7, opacity: 0.5 }));
  out.push(rect({ role: "frame", part: "hole" }, 0, 0, w, h, { fill: "#FFFFFF", stroke: PALETTE.outline, strokeWidth: 1.4 }));

  // Diagonals.
  const diag = theoreticalDiagonalMm(W, H);
  out.push(
    line({ role: "handleGuide", part: "diagonal" }, 0, 0, w, h, { stroke: PALETTE.guide, strokeWidth: 0.9, dash: "4 3" }),
    line({ role: "handleGuide", part: "diagonal" }, w, 0, 0, h, { stroke: PALETTE.guide, strokeWidth: 0.9, dash: "4 3" }),
  );
  const mid = { x: w / 2, y: h / 2 };
  out.push(text({ role: "dimension", part: "diagonal" }, mid.x, mid.y + 3, `${diag}`, { fontSize: 8, fill: PALETTE.guide, weight: "bold", anchor: "middle" }));

  // Three measuring points per axis: tick marks with a letter to write the value next to.
  const ticks = [0.15, 0.5, 0.85];
  ticks.forEach((t, i) => {
    const y = h * t;
    const x = w * t;
    out.push(
      line({ role: "dimension", part: "widthPoint" }, -4, y, w + 4, y, { stroke: PALETTE.dimLine, strokeWidth: 0.6, dash: "1.5 2.5" }),
      text({ role: "dimension", part: "widthPoint" }, w + 8, y + 2.5, `L${i + 1}`, { fontSize: 7, fill: ink, anchor: "start", weight: "bold" }),
      line({ role: "dimension", part: "heightPoint" }, x, -4, x, h + 4, { stroke: PALETTE.dimLine, strokeWidth: 0.6, dash: "1.5 2.5" }),
      text({ role: "dimension", part: "heightPoint" }, x, h + 14, `H${i + 1}`, { fontSize: 7, fill: ink, weight: "bold" }),
    );
  });

  // Overall dimension lines (outside the wall band).
  const dimY = h + WALL + 10;
  out.push(
    line({ role: "dimension", part: "width" }, 0, dimY, w, dimY, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    line({ role: "dimension", part: "width" }, 0, dimY - 3, 0, dimY + 3, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    line({ role: "dimension", part: "width" }, w, dimY - 3, w, dimY + 3, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    text({ role: "dimension", part: "width" }, w / 2, dimY + 12, `${Math.round(input.widthMm)} mm`, { fontSize: 9, fill: PALETTE.dim, weight: "bold" }),
  );
  const dimX = -WALL - 10;
  out.push(
    line({ role: "dimension", part: "height" }, dimX, 0, dimX, h, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    line({ role: "dimension", part: "height" }, dimX - 3, 0, dimX + 3, 0, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    line({ role: "dimension", part: "height" }, dimX - 3, h, dimX + 3, h, { stroke: PALETTE.dim, strokeWidth: 0.9 }),
    text({ role: "dimension", part: "height" }, dimX - 6, h / 2, `${Math.round(input.heightMm)} mm`, { fontSize: 9, fill: PALETTE.dim, weight: "bold", rotate: -90 }),
  );

  const body = boundsOf(out);
  const x0 = body.minX;
  let y = body.maxY + 16;
  const lines: string[] = [
    `${words.diagonal}: ${diag} mm`,
    words.widthPoints,
    words.heightPoints,
    words.squareHint,
  ];
  lines.forEach((l, i) => {
    out.push(text({ role: "dimension", part: "key" }, x0, y, l, { fontSize: 8, fill: i === 0 ? PALETTE.guide : ink, anchor: "start", weight: i === 0 ? "bold" : "normal" }));
    y += 12;
  });
  out.push(text({ role: "dimension", part: "note" }, x0, y + 4, words.note, { fontSize: 6.6, fill: PALETTE.dimLine, anchor: "start" }));
  const head = [input.label, [input.room && `${words.room}: ${input.room}`, input.floor && `${words.floor}: ${input.floor}`].filter(Boolean).join(" · ")].filter(Boolean).join("  —  ");
  out.push(text({ role: "dimension", part: "title" }, x0, body.minY - 8, head ? `${words.title}  ·  ${head}` : words.title, { fontSize: 9, fill: ink, anchor: "start", weight: "bold" }));

  const b = boundsOf(out);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const vw = r3(b.maxX - b.minX + 2 * PAD);
  const vh = r3(b.maxY - b.minY + 2 * PAD);
  const box = { x: 0, y: 0, w: vw, h: vh };
  return {
    viewBox: { w: vw, h: vh },
    primitives: out.map((p) => place(p, dx, dy)),
    meta: { scale: k, widthMm: W, heightMm: H, frame: box, inner: box, sashInset: 0, cells: [], ratios: [], dividers: [], sashTypes: [] },
  };
}
