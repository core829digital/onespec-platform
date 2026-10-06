// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isRealSignature, strokeStats, type Stroke } from "../src/lib/signature";

const line = (x1: number, y1: number, x2: number, y2: number, n = 12): Stroke =>
  Array.from({ length: n }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / (n - 1), y: y1 + ((y2 - y1) * i) / (n - 1) }));

describe("signature rules", () => {
  it("nothing drawn is not a signature", () => {
    expect(isRealSignature([])).toBe(false);
    expect(strokeStats([])).toMatchObject({ strokes: 0, points: 0, length: 0, width: 0, height: 0 });
  });

  it("a tap (one point) or a tiny scratch is not a signature", () => {
    expect(isRealSignature([[{ x: 10, y: 10 }]])).toBe(false);
    expect(isRealSignature([line(10, 10, 14, 12)])).toBe(false);
  });

  it("a long line that stays in one spot is not a signature, a real stroke is", () => {
    const scribble: Stroke = Array.from({ length: 200 }, (_, i) => ({ x: 50 + (i % 2) * 3, y: 50 })); // 200 back-and-forth jumps of 3 px: long, but only 3 px wide
    expect(isRealSignature([scribble])).toBe(false);
    expect(isRealSignature([line(20, 100, 220, 40)])).toBe(true);
  });

  it("several short strokes that add up count (a signature is often lifted several times)", () => {
    expect(isRealSignature([line(10, 50, 40, 50), line(50, 40, 80, 60), line(90, 50, 120, 45)])).toBe(true);
  });
});
