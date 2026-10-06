/**
 * Horizontal bars (traversi) across a window or a panel. A bar is described by its height from the sill, in mm, measured to its
 * centre. Everything that draws, prices or validates a piece goes through these functions, so the three can never disagree.
 */

/** Height of the bar profile, mm. */
export const TRANSOM_MM = 60;
/** At most this many bars on one piece. */
export const MAX_TRANSOMS = 3;
/** The glass (or panel) field between two bars, or between a bar and the frame, is never lower than this, mm. */
export const TRANSOM_MIN_ZONE_MM = 300;

/** The valid bars: whole millimetres, inside the piece, sorted, far enough from each other and from the frame; at most MAX_TRANSOMS. */
export function normalizeTransoms(heightMm: number, raw: readonly number[] | undefined): number[] {
  if (!raw || raw.length === 0 || !Number.isFinite(heightMm)) return [];
  const lo = TRANSOM_MIN_ZONE_MM + TRANSOM_MM / 2;
  const hi = heightMm - TRANSOM_MIN_ZONE_MM - TRANSOM_MM / 2;
  const out: number[] = [];
  const sorted = raw.filter((n) => Number.isFinite(n)).map((n) => Math.round(n)).sort((a, b) => a - b);
  for (const pos of sorted) {
    if (pos < lo || pos > hi) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && pos - prev < TRANSOM_MIN_ZONE_MM + TRANSOM_MM) continue;
    out.push(pos);
    if (out.length >= MAX_TRANSOMS) break;
  }
  return out;
}

/** Heights of the fields the bars leave, from the sill up (frame and bar thickness not subtracted). */
export function transomZonesMm(heightMm: number, transoms: readonly number[]): number[] {
  const edges = [0, ...transoms, heightMm];
  const zones: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const bottom = i === 0 ? 0 : edges[i] + TRANSOM_MM / 2;
    const top = i === edges.length - 2 ? heightMm : edges[i + 1] - TRANSOM_MM / 2;
    zones.push(Math.max(0, Math.round(top - bottom)));
  }
  return zones;
}

/** Where a new bar goes: the middle of the tallest field. Null when no bar fits (the piece is too low, or MAX_TRANSOMS is reached). */
export function suggestTransom(heightMm: number, transoms: readonly number[]): number | null {
  if (transoms.length >= MAX_TRANSOMS) return null;
  const edges = [0, ...transoms, heightMm];
  let best = { gap: 0, mid: 0 };
  for (let i = 0; i < edges.length - 1; i++) {
    const gap = edges[i + 1] - edges[i];
    if (gap > best.gap) best = { gap, mid: Math.round((edges[i] + edges[i + 1]) / 2) };
  }
  const next = normalizeTransoms(heightMm, [...transoms, best.mid]);
  return next.length > transoms.length ? best.mid : null;
}

/** Length of the bars in metres, for pricing (each runs the full width of the piece). */
export function transomLengthM(widthMm: number, transoms: readonly number[]): number {
  return (transoms.length * widthMm) / 1000;
}
