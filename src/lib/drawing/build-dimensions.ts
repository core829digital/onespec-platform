import { PALETTE } from "./finishes";
import { line, text } from "./prims";
import type { Primitive, SceneCell, SceneContext } from "./types";

const TICK = 4;
const LINE_STYLE = { stroke: PALETTE.dimLine, strokeWidth: 0.8 };
const FONT = { fontSize: 10, fill: PALETTE.dim, weight: "bold" as const };

function horizontal(tag: { role: "dimension" | "leafLabel"; sashIndex?: number }, x1: number, x2: number, y: number): Primitive[] {
  return [
    line(tag, x1, y, x2, y, LINE_STYLE),
    line(tag, x1, y - TICK, x1, y + TICK, LINE_STYLE),
    line(tag, x2, y - TICK, x2, y + TICK, LINE_STYLE),
  ];
}

/**
 * Overall width (below) and height (right) dimension lines, plus an optional
 * per-leaf width chain above the overall row. `rightClear` keeps the height
 * line outside accessories that flank the frame.
 */
export function drawDimensions(ctx: SceneContext, cells: SceneCell[], rightClear: number): Primitive[] {
  const { frame, band, options } = ctx;
  const out: Primitive[] = [];
  const bottom = frame.y + frame.h + band;
  let rowY = bottom + 14;

  if (options.showLeafDimensions) {
    const xs = [frame.x, ...cells.slice(1).map((c) => c.x), frame.x + frame.w];
    cells.forEach((c, i) => {
      const tag = { role: "leafLabel" as const, sashIndex: i };
      const a = xs[i];
      const b = xs[i + 1];
      out.push(...horizontal(tag, a, b, rowY), text(tag, (a + b) / 2, rowY + 12, `${c.mm}`, { ...FONT, fontSize: 9 }));
    });
    rowY += 28;
  }

  const w = { role: "dimension" as const, part: "width" };
  out.push(...horizontal(w, frame.x, frame.x + frame.w, rowY), text(w, frame.x + frame.w / 2, rowY + 14, `${ctx.widthMm} mm`, FONT));

  const h = { role: "dimension" as const, part: "height" };
  const x = frame.x + frame.w + Math.max(band, rightClear) + 14;
  out.push(
    line(h, x, frame.y, x, frame.y + frame.h, LINE_STYLE),
    line(h, x - TICK, frame.y, x + TICK, frame.y, LINE_STYLE),
    line(h, x - TICK, frame.y + frame.h, x + TICK, frame.y + frame.h, LINE_STYLE),
    text(h, x + 13, frame.y + frame.h / 2, `${ctx.heightMm} mm`, { ...FONT, rotate: -90 }),
  );
  return out;
}
