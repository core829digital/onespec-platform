// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import type { DrawingSash } from "../src/lib/drawing/types";
import { CATEGORY_DEFS, defaultSashesFor, type PieceCategory } from "../src/shared/configurator-model";
import { addSash } from "../src/shared/piece-ops";
import { defaultSashPreset } from "../src/components/widget/widget-pricing";

/**
 * Multi-leaf openings must hinge on the OUTER edges with the handles towards the
 * middle, otherwise the leaves swing into the passage between them.
 * `direction` is the hinge side seen from inside.
 */
function outerHinges(sashes: Array<{ direction: "left" | "right"; type: string }>) {
  const hinged = sashes.filter((s) => s.type === "classic" || s.type === "tiltturn");
  if (hinged.length < 2) return true;
  const n = sashes.length;
  return sashes.every((s, i) => !(s.type === "classic" || s.type === "tiltturn") || (i === 0 ? s.direction === "left" : i === n - 1 ? s.direction === "right" : true));
}

describe("default leaf handedness", () => {
  test.each(["finestra2", "finestra3", "porta2", "porta3"] as PieceCategory[])("%s hinges outwards", (cat) => {
    const sashes = defaultSashesFor(cat, CATEGORY_DEFS[cat].defaultHeightMm);
    expect(sashes[0].direction).toBe("left");
    expect(sashes[sashes.length - 1].direction).toBe("right");
    expect(outerHinges(sashes)).toBe(true);
  });

  test("the widget's first preset hinges outwards too", () => {
    const p = defaultSashPreset();
    expect(p[0].direction).toBe("left");
    expect(p[p.length - 1].direction).toBe("right");
  });

  test("adding leaves keeps the outer hinges (1 -> 2 -> 3)", () => {
    const base = {
      width: 1200,
      height: 1400,
      sashes: [{ type: "classic", direction: "right", active: true, hardware: "standard", hardwareColor: "silver", widthRatio: 1, main: true }],
    } as unknown as Parameters<typeof addSash>[0];
    const two = addSash(base);
    expect(two.sashes.map((s) => s.direction)).toEqual(["left", "right"]);
    const three = addSash(two);
    expect(three.sashes[0].direction).toBe("left");
    expect(three.sashes[2].direction).toBe("right");
  });
});

describe("drawing of a pair: triangle tips inside, hinges outside, handles in the middle", () => {
  test("2-leaf window", () => {
    // Two tilt-turn leaves both carry a handle (fixed mullion); a casement next to a tilt-turn has none.
    const sashes = (defaultSashesFor("finestra2", 1400) as DrawingSash[]).map((s) => ({ ...s, type: "tiltturn" as const }));
    const scene = buildScene({ widthMm: 1200, heightMm: 1400, category: "finestra2", sashes });
    const casement = scene.primitives.filter((p) => p.role === "opening" && p.part === "casement" && p.type === "line");
    const bySash = (i: number) => casement.filter((p) => p.sashIndex === i) as Array<{ x1: number; x2: number }>;
    // apex = the shared end point of the two legs
    const apexX = (i: number) => bySash(i)[0].x2;
    const farX = (i: number) => bySash(i)[0].x1;
    // tips point to the inside: left leaf's tip on its right edge, right leaf's on its left edge
    expect(apexX(0)).toBeGreaterThan(farX(0));
    expect(apexX(1)).toBeLessThan(farX(1));
    expect(apexX(0)).toBeLessThan(apexX(1));
    const handles = scene.primitives.filter((p) => p.role === "handle" && p.type === "rect") as Array<{ x: number; sashIndex?: number }>;
    const hx = (i: number) => handles.find((h) => h.sashIndex === i)!.x;
    // handles sit next to each other at the middle (hinged outwards), not at the outer edges
    expect(hx(1) - hx(0)).toBeGreaterThan(0);
    expect(hx(1) - hx(0)).toBeLessThan(20);
  });
});
