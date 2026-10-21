import { PALETTE } from "./finishes";
import { line, text } from "./prims";
import type { Primitive, SceneCell, SceneContext } from "./types";

const TICK = 4;
const LINE_STYLE: { stroke: string; strokeWidth: number } = { stroke: PALETTE.dimLine, strokeWidth: 0.8 };
const FONT = { fontSize: 10, fill: PALETTE.dim, weight: "bold" as const };
const BAD_LINE: { stroke: string; strokeWidth: number } = { stroke: PALETTE.danger, strokeWidth: 1.2 };
const BAD_FONT = { ...FONT, fill: PALETTE.danger };

function horizontal(tag: { role: "dimension" | "leafLabel"; sashIndex?: number; part?: string }, x1: number, x2: number, y: number, style = LINE_STYLE): Primitive[] {
  return [
    line(tag, x1, y, x2, y, style),
    line(tag, x1, y - TICK, x1, y + TICK, style),
    line(tag, x2, y - TICK, x2, y + TICK, style),
  ];
}

/**
 * Overall width (below) and height (right) dimension lines, plus an optional
 * per-leaf width chain above the overall row. `rightClear` keeps the height
 * line outside accessories that flank the frame.
 */
export function drawDimensions(ctx: SceneContext, cells: SceneCell[], rightClear: number, tooNarrow: ReadonlySet<number> = new Set()): Primitive[] {
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
      const bad = tooNarrow.has(i);
      const label = `${c.mm}`;
      out.push(...horizontal(tag, a, b, rowY, bad ? BAD_LINE : LINE_STYLE), text(tag, (a + b) / 2, rowY + 12, label, { ...(bad ? BAD_FONT : FONT), fontSize: 9 }));
      // A comfortable target to click or tap, wider than the digits (and never wider than the leaf itself).
      const len = Math.max(label.length * 9 * 0.6, 22);
      const boxW = Math.min(len + 10, Math.max(22, b - a));
      // A lone leaf IS the frame: its width is edited on the overall label.
      if (cells.length > 1) ctx.leafDimBoxes?.push({ sashIndex: i, x: (a + b) / 2 - boxW / 2, y: rowY + 12 - 9 - 3, w: boxW, h: 9 + 10 });
    });
    rowY += 28;
  }

  const w = { role: "dimension" as const, part: "width" };
  const widthLabel = `${ctx.widthMm} mm`;
  const badW = options.invalidAxes?.width === true;
  out.push(...horizontal(w, frame.x, frame.x + frame.w, rowY, badW ? BAD_LINE : LINE_STYLE), text(w, frame.x + frame.w / 2, rowY + 14, widthLabel, badW ? BAD_FONT : FONT));
  const wLen = widthLabel.length * FONT.fontSize * 0.6;
  if (ctx.dimBoxes) ctx.dimBoxes.width = { x: frame.x + frame.w / 2 - wLen / 2 - 4, y: rowY + 14 - FONT.fontSize - 2, w: wLen + 8, h: FONT.fontSize + 8 };

  const h = { role: "dimension" as const, part: "height" };
  const x = frame.x + frame.w + Math.max(band, rightClear) + 14;
  const heightLabel = `${ctx.heightMm} mm`;
  const hLen = heightLabel.length * FONT.fontSize * 0.6;
  if (ctx.dimBoxes) ctx.dimBoxes.height = { x: x + 13 - FONT.fontSize - 2, y: frame.y + frame.h / 2 - hLen / 2 - 4, w: FONT.fontSize + 8, h: hLen + 8 };
  const badH = options.invalidAxes?.height === true;
  const hs = badH ? BAD_LINE : LINE_STYLE;
  out.push(
    line(h, x, frame.y, x, frame.y + frame.h, hs),
    line(h, x - TICK, frame.y, x + TICK, frame.y, hs),
    line(h, x - TICK, frame.y + frame.h, x + TICK, frame.y + frame.h, hs),
    text(h, x + 13, frame.y + frame.h / 2, heightLabel, { ...(badH ? BAD_FONT : FONT), rotate: -90 }),
  );
  return out;
}
