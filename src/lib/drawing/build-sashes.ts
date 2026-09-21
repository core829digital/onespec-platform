import { drawOpening } from "./build-openings";
import { PALETTE } from "./finishes";
import { circle, hatchSegments, line, rect, text } from "./prims";
import type { Box, DrawingSash, Primitive, SceneCell, SceneContext } from "./types";

const DOOR_PANEL_SHARE = 0.55;

/** Split the inner opening into leaf cells; the last cell ends exactly on the opening edge. */
export function layoutCells(ctx: SceneContext, ratios: number[]): SceneCell[] {
  const { inner } = ctx;
  const cells: SceneCell[] = [];
  let x = inner.x;
  ratios.forEach((r, i) => {
    const isLast = i === ratios.length - 1;
    const w = isLast ? inner.x + inner.w - x : r * inner.w;
    cells.push({ sashIndex: i, x, y: inner.y, w, h: inner.h, mm: Math.round(ctx.widthMm * r) });
    x += w;
  });
  return cells;
}

function drawPanel(ctx: SceneContext, area: Box, i: number, cross: boolean): Primitive[] {
  const tag = { role: "panel" as const, sashIndex: i };
  const out: Primitive[] = [
    rect(tag, area.x, area.y, area.w, area.h, { fill: ctx.finish.fill, stroke: PALETTE.outline, strokeWidth: 0.9 }),
  ];
  const m = Math.min(6, area.w / 4, area.h / 4);
  const moulding = { role: "panel" as const, sashIndex: i, part: "moulding" };
  const soft = { stroke: PALETTE.dimLine, strokeWidth: 0.8, opacity: 0.55 };
  out.push(rect(moulding, area.x + m, area.y + m, Math.max(1, area.w - 2 * m), Math.max(1, area.h - 2 * m), soft));
  if (cross) {
    out.push(
      line(moulding, area.x + m, area.y + area.h / 2, area.x + area.w - m, area.y + area.h / 2, soft),
      line(moulding, area.x + area.w / 2, area.y + m, area.x + area.w / 2, area.y + area.h - m, soft),
    );
  }
  return out;
}

function drawBadge(ctx: SceneContext, cell: SceneCell, i: number): Primitive[] {
  const label = ctx.options.mainLabel ?? "PRINCIPALE";
  const fontSize = 7.5;
  const w = label.length * fontSize * 0.66 + 8;
  if (cell.w < w + 2 * ctx.sashInset + 4) return [];
  const x = cell.x + ctx.sashInset + 3;
  const y = cell.y + ctx.sashInset + 3;
  const tag = { role: "badge" as const, sashIndex: i };
  return [
    rect(tag, x, y, w, 13, { fill: PALETTE.guide, stroke: "#FFFFFF", strokeWidth: 1, radius: 4 }),
    text(tag, x + w / 2, y + 9.5, label, { fontSize, fill: "#FFFFFF", weight: "bold" }),
  ];
}

function drawViolation(cell: SceneCell, i: number): Primitive[] {
  const tag = { role: "warning" as const, sashIndex: i };
  return [
    rect(tag, cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2, { stroke: PALETTE.danger, strokeWidth: 1.8, dash: "5 3" }),
    circle(tag, cell.x + cell.w - 11, cell.y + 11, 8, { fill: PALETTE.danger }),
    text(tag, cell.x + cell.w - 11, cell.y + 14.5, "!", { fontSize: 10, fill: "#FFFFFF", weight: "bold" }),
  ];
}

export function drawLeaves(
  ctx: SceneContext,
  sashes: DrawingSash[],
  cells: SceneCell[],
  violated: Set<number>,
): Primitive[] {
  const out: Primitive[] = [];
  const { finish, sashInset: inset, category, options } = ctx;

  cells.forEach((cell, i) => {
    const s = sashes[i];
    const tag = { role: "sashOutline" as const, sashIndex: i };
    out.push(rect(tag, cell.x, cell.y, cell.w, cell.h, { fill: finish.fill, stroke: PALETTE.outline, strokeWidth: 0.9 }));

    const area: Box = {
      x: cell.x + inset,
      y: cell.y + inset,
      w: Math.max(1, cell.w - 2 * inset),
      h: Math.max(1, cell.h - 2 * inset),
    };

    if (category === "pannello") {
      out.push(...drawPanel(ctx, area, i, true));
    } else {
      const isDoor = category === "porta";
      const glass: Box = isDoor
        ? { ...area, h: Math.max(1, area.h * (1 - DOOR_PANEL_SHARE) - inset) }
        : area;
      out.push(
        rect({ role: "glass", sashIndex: i, part: s.active ? undefined : "inactive" }, glass.x, glass.y, glass.w, glass.h, {
          fill: PALETTE.glass,
          stroke: PALETTE.ink,
          strokeWidth: 0.8,
          opacity: s.active ? undefined : 0.55,
        }),
      );
      if (isDoor) {
        const panelY = area.y + area.h * (1 - DOOR_PANEL_SHARE);
        out.push(...drawPanel(ctx, { x: area.x, y: panelY, w: area.w, h: area.y + area.h - panelY }, i, false));
      }
      if (!s.active) {
        for (const [x1, y1, x2, y2] of hatchSegments(glass.x, glass.y, glass.w, glass.h, 9)) {
          out.push(line({ role: "hatch", sashIndex: i }, x1, y1, x2, y2, { stroke: PALETTE.hatch, strokeWidth: 0.8, opacity: 0.6 }));
        }
      } else {
        out.push(...drawOpening(ctx, s, i, cell, isDoor ? area : glass));
      }
    }

    if (category === "scorrevole") {
      const y = cell.y + inset / 2;
      out.push(line({ role: "opening", sashIndex: i, part: "track" }, cell.x + inset, y, cell.x + cell.w - inset, y, { stroke: PALETTE.dimLine, strokeWidth: 1.6 }));
    }

    if (options.showMainBadge && s.main && s.active) out.push(...drawBadge(ctx, cell, i));
    if (violated.has(i)) out.push(...drawViolation(cell, i));
    else if (options.selectedSash === i) {
      out.push(rect({ role: "selection", sashIndex: i }, cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4, { stroke: PALETTE.guide, strokeWidth: 1.8, dash: "4 3" }));
    }
  });
  return out;
}

export function hitRects(cells: SceneCell[]): Primitive[] {
  return cells.map((c) => rect({ role: "hit", sashIndex: c.sashIndex }, c.x, c.y, c.w, c.h, { fill: "transparent" }));
}
