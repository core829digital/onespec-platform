// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { handleMmFromY, snapHandleHeight, yFromHandleMm } from "../src/lib/drawing/handle-height";
import type { DrawingInput } from "../src/lib/drawing/types";

describe("snapHandleHeight", () => {
  test("snaps to the standard heights when close", () => {
    expect(snapHandleHeight(1043, 1400)).toMatchObject({ mm: 1050, snappedTo: 1050, label: "standard" });
    expect(snapHandleHeight(1008, 1400)).toMatchObject({ mm: 1000, snappedTo: 1000, label: "standard" });
  });

  test("snaps to the middle of the leaf", () => {
    expect(snapHandleHeight(690, 1400)).toMatchObject({ mm: 700, snappedTo: 700, label: "mid" });
  });

  test("away from the targets it just rounds to 10 mm", () => {
    expect(snapHandleHeight(853, 1400)).toEqual({ mm: 850, snappedTo: null, label: null });
    expect(snapHandleHeight(857, 1400)).toEqual({ mm: 860, snappedTo: null, label: null });
  });

  test("stays inside the allowed range of the piece", () => {
    expect(snapHandleHeight(50, 1400).mm).toBe(600);
    expect(snapHandleHeight(99999, 1400).mm).toBe(1200); // height - 200
    expect(snapHandleHeight(Number.NaN, 1400).mm).toBe(600);
    // a small window has a lower range
    expect(snapHandleHeight(20, 700).mm).toBe(100);
  });

  test("a standard height outside the range of a short piece is never offered", () => {
    expect(snapHandleHeight(1000, 900).snappedTo).toBeNull(); // max is 700 for a 900 mm piece
  });

  test("the nearest target wins when two are close", () => {
    // 1000 and 1050 are 50 apart: 1024 is nearer to 1000, 1026 to 1050
    expect(snapHandleHeight(1015, 2200).mm).toBe(1000);
    expect(snapHandleHeight(1036, 2200).mm).toBe(1050);
  });
});

const input: DrawingInput = {
  widthMm: 1200,
  heightMm: 1400,
  category: "finestra2",
  finish: "white",
  sashes: [
    { type: "classic", direction: "left", active: true, widthRatio: 0.5, handleHeightMm: 700 },
    { type: "tilt", direction: "left", active: true, widthRatio: 0.25 },
    { type: "fix", direction: "left", active: true, widthRatio: 0.25 },
  ],
};

describe("handles in the scene", () => {
  const scene = buildScene(input);

  test("only leaves with a handle on a stile are grabbable", () => {
    expect(scene.meta.handles?.map((h) => h.sashIndex)).toEqual([0]);
  });

  test("the axis converts back to the configured height", () => {
    const h = scene.meta.handles![0];
    expect(Math.round(handleMmFromY(scene.meta, h.axisY))).toBe(700);
    expect(Math.abs(yFromHandleMm(scene.meta, 700) - h.axisY)).toBeLessThan(0.01);
  });

  test("the grab area covers the handle symbol, and sits among the hit rectangles", () => {
    const h = scene.meta.handles![0];
    const hit = scene.primitives.find((p) => p.role === "hit" && p.part === "handle");
    if (hit?.type !== "rect") throw new Error("no handle hit");
    expect(hit.y).toBeLessThan(h.y);
    expect(hit.y + hit.h).toBeGreaterThan(h.y + h.h);
    expect(h.minY).toBeLessThan(h.maxY);
    expect(h.axisY).toBeGreaterThanOrEqual(h.minY);
    expect(h.axisY).toBeLessThanOrEqual(h.maxY);
  });

  test("a higher handle sits higher on the drawing", () => {
    const at = (mm: number) =>
      buildScene({ ...input, sashes: [{ ...input.sashes[0], handleHeightMm: mm }] }).meta.handles![0].axisY;
    expect(at(1100)).toBeLessThan(at(800));
  });

  test("no grab areas in the outside view (handles are not visible there)", () => {
    expect(buildScene(input, { view: "outside" }).meta.handles).toEqual([]);
  });
});

import { setHardwareColor } from "../src/shared/piece-ops";
import type { ProjectItem } from "../src/shared/pricing";

describe("hardware colour from the drawing", () => {
  const leaf = (type: string) => ({ type, direction: "left", active: true, hardware: "maco", hardwareColor: "white" });
  const base = () => ({ width: 1200, height: 1400, sashes: [leaf("classic"), leaf("fix"), leaf("tiltturn")] }) as unknown as ProjectItem;
  const colors = (item: ProjectItem) => item.sashes.map((s) => s.hardwareColor);

  test("one leaf only", () => {
    expect(colors(setHardwareColor(base(), 2, "black", false))).toEqual(["white", "white", "black"]);
  });
  test("all leaves, but never the fixed one", () => {
    expect(colors(setHardwareColor(base(), 0, "black", true))).toEqual(["black", "white", "black"]);
  });
  test("does not mutate the original", () => {
    const item = base();
    setHardwareColor(item, 0, "black", true);
    expect(colors(item)).toEqual(["white", "white", "white"]);
  });
  test("an out-of-range leaf changes nothing", () => {
    const item = base();
    expect(setHardwareColor(item, 9, "black", false)).toBe(item);
  });
});
