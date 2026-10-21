import { drawingLocale, PLAN, POSA, type PosaWord } from "./drawing-text";
import { PALETTE } from "./finishes";
import { boundsOf, circle, hatchSegments, line, place, poly, rect, text } from "./prims";
import type { Primitive, Scene } from "./types";

export type PosaKind = "jamb" | "sill";
export type PosaJob = "standard" | "insulated" | "renovation";

export interface PosaNodeInput {
  /** Installation node key of the dossier (primario, secondario, cassonetto, appui, onderdorpel, ...). */
  nodeType: string;
  /** Job type key of the dossier (sostituzione, nuova, cappotto, ristrutturazione, ite, wdvs, ...). */
  jobType: string;
}

/** Sill nodes of every market, otherwise a jamb (reveal) section. */
export function posaKindFor(nodeType: string): PosaKind {
  return /appui|onderdorpel|boden|davanzal|sill|seuil/i.test(nodeType) ? "sill" : "jamb";
}

/** Insulated / renovation / standard, from the job-type keys of all markets. */
export function posaJobFor(jobType: string): PosaJob {
  if (/cappotto|^ite$|isolatie|wdvs|isolation|lourde/i.test(jobType)) return "insulated";
  if (/ristruttur|renovation$|renovatie|^renovation/i.test(jobType) && !/lourde/i.test(jobType)) return "renovation";
  return "standard";
}

const K = 1.5;
const PAD = 12;
const u = (mm: number) => mm * K;
const YELLOW = "#FBBF24";
const BLUE = "#2563EB";
const GREEN = "#16A34A";
const RED = "#DC2626";
const WALL = { fill: "#E5E7EB", stroke: PALETTE.outline, strokeWidth: 0.9 };

/**
 * Schematic installation node (posa in opera): wall, insulation, sub-frame, window, foam, inner airtight tape,
 * outer weather tape, sealant and fixing, as the Posa Qualificata dossier describes it. Jamb = horizontal section
 * (outside on top); sill = vertical section (outside on the left). Indicative only.
 */
