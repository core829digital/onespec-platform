/**
 * Signature rules shared by the pad (browser) and its tests — no DOM here.
 *
 * A signature is kept as strokes (lists of points in the pad's CSS pixels), never as the pixels of the screen: the screen shows the ink
 * in the colour of the theme (white on dark, black on light), while the picture that is SAVED is always black on white, so it reads the same
 * on the PDF, on paper and in either theme.
 */

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

/** Width in pixels of the saved picture; the height follows the pad's proportions. */
export const EXPORT_WIDTH = 720;
/** Line width on screen, in CSS pixels; the saved picture scales it with the picture. */
export const INK_WIDTH = 2.6;
/** Ink colours of the pad on screen and of the saved picture. */
export const INK_DARK_THEME = "#ffffff";
export const INK_LIGHT_THEME = "#000000";
export const INK_SAVED = "#000000";

export interface SignatureStats {
  strokes: number;
  points: number;
  /** Total length of the lines drawn, in CSS pixels. */
  length: number;
  width: number;
  height: number;
}

export function strokeStats(strokes: Stroke[]): SignatureStats {
  let points = 0;
  let length = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    points += s.length;
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (i > 0) length += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y);
    }
  }
  return { strokes: strokes.length, points, length, width: points ? maxX - minX : 0, height: points ? maxY - minY : 0 };
}

/**
 * A real signature, not a tap or a stray touch: lines at least 60 px long covering at least 24 px in some direction.
 * (A single click makes a dot; that must not enable "Confirm".)
 */
export function isRealSignature(strokes: Stroke[]): boolean {
  const s = strokeStats(strokes);
  return s.length >= 60 && Math.max(s.width, s.height) >= 24;
}
