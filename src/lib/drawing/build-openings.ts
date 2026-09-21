import { hardwareFill, PALETTE } from "./finishes";
import { clamp, line, poly, rect, text, type Tag } from "./prims";
import type { Box, DrawingSash, Primitive, SceneCell, SceneContext } from "./types";

const HANDLE_LONG = 16;
const HANDLE_SHORT = 5;
const SYMBOL = { stroke: PALETTE.ink, strokeWidth: 1.1 };

/** Where the handle sits: hinged leaves opposite the hinge, sliding leaves on the leading edge. */
function handleSide(s: DrawingSash): "left" | "right" {
  const sliding = s.type === "sliding" || s.type === "liftslide";
  if (sliding) return s.direction;
  return s.direction === "left" ? "right" : "left";
}

// DIN 1356: the two legs of the casement triangle converge on the HINGE side.
function casementSymbol(area: Box, hingeLeft: boolean, tag: Tag): Primitive[] {
  const apexX = hingeLeft ? area.x : area.x + area.w;
  const farX = hingeLeft ? area.x + area.w : area.x;
  const midY = area.y + area.h / 2;
  return [
    line(tag, farX, area.y, apexX, midY, SYMBOL),
    line(tag, farX, area.y + area.h, apexX, midY, SYMBOL),
  ];
}

function tiltSymbol(area: Box, tag: Tag): Primitive[] {
  const cx = area.x + area.w / 2;
  const s = { stroke: PALETTE.ink, strokeWidth: 1.3 };
  return [
    line(tag, area.x, area.y + area.h, cx, area.y, s),
    line(tag, area.x + area.w, area.y + area.h, cx, area.y, s),
  ];
}

function slidingSymbol(ctx: SceneContext, s: DrawingSash, cell: SceneCell, area: Box, i: number): Primitive[] {
  const out: Primitive[] = [];
  const arrow = { role: "opening" as const, sashIndex: i, part: "slideArrow" };
  const rail = { role: "opening" as const, sashIndex: i, part: "rail" };
  const midY = area.y + area.h / 2;
  const pad = clamp(area.w * 0.12, 6, 14);
  const x1 = area.x + pad;
  const x2 = area.x + area.w - pad;
  if (x2 - x1 > 12) {
    const tipLeft = s.direction === "left";
    const tip = tipLeft ? x1 : x2;
    const tail = tipLeft ? x2 : x1;
    const back = tipLeft ? tip + 6 : tip - 6;
    out.push(
      line(arrow, tail, midY, tip, midY, { stroke: PALETTE.ink, strokeWidth: 1.4 }),
      poly(arrow, [[tip, midY], [back, midY - 4], [back, midY + 4]], { fill: PALETTE.ink }),
    );
  }
  const railY = cell.y + cell.h - ctx.sashInset / 2;
  const railStyle = { stroke: PALETTE.dimLine, strokeWidth: 2.4 };
  out.push(line(rail, cell.x + ctx.sashInset, railY, cell.x + cell.w - ctx.sashInset, railY, railStyle));
  if (s.type === "liftslide") {
    out.push(line(rail, cell.x + ctx.sashInset, railY - 3.5, cell.x + cell.w - ctx.sashInset, railY - 3.5, { ...railStyle, strokeWidth: 1 }));
    const cx = area.x + area.w / 2;
    const ly = midY - 14;
    out.push(
      poly({ role: "opening", sashIndex: i, part: "lift" }, [[cx, ly - 5], [cx - 4, ly + 1], [cx + 4, ly + 1]], { fill: PALETTE.ink }),
      line({ role: "opening", sashIndex: i, part: "lift" }, cx, ly + 1, cx, ly + 7, { stroke: PALETTE.ink, strokeWidth: 1.2 }),
    );
  }
  return out;
}

