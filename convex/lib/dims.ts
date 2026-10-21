import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Millimetre-quantity seam (#73): every mm-in-its-name field across surveys,
 * quotes and logistics goes through here. Convex validators only check types —
 * the bounds convention (inputs.ts) now has its named home for dimensions too.
 *
 * `mm()` today returns plain v.number() (zero runtime delta by construction);
 * `assertMm` is the bound the survey/quote flows call before storing.
 */

/** The physical range a window opening can have, in whole millimetres. */
export const MM_MIN = 0;
/** Largest opening a survey can record (20 m); the quote engine applies its own 200–6000. */
export const MM_MAX = 20_000;

/** Validator for a millimetre field. Types only, exactly like the old bare v.number(). */
export function mm() {
  return v.number();
}

/** A finite whole-mm measure within [min, max]; refuses anything else. */
export function assertMm(n: number | undefined, min = MM_MIN, max = MM_MAX): void {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw new ConvexError("INVALID_INPUT");
  }
}
