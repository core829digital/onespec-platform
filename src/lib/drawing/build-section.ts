import { drawingLocale, PLAN, SECTION, type SectionWord } from "./drawing-text";
import { glazingShape, type GlassLayer } from "@/shared/glazing-packages";
import { PALETTE } from "./finishes";
import { boundsOf, circle, hatchSegments, line, place, poly, rect, text } from "./prims";
import type { Primitive, Scene } from "./types";

export interface SectionInput {
  material: string;
  /** Quality key of the material (e.g. chamber5 / chamber7, pine / oak, standard / thermalbreak). */
  quality?: string;
  /** Glazing catalogue key; anything that reads as triple glazing draws three panes. */
  glazing?: string;
  /** dritto / reno40 / reno65 ... : renovation frames add the sub-frame band. */
  frameType?: string;
  /** Printed under the drawing when known. */
  thermal?: { uf: number; ug: number; psi: number };
}

const K = 1.6; // drawing units per mm
const PAD = 12;

/** Three panes for triple glazing, two otherwise (legacy keys read as before). */
export function paneCount(glazing: string | undefined): 2 | 3 {
  return glazingShape(glazing).family === "triple" ? 3 : 2;
}

/** Overall thickness of the glazing unit in mm: the chosen package depth (24 / 36 for the older keys). */
export function glazingThicknessMm(glazing: string | undefined): number {
  return glazingShape(glazing).depthMm;
}

/** How many partitions a PVC profile shows: 5-chamber or 7-chamber systems. */
export function pvcChambers(quality: string | undefined): 5 | 7 {
  return /7/.test(quality ?? "") ? 7 : 5;
}

function renovationBandMm(frameType: string | undefined): number {
  const m = /reno(\d+)/i.exec(frameType ?? "");
  return m ? Math.min(80, Math.max(30, Number(m[1]))) : 0;
}

/**
 * A schematic horizontal section through a jamb: wall, frame, sash, glazing unit, spacer, gaskets. Outside on top.
 * Drawn from the material, the quality and the glazing of the piece; it is an orientation sketch, never the
 * manufacturer's construction detail (the drawing says so).
 */
