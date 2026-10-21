import { assemblyLayout, type AssemblyMember, type AssemblyPiece } from "@/shared/composition";
import { buildScene } from "./build-scene";
import { PALETTE } from "./finishes";
import { line, place, rect, text } from "./prims";
import type { DrawingInput, Primitive, Scene } from "./types";

const FIT_W = 360;
const FIT_H = 300;
const PAD = 14;
const TICK = 4;

export interface AssemblyDrawingPiece extends AssemblyPiece {
  input: DrawingInput;
}

/**
 * Several pieces joined along their edges, drawn as one shape at one scale with a coupling profile on every shared edge and
 * the overall width / height of the whole. Pieces that do not exist in the grid leave a hole (L, T and U shapes).
 * Valid for assemblies that pass `assemblyIssues`; the pieces' own dimension lines are left out (the whole is measured instead).
 */
export function buildAssemblyScene(pieces: readonly AssemblyDrawingPiece[], members: readonly AssemblyMember[]): Scene {
  const layout = assemblyLayout(pieces, members);
  const mmPerUnit = Math.max(layout.totalWidthMm / FIT_W, layout.totalHeightMm / FIT_H, 1);
  const scale = 1 / mmPerUnit;
  const out: Primitive[] = [];
  const textures: NonNullable<Scene["defs"]>["textures"] = [];

  for (const box of layout.boxes) {
    const piece = pieces[box.index];
    const s = buildScene(piece.input, { showDimensions: false, mmPerUnit });
    // The piece's frame lands on its cell; whatever else the piece draws (reflections, handles, bars) travels with it.
    const dx = PAD + box.x * scale - s.meta.frame.x;
    const dy = PAD + box.y * scale - s.meta.frame.y;
    for (const p of s.primitives) {
      if (p.role === "hit" || p.role === "selection" || p.role === "badge") continue;
      out.push(place(p, dx, dy));
    }
    for (const t of s.defs?.textures ?? []) if (!textures.some((x) => x.id === t.id)) textures.push(t);
  }

  // Coupling profile over every shared edge.
  const coupling = Math.max(4, 40 * scale);
  const at = new Map(layout.boxes.map((b) => [b.index, b] as const));
  for (const m of members) {
    for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
      const other = members.find((o) => o.col === m.col + dc && o.row === m.row + dr);
      if (!other) continue;
      const a = at.get(m.index)!;
      const b = at.get(other.index)!;
      if (dc === 1) {
        const x = PAD + b.x * scale;
        const y1 = PAD + Math.max(a.y, b.y) * scale;
        const y2 = PAD + Math.min(a.y + a.h, b.y + b.h) * scale;
        out.push(rect({ role: "frame", part: "coupling" }, x - coupling / 2, y1, coupling, y2 - y1, { fill: PALETTE.guide, stroke: PALETTE.outline, strokeWidth: 0.6, opacity: 0.85 }));
      } else {
        const y = PAD + b.y * scale;
        const x1 = PAD + Math.max(a.x, b.x) * scale;
        const x2 = PAD + Math.min(a.x + a.w, b.x + b.w) * scale;
        out.push(rect({ role: "frame", part: "coupling" }, x1, y - coupling / 2, x2 - x1, coupling, { fill: PALETTE.guide, stroke: PALETTE.outline, strokeWidth: 0.6, opacity: 0.85 }));
      }
    }
  }

  // Overall dimensions of the whole shape.
  const W = layout.totalWidthMm * scale;
  const H = layout.totalHeightMm * scale;
  const dimStyle = { stroke: PALETTE.dimLine, strokeWidth: 0.8 };
  const font = { fontSize: 10, fill: PALETTE.dim, weight: "bold" as const };
  const wTag = { role: "dimension" as const, part: "width" };
  const hTag = { role: "dimension" as const, part: "height" };
  const yW = PAD + H + 16;
  out.push(
    line(wTag, PAD, yW, PAD + W, yW, dimStyle),
    line(wTag, PAD, yW - TICK, PAD, yW + TICK, dimStyle),
    line(wTag, PAD + W, yW - TICK, PAD + W, yW + TICK, dimStyle),
    text(wTag, PAD + W / 2, yW + 14, `${layout.totalWidthMm} mm`, font),
  );
  const xH = PAD + W + 16;
  out.push(
    line(hTag, xH, PAD, xH, PAD + H, dimStyle),
    line(hTag, xH - TICK, PAD, xH + TICK, PAD, dimStyle),
    line(hTag, xH - TICK, PAD + H, xH + TICK, PAD + H, dimStyle),
    text(hTag, xH + 13, PAD + H / 2, `${layout.totalHeightMm} mm`, { ...font, rotate: -90 }),
  );

  const frame = { x: PAD, y: PAD, w: W, h: H };
  return {
    viewBox: { w: Math.round((W + 2 * PAD + 32) * 1000) / 1000, h: Math.round((H + 2 * PAD + 30) * 1000) / 1000 },
    ...(textures.length > 0 ? { defs: { textures } } : {}),
    primitives: out,
    meta: {
      view: "inside",
      scale,
      widthMm: layout.totalWidthMm,
      heightMm: layout.totalHeightMm,
      frame,
      inner: frame,
      sashInset: 0,
      cells: [],
      ratios: [],
      dividers: [],
      sashTypes: [],
      handles: [],
    },
  };
}
