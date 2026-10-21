/**
 * Indicative glass size of a leaf. The real figure depends on the profile system (frame, sash and bead depths),
 * so the drawing labels it with "~": it is there to give an order of magnitude, never to order glass from.
 */
export const GLASS_DEDUCTION_MM = 100; // per side: visible frame + sash + bead, averaged over common PVC/alu/wood systems

/** Share of a door leaf that is glass (the rest is the blind lower panel); matches the drawing. */
export const DOOR_GLASS_SHARE = 0.45;

export function glassSizeMm(leafWidthMm: number, pieceHeightMm: number, door = false): { w: number; h: number } {
  const w = Math.max(0, Math.round(leafWidthMm - 2 * GLASS_DEDUCTION_MM));
  const full = Math.max(0, pieceHeightMm - 2 * GLASS_DEDUCTION_MM);
  return { w, h: Math.round(door ? full * DOOR_GLASS_SHARE : full) };
}

/** "~456 × 1210", or null when the leaf is too small to have a meaningful glass size. */
export function glassLabel(leafWidthMm: number, pieceHeightMm: number, door = false): string | null {
  const { w, h } = glassSizeMm(leafWidthMm, pieceHeightMm, door);
  return w >= 50 && h >= 50 ? `~${w} × ${h}` : null;
}
