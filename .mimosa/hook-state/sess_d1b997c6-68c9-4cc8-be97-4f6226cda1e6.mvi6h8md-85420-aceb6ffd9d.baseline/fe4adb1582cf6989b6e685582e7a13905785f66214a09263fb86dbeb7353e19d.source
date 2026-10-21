// Width of every leaf (anta) in whole millimetres, and what happens to the others when one is typed in.
//
// The pieces store each leaf as a share of the frame width (`widthRatio`). People think in millimetres, so:
//  * `leafWidthsMm` turns the shares into whole millimetres that ALWAYS add up to the frame width (largest-remainder rounding:
//    1000 mm in three leaves is 334 + 333 + 333, never 333 × 3 = 999);
//  * `setLeafWidth` sets one leaf to a typed value; the other leaves share what is left in proportion to their current width,
//    none going under its minimum. A value no arrangement can hold is refused (with the limits), never silently clamped.

export interface LeafWidthLimits {
  min: number;
  max: number;
}

/** Whole-millimetre widths for the given ratios; the sum is exactly `round(width)` (shares are normalised first). */
export function leafWidthsMm(width: number, ratios: number[]): number[] {
  const total = Math.max(0, Math.round(width));
  return apportion(total, ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : 0)), ratios.map(() => 0));
}

/**
 * The minimums that apply. When the frame is too narrow to hold every leaf at its structural minimum (the drawing already flags those
 * leaves in red), no arrangement meets them: typing a width then only keeps every leaf at a sane, positive size (half an equal share)
 * so the proportions can still be corrected.
 */
export function effectiveMins(width: number, mins: number[]): number[] {
  if (mins.reduce((a, b) => a + b, 0) <= Math.round(width)) return mins;
  const floor = Math.max(1, Math.floor(Math.round(width) / mins.length / 2));
  return mins.map((m) => Math.min(m, floor));
}

/** The range a leaf can take: its own minimum up to the frame width minus the minimum of every other leaf. */
export function leafWidthLimits(width: number, rawMins: number[], index: number): LeafWidthLimits {
  const mins = effectiveMins(width, rawMins);
  // A lone leaf fills the frame: its width is the frame width, nothing else.
  if (mins.length === 1) return { min: Math.round(width), max: Math.round(width) };
  const others = mins.reduce((sum, m, i) => (i === index ? sum : sum + m), 0);
  return { min: mins[index] ?? 0, max: Math.max(mins[index] ?? 0, Math.round(width) - others) };
}

export type SetLeafWidth =
  | { ok: true; widthsMm: number[]; ratios: number[] }
  | { ok: false; reason: "range" | "index"; min?: number; max?: number };

/**
 * Leaf `index` gets exactly `mm`; the other leaves share the rest proportionally to their current widths (never under `mins`).
 * `ratios` are the current shares, `mins` the minimum width of each leaf.
 */
export function setLeafWidth(width: number, ratios: number[], rawMins: number[], index: number, mm: number): SetLeafWidth {
  const total = Math.round(width);
  if (!Number.isInteger(index) || index < 0 || index >= ratios.length || rawMins.length !== ratios.length) return { ok: false, reason: "index" };
  const mins = effectiveMins(total, rawMins);
  const limits = leafWidthLimits(total, mins, index);
  if (!Number.isFinite(mm) || !Number.isInteger(mm) || mm < limits.min || mm > limits.max) return { ok: false, reason: "range", ...limits };
  const current = leafWidthsMm(total, ratios);
  const otherIdx = current.map((_, i) => i).filter((i) => i !== index);
  const widthsMm = [...current];
  widthsMm[index] = mm;
  if (otherIdx.length > 0) {
    const shared = apportion(total - mm, otherIdx.map((i) => current[i]), otherIdx.map((i) => mins[i]));
    otherIdx.forEach((i, k) => {
      widthsMm[i] = shared[k];
    });
  }
  return { ok: true, widthsMm, ratios: widthsMm.map((w) => w / total) };
}

/**
 * Splits `amount` (whole mm) over leaves in proportion to `weights`, each at least its `mins` entry, in whole millimetres that add up
 * to `amount` exactly. A leaf that would fall under its minimum is pinned there and the rest is shared again.
 */
function apportion(amount: number, weights: number[], mins: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const out = new Array<number>(n).fill(0);
  const pinned = new Array<boolean>(n).fill(false);
  const allZero = weights.every((w) => !(w > 0));
  const w = weights.map((x) => (allZero ? 1 : Math.max(0, x)));
  const target = new Array<number>(n).fill(0);
  for (let round = 0; round <= n; round++) {
    const free = out.map((_, i) => i).filter((i) => !pinned[i]);
    const left = amount - out.reduce((s, v, i) => (pinned[i] ? s + v : s), 0);
    const wsum = free.reduce((s, i) => s + w[i], 0) || 1;
    free.forEach((i) => {
      target[i] = (left * w[i]) / wsum;
    });
    const under = free.filter((i) => target[i] < mins[i]);
    if (under.length === 0) break;
    under.forEach((i) => {
      pinned[i] = true;
      out[i] = mins[i];
    });
  }
  // Whole millimetres: floor the shared ones, hand the leftover to the largest fractions.
  const free = out.map((_, i) => i).filter((i) => !pinned[i]);
  free.forEach((i) => {
    out[i] = Math.floor(target[i]);
  });
  let remaining = amount - out.reduce((s, v) => s + v, 0);
  const byFraction = [...free].sort((a, b) => target[b] - Math.floor(target[b]) - (target[a] - Math.floor(target[a])) || a - b);
  for (let k = 0; remaining > 0 && byFraction.length > 0; k = (k + 1) % byFraction.length) {
    out[byFraction[k]] += 1;
    remaining -= 1;
  }
  return out;
}
