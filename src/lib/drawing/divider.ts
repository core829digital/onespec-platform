import { SASH_MIN } from "@/shared/sash-rules";
import { clamp } from "./prims";
import type { SceneMeta } from "./types";

/**
 * New absolute width ratio (share of the whole frame width, 0..1) of the leaf
 * left of divider `index`, for a pointer at drawing-space `x`. The leaf to the
 * right absorbs the difference, so the pair keeps its combined ratio. Both
 * leaves stay at or above their SASH_MIN width. `ratios` is the snapshot taken
 * when the drag started.
 */
export function resolveDividerRatio(meta: SceneMeta, ratios: number[], index: number, x: number): number {
  const frac = (x - meta.inner.x) / meta.inner.w;
  const before = ratios.slice(0, index).reduce((a, b) => a + b, 0);
  const pair = ratios[index] + ratios[index + 1];
  const minLeft = SASH_MIN[meta.sashTypes[index]].w / meta.widthMm;
  const minRight = SASH_MIN[meta.sashTypes[index + 1]].w / meta.widthMm;
  return clamp(frac - before, minLeft, Math.max(minLeft, pair - minRight));
}
