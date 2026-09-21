import { normalizedRatios, violationsFor, type EditorSash } from "@/shared/sash-rules";
import { accessoryRightExtent, drawAccessories } from "./build-accessories";
import { drawDimensions } from "./build-dimensions";
import { drawLeaves, hitRects, layoutCells } from "./build-sashes";
import { finishStyle, PALETTE } from "./finishes";
import { boundsOf, place, rect } from "./prims";
import type { DrawingInput, DrawingOptions, DrawingSash, Primitive, Scene, SceneContext } from "./types";

const FIT_W = 300;
const FIT_H = 280;
const PAD = 10;
const FRAME_MM = 45;
const SASH_MM = 25;
const RENO_MM: Record<string, number> = { reno40: 40, reno65: 65 };

const positive = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);

function scaleFor(widthMm: number, heightMm: number, options: DrawingOptions): number {
  if (options.mmPerUnit && options.mmPerUnit > 0) return 1 / options.mmPerUnit;
  return Math.min(FIT_W / widthMm, FIT_H / heightMm);
}

function frameLayers(ctx: SceneContext, frameType: string | undefined): Primitive[] {
  const { frame, inner, finish, band } = ctx;
  const out: Primitive[] = [];
  const reno = frameType ? RENO_MM[frameType] : undefined;
  if (reno && band > 0) {
    out.push(
      rect({ role: "frameOuter", part: frameType }, -band, -band, frame.w + 2 * band, frame.h + 2 * band, {
        fill: reno === 65 ? PALETTE.band65 : PALETTE.band40,
        stroke: PALETTE.bandStroke,
        strokeWidth: 0.8,
      }),
    );
  }
  out.push(
    rect({ role: "frame" }, frame.x, frame.y, frame.w, frame.h, {
      fill: finish.fill,
      stroke: finish.stroke,
      strokeWidth: finish.strokeWidth,
      radius: 1.5,
    }),
    rect({ role: "frame", part: "inner" }, inner.x, inner.y, inner.w, inner.h, { stroke: PALETTE.outline, strokeWidth: 0.9 }),
  );
  return out;
}

/** Pure, deterministic drawing geometry shared by the DOM and PDF renderers. */
export function buildScene(input: DrawingInput, options: DrawingOptions = {}): Scene {
  const widthMm = positive(input.widthMm, 1000);
  const heightMm = positive(input.heightMm, 1000);
  const sashes: DrawingSash[] = input.sashes.length > 0 ? input.sashes : [{ type: "fix", direction: "left", active: true }];
  const ratios = normalizedRatios(sashes as unknown as EditorSash[]);

  const scale = scaleFor(widthMm, heightMm, options);
  const frameW = widthMm * scale;
  const frameH = heightMm * scale;
  const frameInset = Math.max(3, FRAME_MM * scale);
  const sashInset = Math.max(2.5, SASH_MM * scale);
  const reno = input.frameType ? RENO_MM[input.frameType] : undefined;

  const ctx: SceneContext = {
    scale,
    widthMm,
    heightMm,
    category: input.category,
    frame: { x: 0, y: 0, w: frameW, h: frameH },
    inner: { x: frameInset, y: frameInset, w: Math.max(1, frameW - 2 * frameInset), h: Math.max(1, frameH - 2 * frameInset) },
    frameInset,
    sashInset,
    band: reno ? Math.max(4, reno * scale) : 0,
    finish: finishStyle(input.finish),
    options,
  };

  const cells = layoutCells(ctx, ratios);
  const violated = new Set<number>();
  if (options.showViolations) {
    const host = {
      width: widthMm,
      height: heightMm,
      sashes: sashes.map((s) => ({ ...s, hardware: "", hardwareColor: s.hardwareColor ?? "silver" })),
    };
    for (const v of violationsFor(host)) violated.add(v.sashIndex);
  }

  const leaves = drawLeaves(ctx, sashes, cells, violated);
  const raw: Primitive[] = [
    ...frameLayers(ctx, input.frameType),
    ...leaves,
    ...drawAccessories(ctx, input.accessories, leaves),
  ];
  if (options.showDimensions !== false) {
    raw.push(...drawDimensions(ctx, cells, accessoryRightExtent(ctx, input.accessories)));
  }
  raw.push(...hitRects(cells));

  const b = boundsOf(raw);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const shiftBox = <T extends { x: number; y: number }>(box: T): T => ({ ...box, x: box.x + dx, y: box.y + dy });
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const roundBox = <T extends { x: number; y: number; w: number; h: number }>(box: T): T => {
    const s = shiftBox(box);
    return { ...s, x: r3(s.x), y: r3(s.y), w: r3(s.w), h: r3(s.h) };
  };

  return {
    viewBox: { w: r3(b.maxX - b.minX + 2 * PAD), h: r3(b.maxY - b.minY + 2 * PAD) },
    primitives: raw.map((p) => place(p, dx, dy)),
    meta: {
      scale,
      widthMm,
      heightMm,
      frame: roundBox(ctx.frame),
      inner: roundBox(ctx.inner),
      sashInset: r3(sashInset),
      cells: cells.map((c) => ({ ...roundBox(c), sashIndex: c.sashIndex, mm: c.mm })),
      ratios,
      dividers: cells.slice(1).map((c) => r3(c.x + dx)),
      sashTypes: sashes.map((s) => s.type),
    },
  };
}
