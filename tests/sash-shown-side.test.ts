import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { directionFromShownSide, shownSide } from "../src/shared/sash-rules";

// The side picked in the controls must be the side the customer SEES: the triangle tip and
// the handle for hinged leaves, the arrow for sliding ones.
describe("shown side", () => {
  test("hinged: shown side is opposite the stored hinge side, and round-trips", () => {
    expect(shownSide("classic", "left")).toBe("right");
    expect(shownSide("tiltturn", "right")).toBe("left");
    for (const side of ["left", "right"] as const) {
      expect(shownSide("classic", directionFromShownSide("classic", side))).toBe(side);
    }
  });

  test("sliding: shown side is the stored side", () => {
    expect(shownSide("sliding", "left")).toBe("left");
    expect(directionFromShownSide("liftslide", "right")).toBe("right");
  });

  test("picking 'right' draws handle and triangle tip on the right, hinges on the left", () => {
    const direction = directionFromShownSide("classic", "right");
    const scene = buildScene({
      widthMm: 800,
      heightMm: 1200,
      category: "finestra1",
      finish: "white",
      sashes: [{ type: "classic", direction, active: true, widthRatio: 1 }],
    });
    const frame = scene.primitives.find((p) => p.role === "frame" && p.type === "rect");
    if (!frame || frame.type !== "rect") throw new Error("no frame");
    const mid = frame.x + frame.w / 2;
    const xs = (role: string) =>
      scene.primitives.filter((p) => p.role === role).flatMap((p) => (p.type === "rect" ? [p.x] : []));
    expect(xs("handle")[0]).toBeGreaterThan(mid);
    expect(xs("hinge")[0]).toBeLessThan(mid);
  });
});