function hingesFor(ctx: SceneContext, s: DrawingSash, cell: SceneCell, i: number): Primitive[] {
  if ((s.type !== "classic" && s.type !== "tiltturn") || cell.h < 60) return [];
  const cx = s.direction === "left" ? cell.x + ctx.sashInset / 2 : cell.x + cell.w - ctx.sashInset / 2;
  const tag = { role: "hinge" as const, sashIndex: i };
  return [0.2, 0.7].map((f) => rect(tag, cx - 2, cell.y + cell.h * f, 4, 10, { fill: PALETTE.hinge, radius: 0.8 }));
}

function handleFor(ctx: SceneContext, s: DrawingSash, cell: SceneCell, i: number): { prims: Primitive[]; hy: number | null } {
  const tag = { role: "handle" as const, sashIndex: i };
  const style = { fill: hardwareFill(s.hardwareColor), stroke: PALETTE.hinge, strokeWidth: 0.8, radius: 1.5 };
  if (s.type === "tilt") {
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + ctx.sashInset / 2;
    return { prims: [rect(tag, cx - HANDLE_LONG / 2, cy - HANDLE_SHORT / 2, HANDLE_LONG, HANDLE_SHORT, style)], hy: null };
  }
  const mm = s.handleHeightMm && s.handleHeightMm > 0 ? s.handleHeightMm : ctx.heightMm / 2;
  const sill = ctx.frame.y + ctx.frame.h;
  const hy = clamp(
    sill - mm * ctx.scale,
    cell.y + ctx.sashInset + HANDLE_LONG / 2 + 2,
    cell.y + cell.h - ctx.sashInset - HANDLE_LONG / 2 - 2,
  );
  const cx = handleSide(s) === "left" ? cell.x + ctx.sashInset / 2 : cell.x + cell.w - ctx.sashInset / 2;
  return {
    prims: [rect(tag, cx - HANDLE_SHORT / 2, hy - HANDLE_LONG / 2, HANDLE_SHORT, HANDLE_LONG, style)],
    hy,
  };
}

function guideFor(ctx: SceneContext, cell: SceneCell, hy: number, i: number): Primitive[] {
  const tag = { role: "handleGuide" as const, sashIndex: i };
  const gx = cell.x + cell.w / 2;
  const bottom = cell.y + cell.h;
  const mm = Math.round((ctx.frame.y + ctx.frame.h - hy) / ctx.scale);
  const s = { stroke: PALETTE.guide, strokeWidth: 1.1, dash: "4 3" };
  return [
    line(tag, gx, bottom, gx, hy, s),
    line(tag, gx - 5, hy, gx + 5, hy, { stroke: PALETTE.guide, strokeWidth: 1.1 }),
    text(tag, gx + 7, hy - 3, `${mm} mm`, { fontSize: 8, fill: PALETTE.guide, anchor: "start", weight: "bold" }),
  ];
}

/** Opening symbol, hinges, handle and handle guide for one active, non-panel leaf. */
export function drawOpening(ctx: SceneContext, s: DrawingSash, i: number, cell: SceneCell, area: Box): Primitive[] {
  const out: Primitive[] = [];
  const tagOf = (part: string): Tag => ({ role: "opening", sashIndex: i, part });
  switch (s.type) {
    case "classic":
      out.push(...casementSymbol(area, s.direction === "left", tagOf("casement")));
      break;
    case "tiltturn":
      out.push(...casementSymbol(area, s.direction === "left", tagOf("casement")), ...tiltSymbol(area, tagOf("tilt")));
      break;
    case "tilt":
      out.push(...tiltSymbol(area, tagOf("tilt")));
      break;
    case "sliding":
    case "liftslide":
      out.push(...slidingSymbol(ctx, s, cell, area, i));
      break;
    case "fix":
      return out;
  }
  out.push(...hingesFor(ctx, s, cell, i));
  const handle = handleFor(ctx, s, cell, i);
  out.push(...handle.prims);
  const mode = ctx.options.handleGuide ?? "none";
  const wanted = mode === "all" || (mode === "selected" && ctx.options.selectedSash === i);
  if (wanted && handle.hy !== null) out.push(...guideFor(ctx, cell, handle.hy, i));
  return out;
}
