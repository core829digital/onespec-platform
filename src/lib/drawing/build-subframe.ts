import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { drawingLocale, SUBFRAME } from "./drawing-text";
import { PALETTE } from "./finishes";
import { boundsOf, circle, hatchSegments, line, place, poly, rect, text } from "./prims";
import type { Primitive, Scene } from "./types";

/**
 * Controtelaio (sub-frame) sheet, Italy: the sub-frame is set into the wall opening first and the window is fitted into it.
 * One sheet with the elevation (window, clear opening of the sub-frame, overall size, minimum masonry hole, anchor straps)
 * and a section on the reveal. The figures follow common practice and are indicative: the installer checks them on site.
 */
export const SUBFRAME_GAP_MM = 5;
export const SUBFRAME_FACE_MM = 35;
export const SUBFRAME_JOINT_MM = 10;
export const SUBFRAME_STRAP_SPACING_MM = 600;
export const SUBFRAME_STRAP_EDGE_MM = 150;
export const SUBFRAME_DEFAULT_DEPTH_MM = 70;
export const SUBFRAME_DEPTH_RANGE_MM = { min: 30, max: 200 } as const;

export interface SubframeInput {
  /** Nominal size of the window, mm. */
  widthMm: number;
  heightMm: number;
  /** Depth of the sub-frame profile in the wall, mm (default 70). */
  depthMm?: number;
  /** Name of the catalogue row, printed under the title. */
  label?: string;
}

export interface SubframeSizes {
  window: { w: number; h: number };
  /** Clear opening of the sub-frame: the window plus the play on every side. */
  clear: { w: number; h: number };
  /** Overall size of the sub-frame: the clear opening plus the visible profile on every side. */
  outer: { w: number; h: number };
  /** Minimum hole in the masonry: the overall size plus the joint on every side. */
  hole: { w: number; h: number };
  depthMm: number;
  /** Anchor straps along each horizontal / vertical side, from the start of the side, mm. */
  strapsAlongWidth: number[];
  strapsAlongHeight: number[];
  strapsTotal: number;
}

const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

/** Positions of the straps along a side of `lengthMm`: one every 600 mm at most, the first and last 150 mm from the corners. */
export function strapPositions(lengthMm: number): number[] {
  const L = whole(lengthMm);
  if (L <= 2 * SUBFRAME_STRAP_EDGE_MM) return [Math.round(L / 2)];
  const span = L - 2 * SUBFRAME_STRAP_EDGE_MM;
  const count = Math.max(2, Math.ceil(span / SUBFRAME_STRAP_SPACING_MM) + 1);
  return Array.from({ length: count }, (_, i) => Math.round(SUBFRAME_STRAP_EDGE_MM + (span * i) / (count - 1)));
}

export function subframeSizes(input: Pick<SubframeInput, "widthMm" | "heightMm" | "depthMm">): SubframeSizes {
  const w = whole(input.widthMm);
  const h = whole(input.heightMm);
  const grow = (by: number) => ({ w: w + 2 * by, h: h + 2 * by });
  const clear = grow(SUBFRAME_GAP_MM);
  const outer = { w: clear.w + 2 * SUBFRAME_FACE_MM, h: clear.h + 2 * SUBFRAME_FACE_MM };
  const hole = { w: outer.w + 2 * SUBFRAME_JOINT_MM, h: outer.h + 2 * SUBFRAME_JOINT_MM };
  const d = input.depthMm;
  const depthMm = typeof d === "number" && Number.isFinite(d) ? Math.min(SUBFRAME_DEPTH_RANGE_MM.max, Math.max(SUBFRAME_DEPTH_RANGE_MM.min, Math.round(d))) : SUBFRAME_DEFAULT_DEPTH_MM;
  const strapsAlongWidth = strapPositions(outer.w);
  const strapsAlongHeight = strapPositions(outer.h);
  return { window: { w, h }, clear, outer, hole, depthMm, strapsAlongWidth, strapsAlongHeight, strapsTotal: 2 * strapsAlongWidth.length + 2 * strapsAlongHeight.length };
}

