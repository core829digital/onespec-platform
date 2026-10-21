import { PALETTE } from "./finishes";
import { clamp, line, rect } from "./prims";
import type { ItemAccessories, Primitive, RectPrimitive, SceneContext } from "./types";

const DEFAULT_BOX_MM = 150;
const PERS_GAP = 3;

const tag = (part: string) => ({ role: "accessory" as const, part });

const sizeMm = (v: number | undefined, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback);

/** Shutter-box depth: the trailing number of the catalogue key ('rehau150' -> 150 mm) when plausible. */
function boxMm(key: string | undefined): number {
  const m = key ? /(\d{2,3})$/.exec(key) : null;
  const mm = m ? Number(m[1]) : NaN;
  return mm >= 60 && mm <= 300 ? mm : DEFAULT_BOX_MM;
}

/** Shutter box above the window; drawn when a box (cass) or roller shutter (avv) is present. */
function shutterBox(ctx: SceneContext, acc: ItemAccessories): Primitive[] {
  const boxW = sizeMm(acc.width, ctx.widthMm) * ctx.scale;
  const boxH = Math.max(8, boxMm(acc.cass) * ctx.scale);
  const x = (ctx.frame.w - boxW) / 2;
  const y = -ctx.band - boxH;
  return [
    rect(tag("box"), x, y, boxW, boxH, { fill: PALETTE.accessoryFill, stroke: PALETTE.accessory, strokeWidth: 1, radius: 2 }),
    rect(tag("boxInner"), x + 3, y + 3, Math.max(1, boxW - 6), Math.max(1, boxH - 6), { stroke: "#9CA3AF", strokeWidth: 0.7, radius: 2 }),
  ];
}

/** Roller-shutter slats lowered over the opening at low opacity. */
function rollerSlats(ctx: SceneContext, acc: ItemAccessories): Primitive[] {
  const { inner, scale } = ctx;
  const cover = clamp(sizeMm(acc.height, ctx.heightMm) * scale, 0, inner.h);
  const pitch = Math.max(4, 40 * scale);
  const out: Primitive[] = [];
  for (let y = inner.y + pitch / 2; y < inner.y + cover - 1; y += pitch) {
    out.push(line(tag("slat"), inner.x, y, inner.x + inner.w, y, { stroke: PALETTE.outline, strokeWidth: 0.9, opacity: 0.35 }));
  }
  out.push(rect(tag("slatRail"), inner.x, inner.y + cover - 3, inner.w, 3, { fill: PALETTE.accessory, opacity: 0.5 }));
  return out;
}

export function persWidth(ctx: SceneContext, acc: ItemAccessories): number {
  return clamp(sizeMm(acc.width, ctx.widthMm) * ctx.scale * 0.15, 12, 60);
}

/** Two aluminium louvre panels flanking the frame. */
function louvres(ctx: SceneContext, acc: ItemAccessories): Primitive[] {
  const w = persWidth(ctx, acc);
  const h = sizeMm(acc.height, ctx.heightMm) * ctx.scale;
  const pitch = Math.max(3.5, 30 * ctx.scale);
  const xs = [-ctx.band - PERS_GAP - w, ctx.frame.w + ctx.band + PERS_GAP];
  const out: Primitive[] = [];
  for (const x of xs) {
    out.push(rect(tag("pers"), x, 0, w, h, { fill: "#E5E7EB", stroke: PALETTE.accessory, strokeWidth: 1 }));
    for (let y = pitch; y < h - 1; y += pitch) {
      out.push(line(tag("persSlat"), x + 1.5, y, x + w - 1.5, y, { stroke: PALETTE.accessory, strokeWidth: 0.6, opacity: 0.8 }));
    }
  }
  return out;
}

/** Fine cross-hatch over every glazed rectangle. */
function insectScreen(glass: RectPrimitive[]): Primitive[] {
  const out: Primitive[] = [];
  for (const g of glass) {
    const step = Math.max(6, g.w / 40, g.h / 60);
    const style = { stroke: PALETTE.ink, strokeWidth: 0.4, opacity: 0.25 };
    const t = { ...tag("screen"), sashIndex: g.sashIndex };
    for (let x = g.x + step; x < g.x + g.w - 0.5; x += step) out.push(line(t, x, g.y, x, g.y + g.h, style));
    for (let y = g.y + step; y < g.y + g.h - 0.5; y += step) out.push(line(t, g.x, y, g.x + g.w, y, style));
  }
  return out;
}

export function drawAccessories(ctx: SceneContext, acc: ItemAccessories | undefined, leafPrims: Primitive[]): Primitive[] {
  if (!acc) return [];
  const out: Primitive[] = [];
  if (acc.cass || acc.avv) out.push(...shutterBox(ctx, acc));
  if (acc.avv) out.push(...rollerSlats(ctx, acc));
  if (acc.pers) out.push(...louvres(ctx, acc));
  if (acc.zanz) {
    const glass = leafPrims.filter((p): p is RectPrimitive => p.type === "rect" && p.role === "glass");
    out.push(...insectScreen(glass));
  }
  return out;
}

/** Extra space the accessories take to the right of the frame (used to clear the height dimension). */
export function accessoryRightExtent(ctx: SceneContext, acc: ItemAccessories | undefined): number {
  return acc?.pers ? persWidth(ctx, acc) + PERS_GAP : 0;
}
