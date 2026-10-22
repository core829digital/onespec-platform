import { ConvexError, v } from "convex/values";

/**
 * Millimetre fields. Convex validators check types only, the bounds live in code (see lib/inputs.ts):
 * `mm()` names a dimension in an args or schema shape, `assertMm` is the one place its range is checked.
 */
export function mm() {
  return v.number();
}

/** A finite length within [min, max] mm, returned in whole millimetres; INVALID_INPUT otherwise. */
export function assertMm(n: number, min: number, max: number): number {
  if (!Number.isFinite(n) || n < min || n > max) throw new ConvexError("INVALID_INPUT");
  return Math.round(n);
}