/**
 * What the sub-frame sheet needs for a piece: its size and the catalogue row it chose (name and depth), or null when the piece has
 * no sub-frame or the catalogue has no such enabled row (so nothing is drawn that was not priced).
 */
export function subframeInputFor(
  payload: Pick<CatalogPayload, "accessories"> | null | undefined,
  item: Pick<ProjectItem, "width" | "height" | "accessories">,
  locale: string,
): SubframeInput | null {
  const key = item.accessories?.ctel;
  if (!key || key === "none") return null;
  const row = payload?.accessories?.find((a) => a.category === "ctel" && a.key === key && a.enabled);
  if (!row) return null;
  const lang = drawingLocale(locale);
  const label = row.labels?.[lang] || row.labels?.it || row.key;
  return { widthMm: item.width, heightMm: item.height, depthMm: row.depthMm, label };
}

const PAD = 12;
const FIT_W = 300;
const FIT_H = 250;
const K2 = 1.15;
const YELLOW = "#FBBF24";
const MORTAR = "#D6D3D1";
const METAL = "#9CA3AF";
const STEEL = "#4B5563";
const WALL = { fill: "#E5E7EB", stroke: PALETTE.outline, strokeWidth: 0.9 };
const DIM = { stroke: PALETTE.dimLine, strokeWidth: 0.8 };
const FONT = 8;

/** Words wrapped to `max` characters a line (an SVG text does not wrap by itself). */
function wrap(value: string, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    if (current && (current + " " + word).length > max) {
      lines.push(current);
      current = word;
    } else current = current ? current + " " + word : word;
  }
  if (current) lines.push(current);
  return lines;
}

