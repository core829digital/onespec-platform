/**
 * Pure helpers for the touch gestures (kept free of the DOM so they are unit-tested): which way a finger moved, and whether the gesture
 * is enough to dismiss a panel.
 */
export type SwipeDirection = "down" | "left" | "right";

/** The axis a gesture belongs to, decided once the finger has moved a little (so a vertical scroll is never taken for a swipe). */
export function lockAxis(dx: number, dy: number, slop = 8): "x" | "y" | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** How far the finger has travelled in the direction that closes the panel (never negative: moving the other way is not a swipe). */
export function progressToward(direction: SwipeDirection, dx: number, dy: number): number {
  const v = direction === "down" ? dy : direction === "left" ? -dx : dx;
  return Math.max(0, v);
}

/** Enough distance (a third of the panel, at most 120 px) or a quick flick (> 0.5 px/ms) over a short distance. */
export function shouldDismiss(distance: number, size: number, elapsedMs: number): boolean {
  if (distance <= 0) return false;
  const threshold = Math.min(120, Math.max(48, size * 0.33));
  if (distance >= threshold) return true;
  const velocity = distance / Math.max(1, elapsedMs);
  return distance >= 24 && velocity > 0.5;
}

/** A swipe that starts at the very left edge and runs right, mostly flat: opens the side menu. */
export function isEdgeOpen(startX: number, dx: number, dy: number, edge = 22): boolean {
  return startX <= edge && dx >= 70 && Math.abs(dy) <= Math.min(60, dx * 0.6);
}
