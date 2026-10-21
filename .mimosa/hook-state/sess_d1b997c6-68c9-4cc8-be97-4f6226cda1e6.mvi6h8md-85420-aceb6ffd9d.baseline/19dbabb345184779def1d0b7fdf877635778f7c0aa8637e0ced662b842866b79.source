// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildPlanScene, planLeaves, swingClearanceMm } from "../src/lib/drawing/build-plan";
import { DRAWING_LOCALES, PLAN, TABS } from "../src/lib/drawing/drawing-text";
import { sceneToSvg } from "../src/lib/drawing/to-svg";
import type { DrawingInput, DrawingSash, Primitive } from "../src/lib/drawing/types";

const input = (widthMm: number, sashes: Partial<DrawingSash>[]): DrawingInput => ({
  widthMm,
  heightMm: 1400,
  category: "finestra2",
  finish: "white",
  sashes: sashes.map((s) => ({ type: "classic", direction: "left", active: true, widthRatio: 1 / sashes.length, ...s })),
});

const parts = (ps: Primitive[], part: string) => ps.filter((p) => p.part === part);

describe("plan leaves", () => {
  test("cells tile the opening between the jambs, mm in the label", () => {
    const l = planLeaves(input(1200, [{ widthRatio: 0.5 }, { widthRatio: 0.5 }]));
    expect(l[0].x0).toBe(45);
    expect(l[1].x1).toBe(1155);
    expect(l[0].widthMm + l[1].widthMm).toBeCloseTo(1110, 0);
    expect(l[0].x1).toBe(l[1].x0);
  });
});

describe("swing clearance", () => {
  test("is the widest hinged leaf that is active", () => {
    expect(swingClearanceMm(input(1200, [{}, { type: "tiltturn" }]))).toBe(555);
    expect(swingClearanceMm(input(1500, [{ type: "fix", widthRatio: 0.5 }, { widthRatio: 0.25 }, { widthRatio: 0.25 }]))).toBeLessThan(400);
  });
  test("zero for sliding, fixed, vasistas and inactive leaves", () => {
    expect(swingClearanceMm(input(1800, [{ type: "sliding" }, { type: "fix" }]))).toBe(0);
    expect(swingClearanceMm(input(900, [{ type: "tilt" }]))).toBe(0);
    expect(swingClearanceMm(input(900, [{ active: false }]))).toBe(0);
  });
});

describe("plan scene", () => {
  const pair = input(1200, [{ direction: "left" }, { direction: "right", type: "tiltturn" }]);
  const scene = buildPlanScene(pair, "it");

  test("one swing arc and one open leaf per hinged leaf, hinges at the outer jambs", () => {
    expect(parts(scene.primitives, "swing").filter((p) => p.type === "polyline")).toHaveLength(2);
    expect(parts(scene.primitives, "openLeaf")).toHaveLength(2);
    const hinges = scene.primitives.filter((p) => p.role === "hinge" && p.type === "rect");
    expect(hinges).toHaveLength(2);
    const [a, b] = hinges.map((h) => (h.type === "rect" ? h.x : 0)).sort((x, y) => x - y);
    expect(b - a).toBeGreaterThan(150); // far apart: on the outer sides
  });

  test("the arc is a quarter circle of the leaf width around the hinge", () => {
    const arc = parts(scene.primitives, "swing").find((p) => p.type === "polyline");
    if (arc?.type !== "polyline") throw new Error("no arc");
    const hinge = scene.primitives.find((p) => p.role === "hinge" && p.type === "rect");
    if (hinge?.type !== "rect") throw new Error("no hinge");
    const hx = hinge.x + hinge.w / 2;
    const hy = hinge.y + hinge.h / 2;
    const radii = arc.points.map(([x, y]) => Math.hypot(x - hx, y - hy));
    const r = radii[0];
    for (const q of radii) expect(Math.abs(q - r)).toBeLessThan(0.05 * r); // all points on the same circle
    const [fx, fy] = arc.points[arc.points.length - 1];
    expect(Math.abs(fx - hx)).toBeLessThan(0.5); // ends straight below the hinge
    expect(fy).toBeGreaterThan(hy);
  });

  test("states the room needed to open and the room names, in every language", () => {
    for (const l of DRAWING_LOCALES) {
      const texts = buildPlanScene(pair, l).primitives.filter((p) => p.type === "text").map((p) => (p.type === "text" ? p.text : ""));
      expect(texts).toContain(PLAN[l].interior);
      expect(texts).toContain(PLAN[l].exterior);
      expect(texts).toContain(PLAN[l].clearance.replace("{mm}", "555"));
      expect(TABS[l].plan.length).toBeGreaterThan(2);
    }
  });

  test("sliding leaves get a track position, a ghost of the open position and an arrow, no swing", () => {
    const s = buildPlanScene(input(1800, [{ type: "sliding", direction: "right" }, { type: "fix" }]));
    expect(parts(s.primitives, "swing")).toHaveLength(0);
    expect(parts(s.primitives, "ghost")).toHaveLength(1);
    expect(parts(s.primitives, "slideArrow").length).toBeGreaterThan(0);
    expect(s.primitives.some((p) => p.type === "text" && p.part === "clearance")).toBe(false);
  });

  test("a sliding leaf's ghost moves the way the arrow points", () => {
    const three = (direction: "left" | "right", first: number) =>
      buildPlanScene(input(2400, [{ type: "fix", widthRatio: first }, { type: "sliding", direction, widthRatio: 0.34 }, { type: "fix", widthRatio: 0.66 - first }]));
    const at = (scene: ReturnType<typeof buildPlanScene>) => {
      const closed = scene.primitives.find((p) => p.role === "sashOutline" && p.sashIndex === 1);
      const ghost = parts(scene.primitives, "ghost")[0];
      if (closed?.type !== "rect" || ghost?.type !== "rect") throw new Error("missing");
      return ghost.x - closed.x;
    };
    expect(at(three("right", 0.33))).toBeGreaterThan(10);
    expect(at(three("left", 0.33))).toBeLessThan(-10);
  });

  test("deterministic, finite, inside its viewBox, and exportable as SVG", () => {
    expect(buildPlanScene(pair, "it")).toEqual(scene);
    const { w, h } = scene.viewBox;
    for (const p of scene.primitives) {
      const pts = p.type === "rect" ? [[p.x, p.y], [p.x + p.w, p.y + p.h]] : p.type === "line" ? [[p.x1, p.y1], [p.x2, p.y2]] : p.type === "polygon" || p.type === "polyline" ? p.points : p.type === "circle" ? [[p.cx, p.cy]] : [];
      for (const [x, y] of pts) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(-0.01);
        expect(x).toBeLessThanOrEqual(w + 0.01);
        expect(y).toBeGreaterThanOrEqual(-0.01);
        expect(y).toBeLessThanOrEqual(h + 0.01);
      }
    }
    expect(sceneToSvg(scene)).toContain("<polyline");
  });

  test("never throws on odd input", () => {
    expect(() => buildPlanScene(input(0, [{}]))).not.toThrow();
    expect(() => buildPlanScene({ ...pair, sashes: [] })).not.toThrow();
    expect(() => buildPlanScene(input(99999, [{}, {}, {}, {}, {}, {}]))).not.toThrow();
  });
});