export function buildSubframeScene(input: SubframeInput, localeInput?: string): Scene {
  const words = SUBFRAME[drawingLocale(localeInput)];
  const s = subframeSizes(input);
  const out: Primitive[] = [];
  const badge = (into: Primitive[], letter: string, x: number, y: number) =>
    into.push(circle({ role: "badge", part: "callout" }, x, y, 5.5, { fill: PALETTE.guide, stroke: "#FFFFFF", strokeWidth: 1 }), text({ role: "badge", part: "callout" }, x, y + 2.7, letter, { fontSize: 7.5, fill: "#FFFFFF", weight: "bold" }));

  // ── Elevation ────────────────────────────────────────────────────────────────────────────────
  const k = Math.min(FIT_W / s.hole.w, FIT_H / s.hole.h);
  const u = (mm: number) => mm * k;
  const ring = 18;
  const holeX = ring;
  const holeY = ring;
  const at = (offsetMm: number) => holeX + u(offsetMm);
  const atY = (offsetMm: number) => holeY + u(offsetMm);
  const fromHole = { clear: SUBFRAME_JOINT_MM + SUBFRAME_FACE_MM, window: SUBFRAME_JOINT_MM + SUBFRAME_FACE_MM + SUBFRAME_GAP_MM };

  // Masonry around the hole, then the hole with the joint, the sub-frame ring, the play, the window.
  out.push(rect({ role: "frameOuter", part: "wall" }, holeX - ring, holeY - ring, u(s.hole.w) + 2 * ring, u(s.hole.h) + 2 * ring, WALL));
  for (const [a, b, c, d] of hatchSegments(holeX - ring, holeY - ring, u(s.hole.w) + 2 * ring, u(s.hole.h) + 2 * ring, 9)) out.push(line({ role: "hatch", part: "wall" }, a, b, c, d, { stroke: PALETTE.hatch, strokeWidth: 0.6, opacity: 0.5 }));
  out.push(rect({ role: "frameOuter", part: "joint" }, holeX, holeY, u(s.hole.w), u(s.hole.h), { fill: MORTAR, stroke: PALETTE.outline, strokeWidth: 0.9 }));
  out.push(rect({ role: "frameOuter", part: "subframe" }, at(SUBFRAME_JOINT_MM), atY(SUBFRAME_JOINT_MM), u(s.outer.w), u(s.outer.h), { fill: METAL, stroke: STEEL, strokeWidth: 1.1 }));
  out.push(rect({ role: "frame", part: "play" }, at(fromHole.clear), atY(fromHole.clear), u(s.clear.w), u(s.clear.h), { fill: YELLOW, stroke: "#B45309", strokeWidth: 0.7, opacity: 0.9 }));
  out.push(rect({ role: "frame", part: "window" }, at(fromHole.window), atY(fromHole.window), u(s.window.w), u(s.window.h), { fill: "#FFFFFF", stroke: PALETTE.outline, strokeWidth: 1.2 }));
  const sash = Math.max(3, u(70));
  const gw = u(s.window.w) - 2 * sash;
  const gh = u(s.window.h) - 2 * sash;
  if (gw > 4 && gh > 4) out.push(rect({ role: "glass", part: "glass" }, at(fromHole.window) + sash, atY(fromHole.window) + sash, gw, gh, { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 0.9 }));

  // Anchor straps on the four sides of the sub-frame, pointing into the masonry.
  const strap = (x1: number, y1: number, x2: number, y2: number) =>
    out.push(line({ role: "accessory", part: "strap" }, x1, y1, x2, y2, { stroke: PALETTE.ink, strokeWidth: 2, round: true }), circle({ role: "accessory", part: "strap" }, x2, y2, 1.8, { fill: PALETTE.ink }));
  const outerLeft = SUBFRAME_JOINT_MM;
  const outerTop = SUBFRAME_JOINT_MM;
  const reach = 10;
  for (const p of s.strapsAlongWidth) {
    strap(at(outerLeft + p), atY(outerTop), at(outerLeft + p), atY(outerTop) - reach);
    strap(at(outerLeft + p), atY(outerTop + s.outer.h), at(outerLeft + p), atY(outerTop + s.outer.h) + reach);
  }
  for (const p of s.strapsAlongHeight) {
    strap(at(outerLeft), atY(outerTop + p), at(outerLeft) - reach, atY(outerTop + p));
    strap(at(outerLeft + s.outer.w), atY(outerTop + p), at(outerLeft + s.outer.w) + reach, atY(outerTop + p));
  }

  // Dimension chains: window (A), clear opening (B), overall size (C), minimum hole (D), below and on the right.
  const rows: Array<{ letter: string; w: number; h: number; offset: number }> = [
    { letter: "A", w: s.window.w, h: s.window.h, offset: fromHole.window },
    { letter: "B", w: s.clear.w, h: s.clear.h, offset: fromHole.clear },
    { letter: "C", w: s.outer.w, h: s.outer.h, offset: SUBFRAME_JOINT_MM },
    { letter: "D", w: s.hole.w, h: s.hole.h, offset: 0 },
  ];
  const bottom = holeY + u(s.hole.h) + ring;
  const right = holeX + u(s.hole.w) + ring;
  rows.forEach((r, i) => {
    const y = bottom + 12 + i * 16;
    const x1 = at(r.offset);
    const x2 = x1 + u(r.w);
    out.push(line({ role: "dimension", part: "width" }, x1, y, x2, y, DIM), line({ role: "dimension", part: "width" }, x1, y - 3, x1, y + 3, DIM), line({ role: "dimension", part: "width" }, x2, y - 3, x2, y + 3, DIM));
    out.push(text({ role: "dimension", part: "width" }, (x1 + x2) / 2, y - 3, String(r.w), { fontSize: FONT, fill: PALETTE.dim, weight: "bold" }));
    badge(out, r.letter, x1 - 9, y);
    const x = right + 12 + i * 16;
    const y1 = atY(r.offset);
    const y2 = y1 + u(r.h);
    out.push(line({ role: "dimension", part: "height" }, x, y1, x, y2, DIM), line({ role: "dimension", part: "height" }, x - 3, y1, x + 3, y1, DIM), line({ role: "dimension", part: "height" }, x - 3, y2, x + 3, y2, DIM));
    out.push(text({ role: "dimension", part: "height" }, x - 3, (y1 + y2) / 2, String(r.h), { fontSize: FONT, fill: PALETTE.dim, weight: "bold", rotate: -90 }));
  });
  const elevation = out.splice(0, out.length);
  const elevBounds = boundsOf(elevation);

  // ── Section on the reveal (outside on top, masonry on the left), drawn at its own scale ────────────
  const v = (mm: number) => mm * K2;
  const sec: Primitive[] = [];
  const wallW = 100;
  const wallH = 170;
  const y0 = 30;
  const d = s.depthMm;
  const T = 4;
  const J = SUBFRAME_JOINT_MM;
  const face = SUBFRAME_FACE_MM;
  const gap = SUBFRAME_GAP_MM;
  sec.push(rect({ role: "frameOuter", part: "wall" }, v(-wallW), 0, v(wallW), v(wallH), WALL));
  for (const [a, b, c, e] of hatchSegments(v(-wallW), 0, v(wallW), v(wallH), 9)) sec.push(line({ role: "hatch", part: "wall" }, a, b, c, e, { stroke: PALETTE.hatch, strokeWidth: 0.7, opacity: 0.55 }));
  sec.push(rect({ role: "frame", part: "joint" }, 0, v(y0), v(J), v(d), { fill: MORTAR, stroke: PALETTE.outline, strokeWidth: 0.6 }));
  // The strap goes from the profile into the masonry.
  sec.push(line({ role: "accessory", part: "strap" }, v(J), v(y0 + d / 2), v(-70), v(y0 + d / 2), { stroke: PALETTE.ink, strokeWidth: 2.2, round: true }), line({ role: "accessory", part: "strap" }, v(-70), v(y0 + d / 2 - 14), v(-70), v(y0 + d / 2 + 14), { stroke: PALETTE.ink, strokeWidth: 2.2, round: true }));
  // The L-shaped profile: web against the wall, visible face towards the room.
  const profile: Array<[number, number]> = [[J, y0], [J + T, y0], [J + T, y0 + d - T], [J + face, y0 + d - T], [J + face, y0 + d], [J, y0 + d]];
  sec.push(poly({ role: "frameOuter", part: "subframe" }, profile.map(([x, y]) => [v(x), v(y)] as [number, number]), { fill: METAL, stroke: STEEL, strokeWidth: 1.2 }));
  const winX = J + face + gap;
  const winY = y0 + 8;
  sec.push(rect({ role: "frame", part: "play" }, v(J + T), v(winY), v(face - T + gap), v(d - 8 - T), { fill: YELLOW, stroke: "#B45309", strokeWidth: 0.6, opacity: 0.85 }));
  sec.push(rect({ role: "frame", part: "window" }, v(winX), v(winY), v(70), v(70), { fill: "#FFFFFF", stroke: PALETTE.outline, strokeWidth: 1.2 }));
  sec.push(rect({ role: "glass", part: "glass" }, v(winX + 70), v(winY + 8), v(105), v(24), { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 0.9 }));
  // Depth dimension (extension lines to the right of the window).
  const dimX = v(winX + 70 + 105 + 22);
  sec.push(line({ role: "dimension", part: "extension" }, v(J + face), v(y0), dimX + 4, v(y0), { ...DIM, dash: "2 2", opacity: 0.6 }), line({ role: "dimension", part: "extension" }, v(J + face), v(y0 + d), dimX + 4, v(y0 + d), { ...DIM, dash: "2 2", opacity: 0.6 }));
  sec.push(line({ role: "dimension", part: "depth" }, dimX, v(y0), dimX, v(y0 + d), DIM), line({ role: "dimension", part: "depth" }, dimX - 3, v(y0), dimX + 3, v(y0), DIM), line({ role: "dimension", part: "depth" }, dimX - 3, v(y0 + d), dimX + 3, v(y0 + d), DIM));
  sec.push(text({ role: "dimension", part: "depth" }, dimX + 5, v(y0 + d / 2) + 3, `${words.depth} ${d}`, { fontSize: FONT, fill: PALETTE.dim, weight: "bold", anchor: "start" }));
  sec.push(text({ role: "leafLabel", part: "side" }, v(winX + 70 + 105), v(y0) - 22, words.exterior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold", anchor: "end" }), text({ role: "leafLabel", part: "side" }, v(winX + 70 + 105), v(y0 + d) + 28, words.interior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold", anchor: "end" }));
  const callouts: Array<{ word: "wall" | "subframe" | "anchor" | "frame" | "foam"; x: number; y: number }> = [
    { word: "wall", x: -wallW / 2, y: wallH - 30 },
    { word: "subframe", x: J - 14, y: y0 + d + 16 },
    { word: "anchor", x: -48, y: y0 + d / 2 - 22 },
    { word: "frame", x: winX + 35, y: winY + 35 },
    { word: "foam", x: J + T + (face - T + gap) / 2, y: winY + (d - 8 - T) / 2 },
  ];
  callouts.forEach((c, i) => badge(sec, String(i + 1), v(c.x), v(c.y)));
  const section = sec;
  const secBounds = boundsOf(section);

  // ── Sheet: title, elevation, section, key, note ───────────────────────────────────────────────
  const sheet: Primitive[] = [];
  const titleY = 0;
  sheet.push(text({ role: "dimension", part: "title" }, 0, titleY, words.title, { fontSize: 9, fill: PALETTE.ink, anchor: "start", weight: "bold" }));
  let cursorY = titleY + 10;
  if (input.label) {
    sheet.push(text({ role: "dimension", part: "subtitle" }, 0, cursorY + 2, `${input.label} · ${words.depth} ${d} mm`, { fontSize: 7.5, fill: PALETTE.dim, anchor: "start" }));
    cursorY += 12;
  }
  const dx1 = -elevBounds.minX;
  const dy1 = cursorY - elevBounds.minY + 6;
  for (const p of elevation) sheet.push(place(p, dx1, dy1));
  cursorY = dy1 + elevBounds.maxY + 10;
  sheet.push(text({ role: "dimension", part: "title" }, 0, cursorY + 4, words.section, { fontSize: 9, fill: PALETTE.ink, anchor: "start", weight: "bold" }));
  const dx2 = -secBounds.minX;
  const dy2 = cursorY + 14 - secBounds.minY;
  for (const p of section) sheet.push(place(p, dx2, dy2));
  cursorY = dy2 + secBounds.maxY + 16;

  // Key: letters for the elevation dimensions, numbers for the section.
  const keyLines: string[] = [
    `A  ${words.window}: ${s.window.w} × ${s.window.h} mm`,
    `B  ${words.clear}: ${s.clear.w} × ${s.clear.h} mm`,
    `C  ${words.outer}: ${s.outer.w} × ${s.outer.h} mm`,
    `D  ${words.hole}: ${s.hole.w} × ${s.hole.h} mm`,
    `${words.anchors}: ${s.strapsTotal} (≤ ${SUBFRAME_STRAP_SPACING_MM} mm)`,
    ...callouts.map((c, i) => `${i + 1}  ${words[c.word]}`),
  ];
  keyLines.forEach((line1, i) => sheet.push(text({ role: "dimension", part: "key" }, 0, cursorY + i * 11, line1, { fontSize: 7.6, fill: PALETTE.ink, anchor: "start" })));
  cursorY += keyLines.length * 11 + 6;
  wrap(words.note, 62).forEach((l, i) => sheet.push(text({ role: "dimension", part: "note" }, 0, cursorY + i * 8, l, { fontSize: 6.2, fill: PALETTE.dimLine, anchor: "start" })));

  const b = boundsOf(sheet);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const w = r3(b.maxX - b.minX + 2 * PAD);
  const h = r3(b.maxY - b.minY + 2 * PAD);
  const box = { x: 0, y: 0, w, h };
  return {
    viewBox: { w, h },
    primitives: sheet.map((p) => place(p, dx, dy)),
    meta: { scale: k, widthMm: s.window.w, heightMm: s.window.h, frame: box, inner: box, sashInset: 0, cells: [], ratios: [], dividers: [], sashTypes: [] },
  };
}
