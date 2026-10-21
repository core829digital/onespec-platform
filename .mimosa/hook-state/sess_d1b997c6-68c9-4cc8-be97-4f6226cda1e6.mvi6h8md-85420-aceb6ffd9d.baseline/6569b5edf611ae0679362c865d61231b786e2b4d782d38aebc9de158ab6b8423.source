// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { mirror } from "../src/lib/drawing/prims";
import type { DrawingInput, Primitive } from "../src/lib/drawing/types";

const pair: DrawingInput = {
  widthMm: 1200,
  heightMm: 1400,
  category: "finestra2",
  finish: "white",
  sashes: [
    { type: "classic", direction: "left", active: true, widthRatio: 0.4, hardwareColor: "silver" },
    { type: "tiltturn", direction: "right", active: true, widthRatio: 0.6, hardwareColor: "silver" },
  ],
};

const rects = (ps: Primitive[], role: string) =>
  ps.filter((p) => p.role === role && p.type === "rect").map((p) => (p.type === "rect" ? p : null)!);

describe("outside view", () => {
  const inside = buildScene(pair);
  const outside = buildScene(pair, { view: "outside" });

  test("same size, handles gone, everything else still there", () => {
    expect(outside.viewBox).toEqual(inside.viewBox);
    expect(inside.primitives.some((p) => p.role === "handle")).toBe(true);
    expect(outside.primitives.some((p) => p.role === "handle" || p.role === "handleGuide")).toBe(false);
    const without = (ps: Primitive[]) => ps.filter((p) => p.role !== "handle" && p.role !== "handleGuide");
    expect(outside.primitives.length).toBe(without(inside.primitives).length);
  });

  test("hinges swap sides: what was on the left is on the right", () => {
    const W = inside.viewBox.w;
    const a = rects(inside.primitives, "hinge").map((h) => Math.round((h.x + h.w / 2) * 100) / 100).sort((x, y) => x - y);
    const b = rects(outside.primitives, "hinge").map((h) => Math.round((W - (h.x + h.w / 2)) * 100) / 100).sort((x, y) => x - y);
    expect(b).toEqual(a);
  });

  test("leaf cells and dividers are mirrored in the meta, indexes unchanged", () => {
    const W = inside.viewBox.w;
    expect(outside.meta.view).toBe("outside");
    expect(inside.meta.view).toBe("inside");
    outside.meta.cells.forEach((c, i) => {
      const o = inside.meta.cells[i];
      expect(c.sashIndex).toBe(o.sashIndex);
      expect(Math.abs(c.x + c.w - (W - o.x))).toBeLessThan(0.01);
    });
    expect(Math.abs(outside.meta.dividers[0] - (W - inside.meta.dividers[0]))).toBeLessThan(0.01);
  });

  test("the opening triangles are mirrored too (tip pointing the other way)", () => {
    const tip = (s: ReturnType<typeof buildScene>) => {
      const l = s.primitives.find((p) => p.role === "opening" && p.part === "casement" && p.type === "line");
      if (!l || l.type !== "line") throw new Error("no casement line");
      return l.x2 > l.x1; // tip to the right of the far end
    };
    expect(tip(inside)).toBe(!tip(outside));
  });

  test("mirroring twice gives the original", () => {
    for (const p of inside.primitives) {
      const back = mirror(mirror(p, inside.viewBox.w), inside.viewBox.w);
      expect(JSON.stringify(back)).toBe(JSON.stringify(p));
    }
  });

  test("text keeps reading direction: anchors swap, glyphs are not flipped", () => {
    const t = { type: "text", role: "dimension", x: 10, y: 5, text: "1200", fontSize: 8, fill: "#000", anchor: "start", weight: "normal" } as const;
    const m = mirror(t, 100);
    expect(m.type === "text" && m.anchor).toBe("end");
    expect(m.type === "text" && m.x).toBe(90);
  });

  test("default view is the inside one", () => {
    expect(buildScene(pair, { view: "inside" })).toEqual(inside);
  });
});
