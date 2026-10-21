import { inactiveLeaves, normalizedRatios, violationsFor, type EditorSash } from "@/shared/sash-rules";
import { accessoryRightExtent, drawAccessories } from "./build-accessories";
import { drawDimensions } from "./build-dimensions";
import { drawLeaves, drawMullions, drawTransoms, hitRects, layoutCells } from "./build-sashes";
import { normalizeTransoms } from "@/shared/transoms";
import { glazingShape } from "@/shared/glazing-packages";
import { darken, finishStyle, PALETTE, TEXTURE_TILE } from "./finishes";
import { boundsOf, mirror, place, rect } from "./prims";
import type { DrawingInput, DrawingOptions, DrawingSash, Primitive, Scene, SceneContext, SceneTexture } from "./types";

const FIT_W = 300;
const FIT_H = 280;
const PAD = 10;
const FRAME_MM = 45;
const SASH_MM = 25;
const RENO_MM: Record<string, number> = { reno40: 40, reno65: 65 };

/** The frame colour: the catalogue finish when it is known (colour, texture), else the built-in table by key. */
function finishFor(input: DrawingInput): SceneContext["finish"] {
  const f = input.finishFill;
  if (f && /^#[0-9a-f]{6}$/i.test(f.hex)) return { fill: f.hex, stroke: darken(f.hex, 0.4), strokeWidth: 1.5 };
  return finishStyle(input.finish);
}

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
export function buildScene(rawInput: DrawingInput, options: DrawingOptions = {}): Scene {
  // Bicolour: each face shows its own finish — the inside view (default) the inside one, the outside view the outside one.
  const input: DrawingInput =
    rawInput.finishInside && options.view !== "outside"
      ? { ...rawInput, finish: rawInput.finishInside, finishFill: rawInput.finishFillInside }
      : rawInput;
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

  const transoms = normalizeTransoms(heightMm, input.transomsMm);

  const ctx: SceneContext = {
    glassHeightMm: heightMm,
    pieceTransoms: transoms,
    scale,
    widthMm,
    heightMm,
    category: input.category,
    frame: { x: 0, y: 0, w: frameW, h: frameH },
    inner: { x: frameInset, y: frameInset, w: Math.max(1, frameW - 2 * frameInset), h: Math.max(1, frameH - 2 * frameInset) },
    frameInset,
    sashInset,
    band: reno ? Math.max(4, reno * scale) : 0,
    finish: finishFor(input),
    textures: [],
    options,
    handles: [],
    noHandle: inactiveLeaves(sashes),
    glazingKind: glazingShape(input.glazing).kind,
    satin: glazingShape(input.glazing).composition?.layers.includes("satin") ?? false,
    dimBoxes: {},
    leafDimBoxes: [],
  };

  const textures: SceneTexture[] = [];
  const tex = input.finishFill?.texture;
  if (tex && input.finishFill && ctx.finish.fill === input.finishFill.hex) {
    const id = `os-tex-${tex.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
    textures.push({ id, href: tex.href, w: TEXTURE_TILE, h: Math.round((TEXTURE_TILE * tex.h) / Math.max(1, tex.w)), fallback: input.finishFill.hex });
    ctx.finish = { ...ctx.finish, fill: `url(#${id})` };
  }

  const cells = layoutCells(ctx, ratios);
  const violated = new Set<number>();
  const tooNarrow = new Set<number>();
  if (options.showViolations) {
    const host = {
      width: widthMm,
      height: heightMm,
      sashes: sashes.map((s) => ({ ...s, hardware: "", hardwareColor: s.hardwareColor ?? "silver" })),
    };
    for (const v of violationsFor(host)) {
      violated.add(v.sashIndex);
      if (v.axis === "width") tooNarrow.add(v.sashIndex);
    }
  }

  const leaves = drawLeaves(ctx, sashes, cells, violated);
  const raw: Primitive[] = [
    ...frameLayers(ctx, input.frameType),
    ...leaves.filter((p) => p.role !== "handle"),
    ...drawMullions(ctx, sashes, cells),
    ...drawTransoms(ctx, sashes, cells),
    // Handles stay on top of the mullions standing next to them.
    ...leaves.filter((p) => p.role === "handle"),
    ...drawAccessories(ctx, input.accessories, leaves),
  ];
  if (options.showDimensions !== false) {
    raw.push(...drawDimensions(ctx, cells, accessoryRightExtent(ctx, input.accessories), tooNarrow));
  }
  raw.push(...hitRects(cells));
  // Handle hit areas sit above the leaf ones so a handle can be grabbed (a little larger than the symbol).
  for (const hnd of ctx.handles ?? []) {
    raw.push(rect({ role: "hit", sashIndex: hnd.sashIndex, part: "handle" }, hnd.x - 3, hnd.y - 2, hnd.w + 6, hnd.h + 4, { fill: "transparent" }));
  }

  const b = boundsOf(raw);
  const dx = PAD - b.minX;
  const dy = PAD - b.minY;
  const shiftBox = <T extends { x: number; y: number }>(box: T): T => ({ ...box, x: box.x + dx, y: box.y + dy });
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const roundBox = <T extends { x: number; y: number; w: number; h: number }>(box: T): T => {
    const s = shiftBox(box);
    return { ...s, x: r3(s.x), y: r3(s.y), w: r3(s.w), h: r3(s.h) };
  };

  const W = r3(b.maxX - b.minX + 2 * PAD);
  const outside = options.view === "outside";
  // Seen from outside: the mirror image, and the handles (an inside part) are not visible.
  const placed = raw
    .filter((p) => !outside || (p.role !== "handle" && p.role !== "handleGuide"))
    .map((p) => place(p, dx, dy))
    .map((p) => (outside ? mirror(p, W) : p));
  const mx = (x: number, w = 0) => (outside ? r3(W - x - w) : x);
  const mirroredBox = <T extends { x: number; w: number }>(box: T): T => ({ ...box, x: mx(box.x, box.w) });
  return {
    viewBox: { w: W, h: r3(b.maxY - b.minY + 2 * PAD) },
    ...(textures.length > 0 ? { defs: { textures } } : {}),
    primitives: placed,
    meta: {
      view: outside ? "outside" : "inside",
      dimensions: {
        ...(ctx.dimBoxes?.width ? { width: mirroredBox(roundBox(ctx.dimBoxes.width)) } : {}),
        ...(ctx.dimBoxes?.height ? { height: mirroredBox(roundBox(ctx.dimBoxes.height)) } : {}),
      },
      ...(options.showLeafDimensions && options.showDimensions !== false && (ctx.leafDimBoxes ?? []).length > 0
        ? { leafDimensions: (ctx.leafDimBoxes ?? []).map((b) => ({ ...mirroredBox(roundBox(b)), sashIndex: b.sashIndex })) }
        : {}),
      handles: outside
        ? []
        : (ctx.handles ?? []).map((hnd) => ({
            ...hnd,
            x: r3(hnd.x + dx),
            y: r3(hnd.y + dy),
            w: r3(hnd.w),
            h: r3(hnd.h),
            axisY: r3(hnd.axisY + dy),
            minY: r3(hnd.minY + dy),
            maxY: r3(hnd.maxY + dy),
          })),
      scale,
      widthMm,
      heightMm,
      frame: mirroredBox(roundBox(ctx.frame)),
      inner: mirroredBox(roundBox(ctx.inner)),
      sashInset: r3(sashInset),
      cells: cells.map((c) => {
        const box = roundBox(c);
        return { ...box, x: mx(box.x, box.w), sashIndex: c.sashIndex, mm: c.mm };
      }),
      ratios,
      dividers: cells.slice(1).map((c) => mx(r3(c.x + dx))),
      sashTypes: sashes.map((s) => s.type),
    },
  };
}
