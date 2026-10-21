import { hasBuiltInFinish } from "./finishes";
import type { FinishFill } from "./types";

interface FinishRow {
  key: string;
  swatchHex?: string;
  texture?: string;
  textureW?: number;
  textureH?: number;
}

/**
 * The colour (and texture) a catalogue finish paints the frame with. The hand-tuned built-in looks (white,
 * anthracite, wood...) stay as they are unless the row carries a texture; every other finish uses its swatch colour.
 */
export function finishFillFor(rows: FinishRow[] | undefined, key: string | undefined): FinishFill | undefined {
  const row = rows?.find((r) => r.key === key);
  if (!row?.swatchHex) return undefined;
  const textured = !!row.texture && !!row.textureW && !!row.textureH;
  if (!textured && hasBuiltInFinish(key)) return undefined;
  return {
    hex: row.swatchHex,
    ...(textured ? { texture: { href: row.texture!, w: row.textureW!, h: row.textureH! } } : {}),
  };
}

/** The inside-face fields of a bicolour piece for DrawingInput (nothing when both faces share one finish). */
export function insideFinishFor(
  rows: FinishRow[] | undefined,
  item: { color: string; colorInside?: string },
): { finishInside?: string; finishFillInside?: FinishFill } {
  if (!item.colorInside || item.colorInside === item.color) return {};
  return { finishInside: item.colorInside, finishFillInside: finishFillFor(rows, item.colorInside) };
}
