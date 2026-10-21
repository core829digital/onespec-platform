import { describe, expect, it } from "vitest";
import { isEdgeOpen, lockAxis, progressToward, shouldDismiss } from "../src/lib/swipe";

describe("swipe maths", () => {
  it("decides the axis only after a little movement, so scrolling is never a swipe", () => {
    expect(lockAxis(2, 3)).toBeNull();
    expect(lockAxis(30, 5)).toBe("x");
    expect(lockAxis(4, -40)).toBe("y");
  });
  it("counts only movement toward the closing direction", () => {
    expect(progressToward("down", 5, 80)).toBe(80);
    expect(progressToward("down", 0, -80)).toBe(0);
    expect(progressToward("left", -90, 4)).toBe(90);
    expect(progressToward("left", 90, 4)).toBe(0);
    expect(progressToward("right", 70, 0)).toBe(70);
  });
  it("dismisses on a long drag or a quick flick, not on a short slow one", () => {
    expect(shouldDismiss(130, 600, 800)).toBe(true); // far enough (capped at 120 px)
    expect(shouldDismiss(60, 600, 90)).toBe(true); // quick flick
    expect(shouldDismiss(40, 600, 900)).toBe(false); // slow and short
    expect(shouldDismiss(10, 600, 5)).toBe(false); // a touch, not a swipe
    expect(shouldDismiss(0, 600, 100)).toBe(false);
    expect(shouldDismiss(-30, 600, 100)).toBe(false);
  });
  it("opens the side menu only from the very edge, going right, mostly flat", () => {
    expect(isEdgeOpen(8, 90, 10)).toBe(true);
    expect(isEdgeOpen(60, 90, 10)).toBe(false); // not from the edge
    expect(isEdgeOpen(8, 40, 0)).toBe(false); // too short
    expect(isEdgeOpen(8, 90, 80)).toBe(false); // diagonal: a scroll
  });
});
