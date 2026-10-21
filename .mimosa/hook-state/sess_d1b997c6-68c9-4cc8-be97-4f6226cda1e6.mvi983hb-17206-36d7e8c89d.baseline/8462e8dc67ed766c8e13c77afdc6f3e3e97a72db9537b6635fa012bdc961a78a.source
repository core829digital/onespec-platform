import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { handleKindFor, handleShapes } from "../src/lib/drawing/handle-shapes";
import type { DrawingInput, DrawingSash, Primitive } from "../src/lib/drawing/types";

const input = (sash: Partial<DrawingSash>, category: DrawingInput["category"] = "finestra1"): DrawingInput => ({
  widthMm: 800,
  heightMm: 1300,
  category,
  finish: "white",
  sashes: [{ type: "classic", direction: "left", active: true, widthRatio: 1, ...sash }],
});

const handleParts = (scene: ReturnType<typeof buildScene>) => scene.primitives.filter((p) => p.role === "handle");
const part = (ps: Primitive[], name: string) => ps.find((p) => p.part === name);

describe("technical handle", () => {
  test("which symbol each leaf type gets", () => {
    expect(handleKindFor("classic", false)).toBe("lever");
    expect(handleKindFor("tiltturn", false)).toBe("lever");
    expect(handleKindFor("classic", true)).toBe("doorLever");
    expect(handleKindFor("liftslide", false)).toBe("doorLever");
    expect(handleKindFor("sliding", false)).toBe("pull");
    expect(handleKindFor("tilt", false)).toBe("tilt");
  });

  test("window handle: plate, pivot and a lever hanging below the axis", () => {
    const ps = handleParts(buildScene(input({})));
    const plate = part(ps, "plate");
    const lever = part(ps, "lever");
    expect(plate?.type).toBe("rect");
    expect(part(ps, "pivot")?.type).toBe("circle");
    if (plate?.type !== "rect" || lever?.type !== "rect") throw new Error("shape");
    expect(lever.h).toBeGreaterThan(lever.w * 3); // a lever, not a block
    expect(lever.y + lever.h).toBeGreaterThan(plate.y + plate.h); // it hangs below the plate
  });

  test("the handle stays on the side opposite the hinges for both openings", () => {
    for (const [direction, wantRight] of [["left", true], ["right", false]] as const) {
      const scene = buildScene(input({ direction }));
      const frame = scene.primitives.find((p) => p.role === "frame" && p.type === "rect");
      if (frame?.type !== "rect") throw new Error("frame");
      const plate = part(handleParts(scene), "plate");
      if (plate?.type !== "rect") throw new Error("plate");
      expect(plate.x + plate.w / 2 > frame.x + frame.w / 2).toBe(wantRight);
    }
  });

  test("door lever points horizontally towards the leaf centre", () => {
    for (const [direction, towardsLeft] of [["left", true], ["right", false]] as const) {
      const scene = buildScene(input({ direction }, "porta1"));
      const ps = handleParts(scene);
      const plate = part(ps, "plate");
      const lever = part(ps, "lever");
      if (plate?.type !== "rect" || lever?.type !== "rect") throw new Error("shape");
      expect(lever.w).toBeGreaterThan(lever.h * 3);
      const plateCentre = plate.x + plate.w / 2;
      expect(lever.x + lever.w / 2 < plateCentre).toBe(towardsLeft);
    }
  });

  test("sliding leaf gets a flush pull on the leading edge, no lever", () => {
    const ps = handleParts(buildScene(input({ type: "sliding", direction: "right" })));
    expect(part(ps, "lever")).toBeUndefined();
    expect(part(ps, "grip")?.type).toBe("line");
  });

  test("the handle axis follows the configured height", () => {
    const axis = (mm: number) => {
      const plate = part(handleParts(buildScene(input({ handleHeightMm: mm }))), "plate");
      if (plate?.type !== "rect") throw new Error("plate");
      return plate.y + plate.h / 2;
    };
    expect(axis(400)).toBeGreaterThan(axis(900)); // lower in mm = lower on the drawing (larger y)
  });

  test("shapes are pure data: same input, same output", () => {
    const spec = { kind: "lever" as const, cx: 10, cy: 20, inward: 1 as const, stile: 4, fill: "#ccc" };
    expect(handleShapes({ role: "handle" }, spec)).toEqual(handleShapes({ role: "handle" }, spec));
  });
});