export function buildSectionScene(input: SectionInput, localeInput?: string): Scene {
  const locale = drawingLocale(localeInput);
  const words = SECTION[locale];
  const room = PLAN[locale];
  const out: Primitive[] = [];
  const u = (mm: number) => mm * K;
  const panes = paneCount(input.glazing);
  const t = glazingThicknessMm(input.glazing);
  const material = /wood|legno|bois|holz|hout/i.test(input.material) ? "wood" : /alu/i.test(input.material) ? "aluminum" : "pvc";
  const D = material === "wood" ? 68 : material === "aluminum" ? 70 : 76;
  const thermalBreak = material === "aluminum" && /thermal|taglio|break/i.test(input.quality ?? "");
  const tag = (part: string): { role: "frame"; part: string } => ({ role: "frame", part });

  const body = (() => {
    switch (material) {
      case "wood":
        return { fill: "#D8B27C", stroke: "#6B4423" };
      case "aluminum":
        return { fill: "#B6BCC6", stroke: "#4B5563" };
      default:
        return { fill: "#FFFFFF", stroke: PALETTE.outline };
    }
  })();
  const edge = { fill: body.fill, stroke: body.stroke, strokeWidth: 1.2 };

  // Wall (hatched) and, for renovation frames, the sub-frame band against it.
  const band = renovationBandMm(input.frameType);
  out.push(rect({ role: "frameOuter", part: "wall" }, u(-70), u(-24), u(70), u(D + 48), { fill: "#E5E7EB", stroke: PALETTE.outline, strokeWidth: 0.9 }));
  for (const [a, b, c, d] of hatchSegments(u(-70), u(-24), u(70), u(D + 48), 9)) {
    out.push(line({ role: "hatch", part: "wall" }, a, b, c, d, { stroke: PALETTE.hatch, strokeWidth: 0.7, opacity: 0.55 }));
  }
  if (band > 0) {
    out.push(rect({ role: "frameOuter", part: "band" }, u(-6), u(4), u(6), u(band * 0.9), { fill: "#9CA3AF", stroke: "#374151", strokeWidth: 1 }));
  }

  // Frame (blendrahmen) and sash polygons interlock with a 2 mm gap.
  const frame: Array<[number, number]> = [[0, 0], [60, 0], [60, 26], [48, 26], [48, D], [0, D]].map(([x, y]) => [u(x), u(y)] as [number, number]);
  const sash: Array<[number, number]> = [[62, 0], [142, 0], [142, D], [50, D], [50, 28], [62, 28]].map(([x, y]) => [u(x), u(y)] as [number, number]);
  out.push(poly(tag("frame"), frame, edge), poly({ role: "sashOutline", part: "sash" }, sash, edge));

  // Material detail.
  if (material === "pvc") {
    const n = pvcChambers(input.quality);
    for (const [x0, x1, y0, y1] of [[0, 48, 30, D - 4], [64, 140, 32, D - 4], [0, 58, 4, 22]] as const) {
      const cols = Math.max(2, Math.round((n * (x1 - x0)) / 60));
      for (let i = 1; i < cols; i++) {
        const x = x0 + ((x1 - x0) * i) / cols;
        out.push(line({ role: "frame", part: "chamber" }, u(x), u(y0), u(x), u(y1), { stroke: PALETTE.dimLine, strokeWidth: 0.7 }));
      }
    }
    out.push(rect({ role: "frame", part: "steel" }, u(8), u(36), u(14), u(D - 46), { fill: "#6B7280", stroke: "#374151", strokeWidth: 0.7 }));
  } else if (material === "wood") {
    for (const [x0, y0, x1, y1] of [[6, 10, 42, D - 12], [14, 6, 52, 18], [72, 10, 128, D - 14], [96, 6, 136, D - 24]] as const) {
      out.push(line({ role: "frame", part: "grain" }, u(x0), u(y0), u(x1), u(y1), { stroke: "#8B5A2B", strokeWidth: 0.7, opacity: 0.6 }));
    }
  } else if (thermalBreak) {
    out.push(
      rect({ role: "frame", part: "break" }, u(0), u(D * 0.44), u(48), u(D * 0.12), { fill: "#1F2937", stroke: "#111827", strokeWidth: 0.8 }),
      rect({ role: "frame", part: "break" }, u(50), u(D * 0.44), u(92), u(D * 0.12), { fill: "#1F2937", stroke: "#111827", strokeWidth: 0.8 }),
    );
  }

  // Gaskets between frame and sash.
  const gasket = { stroke: "#111827", strokeWidth: 2, round: true };
  out.push(line({ role: "frame", part: "gasket" }, u(49), u(30), u(49), u(D - 3), gasket), line({ role: "frame", part: "gasket" }, u(61), u(2), u(61), u(25), gasket));

  // Glazing unit in the sash rebate: panes with gas gaps, a spacer at the edge.
  const mid = D / 2;
  const top = mid - t / 2;
  const x0 = 112;
  const x1 = 250;
  out.push(rect({ role: "sashOutline", part: "rebate" }, u(x0), u(top - 3), u(142 - x0), u(t + 6), { fill: "#FFFFFF", stroke: "none" }));
  const shape = glazingShape(input.glazing);
  const isPanel = shape.kind !== "glass";
  if (isPanel) {
    // Opaque panel: skins in the frame colour around an insulating core.
    const skin = 3;
    out.push(
      rect({ role: "panel", part: "pane" }, u(x0), u(top), u(x1 - x0), u(t), { fill: "#F5E6C8", stroke: PALETTE.ink, strokeWidth: 0.9 }),
      rect({ role: "panel", part: "pane" }, u(x0), u(top), u(x1 - x0), u(skin), { fill: body.fill, stroke: body.stroke, strokeWidth: 0.9 }),
      rect({ role: "panel", part: "pane" }, u(x0), u(top + t - skin), u(x1 - x0), u(skin), { fill: body.fill, stroke: body.stroke, strokeWidth: 0.9 }),
    );
    if (shape.kind === "ornamentalPanel") {
      for (let k = 1; k <= 4; k++) out.push(line({ role: "panel", part: "moulding" }, u(x0 + 18 + k * 22), u(top + skin), u(x0 + 18 + k * 22), u(top + 2 * skin), { stroke: body.stroke, strokeWidth: 0.9 }));
    }
  } else {
    const layers: GlassLayer[] = shape.composition?.layers ?? (panes === 3 ? ["float", "float", "floatBe"] : ["float", "floatBe"]);
    const thick = (l: GlassLayer) => (l === "lam" || l === "lamBe" ? 7 : 4);
    const gap = Math.max(2, (t - layers.reduce((n, l) => n + thick(l), 0)) / (layers.length - 1));
    let y = top;
    layers.forEach((l, i) => {
      const h = thick(l);
      out.push(rect({ role: "glass", part: "pane" }, u(x0), u(y), u(x1 - x0), u(h), { fill: l === "satin" ? "#E8EEF1" : PALETTE.glass, stroke: PALETTE.ink, strokeWidth: 0.9 }));
      if (l === "lam" || l === "lamBe") out.push(line({ role: "glass", part: "film" }, u(x0), u(y + h / 2), u(x1), u(y + h / 2), { stroke: PALETTE.guide, strokeWidth: 0.7, opacity: 0.8 }));
      if (l === "satin") {
        for (let k = x0 + 6; k < x1; k += 9) out.push(line({ role: "glass", part: "satin" }, u(k), u(y + 0.6), u(k + 3), u(y + h - 0.6), { stroke: PALETTE.dimLine, strokeWidth: 0.6, opacity: 0.8 }));
      }
      if (l === "floatBe" || l === "lamBe") out.push(line({ role: "glass", part: "lowE" }, u(x0), u(y + h + 0.4), u(x1), u(y + h + 0.4), { stroke: "#16A34A", strokeWidth: 1.1 }));
      y += h;
      if (i < layers.length - 1) {
        out.push(rect({ role: "glass", part: "gap" }, u(x0), u(y), u(x1 - x0), u(gap), { fill: "#F3F8FB", stroke: "none" }));
        y += gap;
      }
    });
  }
  if (!isPanel) out.push(rect({ role: "glass", part: "spacer" }, u(x0), u(top), u(11), u(t), { fill: "#374151", stroke: "#111827", strokeWidth: 0.8 }));
  out.push(rect({ role: "sashOutline", part: "bead" }, u(120), u(top + t + 2), u(22), u(11), { fill: body.fill, stroke: body.stroke, strokeWidth: 1 }));
  out.push(line({ role: "glass", part: "break" }, u(x1), u(top - 5), u(x1), u(top + t + 5), { stroke: PALETTE.dimLine, strokeWidth: 0.8, dash: "3 2" }));

  // Dimensions: glazing thickness on the right, profile depth on the left of the wall.
  const dim = { stroke: PALETTE.dimLine, strokeWidth: 0.8 };
  out.push(
    line({ role: "dimension", part: "glass" }, u(x1 + 12), u(top), u(x1 + 12), u(top + t), dim),
    line({ role: "dimension", part: "glass" }, u(x1 + 8), u(top), u(x1 + 16), u(top), dim),
    line({ role: "dimension", part: "glass" }, u(x1 + 8), u(top + t), u(x1 + 16), u(top + t), dim),
    text({ role: "dimension", part: "glass" }, u(x1 + 20), u(mid) + 3, `${t} mm`, { fontSize: 9, fill: PALETTE.dim, anchor: "start", weight: "bold" }),
    line({ role: "dimension", part: "depth" }, u(-80), u(0), u(-80), u(D), dim),
    line({ role: "dimension", part: "depth" }, u(-84), u(0), u(-76), u(0), dim),
    line({ role: "dimension", part: "depth" }, u(-84), u(D), u(-76), u(D), dim),
    text({ role: "dimension", part: "depth" }, u(-86), u(mid) + 3, `${D} mm`, { fontSize: 9, fill: PALETTE.dim, anchor: "end", weight: "bold" }),
    text({ role: "dimension", part: "exterior" }, u(30), u(-12), room.exterior, { fontSize: 7, fill: PALETTE.dimLine, weight: "bold" }),
    text({ role: "dimension", part: "interior" }, u(30), u(D + 20), room.interior, { fontSize: 7, fill: PALETTE.dimLine, weight: "bold" }),
  );

  // Numbered call-outs and the key under the drawing.
  const items: Array<{ word: SectionWord; at: [number, number] }> = [
    { word: "frame", at: [20, D - 14] },
    { word: "sash", at: [122, 14] },
    { word: isPanel ? "panel" : "glass", at: [190, mid] },
    
    { word: "bead", at: [131, top + t + 7] },
    { word: "gaskets", at: [49, 40] },
  ];
  if (!isPanel) items.splice(items.findIndex((it) => it.word === "bead"), 0, { word: "spacer", at: [x0 + 5, top + t + 7] });
  if (band > 0) items.push({ word: "band", at: [-3, 20] });
  if (shape.composition?.layers.some((l) => l === "floatBe" || l === "lamBe")) items.push({ word: "lowE", at: [x1 - 20, top - 9] });
  if (thermalBreak) items.push({ word: "thermalBreak", at: [24, D * 0.5] });
  if (material === "pvc") items.push({ word: "steel", at: [15, 50] });
  items.forEach((it, i) => {
    const [ax, ay] = it.at;
    out.push(
      circle({ role: "badge", part: "callout" }, u(ax), u(ay), 5.5, { fill: PALETTE.guide, stroke: "#FFFFFF", strokeWidth: 1 }),
      text({ role: "badge", part: "callout" }, u(ax), u(ay) + 2.7, String(i + 1), { fontSize: 7.5, fill: "#FFFFFF", weight: "bold" }),
    );
  });
  const keyTop = u(D + 44);
  const colW = u(150);
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    out.push(
      text({ role: "dimension", part: "key" }, u(-70) + col * colW, keyTop + row * 13, `${i + 1}  ${words[it.word]}`, { fontSize: 8, fill: PALETTE.ink, anchor: "start" }),
    );
  });
  let y = keyTop + Math.ceil(items.length / 2) * 13 + 8;
  if (input.thermal && input.thermal.ug > 0) {
    const th = input.thermal;
    out.push(text({ role: "dimension", part: "thermal" }, u(-70), y, `Uf ${th.uf.toFixed(2)} · Ug ${th.ug.toFixed(2)} · Ψ ${th.psi.toFixed(2)} W/m²K`, { fontSize: 8, fill: PALETTE.guide, anchor: "start", weight: "bold" }));
    y += 12;
  }
  out.push(text({ role: "dimension", part: "note" }, u(-70), y, words.note, { fontSize: 6.8, fill: PALETTE.dimLine, anchor: "start" }));

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