export function buildPosaNodeScene(input: PosaNodeInput, localeInput?: string): Scene {
  const locale = drawingLocale(localeInput);
  const words = POSA[locale];
  const room = PLAN[locale];
  const kind = posaKindFor(input.nodeType);
  const job = posaJobFor(input.jobType);
  const out: Primitive[] = [];
  const items: Array<{ word: PosaWord; at: [number, number] }> = [];
  const hatch = (x: number, y: number, w: number, h: number) => {
    out.push(rect({ role: "frameOuter", part: "wall" }, u(x), u(y), u(w), u(h), WALL));
    for (const [a, b, c, d] of hatchSegments(u(x), u(y), u(w), u(h), 9)) out.push(line({ role: "hatch", part: "wall" }, a, b, c, d, { stroke: PALETTE.hatch, strokeWidth: 0.7, opacity: 0.55 }));
  };
  const frameStyle = { fill: "#FFFFFF", stroke: PALETTE.outline, strokeWidth: 1.2 };
  const strip = (tag: string, x1: number, y1: number, x2: number, y2: number, color: string) =>
    out.push(line({ role: "accessory", part: tag }, u(x1), u(y1), u(x2), u(y2), { stroke: color, strokeWidth: 2.6 }));
  const insulated = job === "insulated";
  const sub = job !== "standard";

  if (kind === "jamb") {
    // Wall on the left of the opening edge (x = 0), outside on top (y = 0), 240 mm thick.
    const yW = insulated ? -72 : 60;
    hatch(-130, 0, 130, 240);
    if (insulated) out.push(rect({ role: "frameOuter", part: "insulation" }, u(-130), u(-80), u(130), u(80), { fill: "#FEF3C7", stroke: "#B45309", strokeWidth: 0.9 }));
    const gap = sub ? 26 : 14;
    if (sub) out.push(rect({ role: "frameOuter", part: "band" }, u(0), u(yW - 4), u(18), u(78), { fill: "#9CA3AF", stroke: "#374151", strokeWidth: 1 }));
    out.push(rect({ role: "frame", part: "foam" }, u(sub ? 18 : 0), u(yW), u(gap - (sub ? 18 : 0)), u(70), { fill: YELLOW, stroke: "#B45309", strokeWidth: 0.7, opacity: 0.85 }));
    out.push(rect({ role: "frame", part: "window" }, u(gap), u(yW), u(70), u(70), frameStyle));
    out.push(rect({ role: "glass", part: "glass" }, u(gap + 70), u(yW + 8), u(110), u(24), { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 0.9 }));
    strip("tapeOut", 0, yW - 2, gap + 30, yW - 2, GREEN);
    strip("tapeIn", 0, yW + 72, gap + 30, yW + 72, BLUE);
    out.push(circle({ role: "accessory", part: "sealant" }, u(gap - 4), u(yW - 12), 4.5, { fill: RED, stroke: RED, strokeWidth: 0.6 }));
    out.push(line({ role: "accessory", part: "fixing" }, u(gap + 45), u(yW + 35), u(-70), u(yW + 35), { stroke: PALETTE.ink, strokeWidth: 1.4, dash: "5 3" }));
    out.push(circle({ role: "accessory", part: "fixing" }, u(gap + 45), u(yW + 35), 3, { fill: PALETTE.ink, stroke: PALETTE.ink, strokeWidth: 0.6 }));
    items.push({ word: "wall", at: [-95, 150] });
    if (insulated) items.push({ word: "insulation", at: [-95, -40] });
    if (sub) items.push({ word: "subframe", at: [9, yW + 92] });
    items.push({ word: "frame", at: [gap + 35, yW + 52] }, { word: "foam", at: [sub ? 22 : 7, yW + 24] }, { word: "tapeIn", at: [gap + 12, yW + 86] }, { word: "tapeOut", at: [gap + 12, yW - 16] }, { word: "sealant", at: [gap - 4, yW - 28] }, { word: "fixing", at: [-40, yW + 54] });
    out.push(text({ role: "leafLabel", part: "side" }, u(150), u(-4), room.exterior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold" }), text({ role: "leafLabel", part: "side" }, u(150), u(240), room.interior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold" }));
  } else {
    // Sill: vertical section, outside on the left (x = 0), wall top at y = 0, window above it.
    hatch(-60, 0, 330, 140);
    if (insulated) out.push(rect({ role: "frameOuter", part: "insulation" }, u(-60), u(-0), u(60), u(140), { fill: "#FEF3C7", stroke: "#B45309", strokeWidth: 0.9 }));
    const x = insulated ? -50 : 70;
    out.push(rect({ role: "frame", part: "foam" }, u(x), u(-14), u(70), u(14), { fill: YELLOW, stroke: "#B45309", strokeWidth: 0.7, opacity: 0.85 }));
    if (job !== "standard") out.push(rect({ role: "frameOuter", part: "band" }, u(x - 4), u(-22), u(78), u(8), { fill: "#9CA3AF", stroke: "#374151", strokeWidth: 1 }));
    out.push(rect({ role: "frame", part: "window" }, u(x), u(-100), u(70), u(84), frameStyle));
    out.push(rect({ role: "glass", part: "glass" }, u(x + 8), u(-260), u(24), u(160), { fill: PALETTE.glass, stroke: PALETTE.outline, strokeWidth: 0.9 }));
    out.push(poly({ role: "accessory", part: "sillOut" }, [[x - 90, 4], [x - 90, 14], [x, 8], [x, -6]].map(([a, b]) => [u(a), u(b)] as [number, number]), { fill: "#D1D5DB", stroke: PALETTE.outline, strokeWidth: 1 }));
    out.push(poly({ role: "accessory", part: "sillIn" }, [[x + 70, -4], [x + 150, -4], [x + 150, 6], [x + 70, 6]].map(([a, b]) => [u(a), u(b)] as [number, number]), { fill: "#D8B27C", stroke: "#6B4423", strokeWidth: 1 }));
    strip("tapeOut", x - 2, 2, x - 2, -26, GREEN);
    strip("tapeIn", x + 72, 2, x + 72, -26, BLUE);
    out.push(circle({ role: "accessory", part: "sealant" }, u(x - 8), u(-30), 4.5, { fill: RED, stroke: RED, strokeWidth: 0.6 }));
    out.push(line({ role: "accessory", part: "fixing" }, u(x + 35), u(-60), u(x + 35), u(60), { stroke: PALETTE.ink, strokeWidth: 1.4, dash: "5 3" }));
    out.push(circle({ role: "accessory", part: "fixing" }, u(x + 35), u(-60), 3, { fill: PALETTE.ink, stroke: PALETTE.ink, strokeWidth: 0.6 }));
    items.push({ word: "wall", at: [insulated ? 120 : 20, 80] });
    if (insulated) items.push({ word: "insulation", at: [-30, 80] });
    if (job !== "standard") items.push({ word: "subframe", at: [x - 14, -18] });
    items.push({ word: "frame", at: [x + 35, -90] }, { word: "foam", at: [x + 35, -7] }, { word: "tapeIn", at: [x + 86, -20] }, { word: "tapeOut", at: [x - 16, -20] }, { word: "sealant", at: [x - 8, -46] }, { word: "sillOut", at: [x - 60, 28] }, { word: "sillIn", at: [x + 110, 22] }, { word: "fixing", at: [x + 54, -60] });
    out.push(text({ role: "leafLabel", part: "side" }, u(x - 80), u(-270), room.exterior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold", anchor: "start" }), text({ role: "leafLabel", part: "side" }, u(x + 150), u(-270), room.interior, { fontSize: 7.5, fill: PALETTE.guide, weight: "bold", anchor: "end" }));
  }

  const body = boundsOf(out);
  items.forEach((it, i) => {
    const [ax, ay] = it.at;
    out.push(circle({ role: "badge", part: "callout" }, u(ax), u(ay), 5.5, { fill: PALETTE.guide, stroke: "#FFFFFF", strokeWidth: 1 }), text({ role: "badge", part: "callout" }, u(ax), u(ay) + 2.7, String(i + 1), { fontSize: 7.5, fill: "#FFFFFF", weight: "bold" }));
  });
  const keyTop = body.maxY + 22;
  const x0 = body.minX;
  out.push(text({ role: "dimension", part: "title" }, x0, body.minY - 8, kind === "jamb" ? words.titleJamb : words.titleSill, { fontSize: 9, fill: PALETTE.ink, anchor: "start", weight: "bold" }));
  items.forEach((it, i) => out.push(text({ role: "dimension", part: "key" }, x0, keyTop + i * 12, `${i + 1}  ${words[it.word]}`, { fontSize: 8, fill: PALETTE.ink, anchor: "start" })));
  out.push(text({ role: "dimension", part: "note" }, x0, keyTop + items.length * 12 + 8, words.note, { fontSize: 6.4, fill: PALETTE.dimLine, anchor: "start" }));

  const b = boundsOf(out);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const w = r3(b.maxX - b.minX + 2 * PAD);
  const h = r3(b.maxY - b.minY + 2 * PAD);
  const box = { x: 0, y: 0, w, h };
  return {
    viewBox: { w, h },
    primitives: out.map((p) => place(p, dx, dy)),
    meta: { scale: K, widthMm: 0, heightMm: 0, frame: box, inner: box, sashInset: 0, cells: [], ratios: [], dividers: [], sashTypes: [] },
  };
}
