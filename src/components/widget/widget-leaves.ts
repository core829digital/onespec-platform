// Changing how many leaves a widget piece has: the same rules wherever it is done (the form, the 3D menu).
import { normalizedRatios, typeForAddedSash } from "@/shared/sash-rules";
import { SASH_MAX, SASH_MIN, SINGLE_SASH_MAX_HEIGHT, SINGLE_SASH_MAX_WIDTH, clamp, dimMin, type ConfigState, type SashType } from "./widget-pricing";

export function withSashCount(s: ConfigState, raw: number): ConfigState {
  const n = clamp(Math.round(raw), SASH_MIN, SASH_MAX);
  let sashes = s.sashes.slice();
  if (n > sashes.length) {
    for (let i = sashes.length; i < n; i++) {
      // Outermost leaf on the right: hinge right, handle towards the middle.
      const type: SashType = typeForAddedSash(sashes.map((x) => x.type)) === "sliding" ? "sliding" : "tiltturn";
      sashes.push({ type, direction: type === "tiltturn" ? "right" : "left", active: true, hardware: "maco", hardwareColor: "white" });
    }
  } else if (n < sashes.length) {
    sashes = sashes.slice(0, n);
  }
  // Whatever the leaves were, the shares must add up to the whole frame again (the leaf widths are typed on them).
  const shares = normalizedRatios(sashes);
  sashes = sashes.map((sh, k) => ({ ...sh, widthRatio: shares[k] }));
  let width = s.width;
  let height = s.height;
  if (n === 1) {
    width = clamp(width, dimMin(s, "width"), SINGLE_SASH_MAX_WIDTH);
    height = clamp(height, dimMin(s, "height"), SINGLE_SASH_MAX_HEIGHT);
  }
  return { ...s, sashes, width, height };
}
