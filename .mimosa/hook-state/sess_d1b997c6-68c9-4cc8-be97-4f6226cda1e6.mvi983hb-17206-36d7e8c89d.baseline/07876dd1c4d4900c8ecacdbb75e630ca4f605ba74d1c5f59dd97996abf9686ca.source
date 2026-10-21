// Typing the width of one leaf in the public widget: the same rules as the platform editors (src/shared/leaf-widths.ts),
// with the widget's own minimum widths (the ones its drawing flags in red).

import { leafWidthLimits, leafWidthsMm, setLeafWidth, type LeafWidthLimits } from "@/shared/leaf-widths";
import { normalizedRatios, type EditorSash } from "@/shared/sash-rules";
import type { Sash } from "./widget-pricing";

/** Minimum leaf widths (mm) per opening type — under this the leaf jams. */
export const MIN_SASH_WIDTH: Record<Sash["type"], number> = {
  fix: 300,
  classic: 300,
  tiltturn: 415,
  sliding: 400,
};

const ratiosOf = (sashes: Sash[]) => normalizedRatios(sashes as unknown as EditorSash[]);

export const widgetLeafMins = (sashes: Sash[]): number[] => sashes.map((s) => MIN_SASH_WIDTH[s.type] ?? 300);

/** Whole-millimetre width of every leaf; adds up to the frame width. */
export const widgetLeafWidths = (width: number, sashes: Sash[]): number[] => leafWidthsMm(width, ratiosOf(sashes));

/** What each leaf may be set to. */
export const widgetLeafRanges = (width: number, sashes: Sash[]): LeafWidthLimits[] => {
  const mins = widgetLeafMins(sashes);
  return mins.map((_, i) => leafWidthLimits(width, mins, i));
};

/** The leaves with leaf `index` set to `mm` and the others adapted, or null when that width cannot be held. */
export function withLeafWidth(width: number, sashes: Sash[], index: number, mm: number): Sash[] | null {
  const r = setLeafWidth(width, ratiosOf(sashes), widgetLeafMins(sashes), index, mm);
  return r.ok ? sashes.map((s, i) => ({ ...s, widthRatio: r.ratios[i] })) : null;
}
