// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { glassLabel, glassSizeMm } from "../src/lib/drawing/glass-size";
import { OPTIONS, DRAWING_LOCALES } from "../src/lib/drawing/drawing-text";
import type { DrawingInput } from "../src/lib/drawing/types";

const pair: DrawingInput = {
  widthMm: 1200,
  heightMm: 1400,
  category: "finestra2",
  finish: "white",
  sashes: [
    { type: "classic", direction: "left", active: true, widthRatio: 0.5 },
    { type: "tiltturn", direction: "right", active: true, widthRatio: 0.5 },
  ],
};

describe("glass size", () => {
  test("deducts the profile from each side", () => {
    expect(glassSizeMm(600, 1400)).toEqual({ w: 400, h: 1200 });
  });
  test("door: only the upper part is glass", () => {
    expect(glassSizeMm(900, 2100, true)).toEqual({ w: 700, h: Math.round(1900 * 0.45) });
  });
  test("never negative, and tiny glass has no label", () => {
    expect(glassSizeMm(150, 150)).toEqual({ w: 0, h: 0 });
    expect(glassLabel(240, 1400)).toBeNull();
    expect(glassLabel(250, 1400)).toBe("~50 × 1200");
    expect(glassLabel(600, 1400)).toBe("~400 × 1200");
  });
});

describe("glass dimensions on the drawing", () => {
  const glassTexts = (s: ReturnType<typeof buildScene>) =>
    s.primitives.filter((p) => p.type === "text" && p.part === "glass").map((p) => (p.type === "text" ? p.text : ""));

  test("off by default, one label per operable leaf when on", () => {
    expect(glassTexts(buildScene(pair))).toEqual([]);
    expect(glassTexts(buildScene(pair, { showGlassDimensions: true }))).toEqual(["~400 × 1200", "~400 × 1200"]);
  });

  test("inactive leaves have none; the figures follow the leaf widths", () => {
    const uneven = { ...pair, sashes: [{ ...pair.sashes[0], widthRatio: 0.7 }, { ...pair.sashes[1], active: false, widthRatio: 0.3 }] };
    expect(glassTexts(buildScene(uneven, { showGlassDimensions: true }))).toEqual(["~640 × 1200"]);
  });

  test("leaves too narrow for the label skip it instead of overflowing", () => {
    const narrow = { ...pair, widthMm: 500, sashes: [{ ...pair.sashes[0], widthRatio: 0.5 }, { ...pair.sashes[1], widthRatio: 0.5 }] };
    expect(glassTexts(buildScene(narrow, { showGlassDimensions: true }))).toEqual([]);
  });

  test("the mirrored (outside) view keeps the labels", () => {
    expect(glassTexts(buildScene(pair, { showGlassDimensions: true, view: "outside" })).length).toBe(2);
  });

  test("every language has the option labels", () => {
    for (const l of DRAWING_LOCALES) {
      expect(OPTIONS[l].leafDims.length).toBeGreaterThan(3);
      expect(OPTIONS[l].glassDims.length).toBeGreaterThan(3);
      expect(OPTIONS[l].glassNote.length).toBeGreaterThan(10);
    }
  });
});

describe("out-of-limit overall dimensions", () => {
  const dimColor = (s: ReturnType<typeof buildScene>, part: string) => {
    const t = s.primitives.find((p) => p.type === "text" && p.role === "dimension" && p.part === part);
    return t?.type === "text" ? t.fill : null;
  };
  test("normal colour by default, red only on the flagged axis", () => {
    const ok = buildScene(pair);
    const bad = buildScene(pair, { invalidAxes: { height: true } });
    expect(dimColor(ok, "height")).toBe(dimColor(bad, "width"));
    expect(dimColor(bad, "height")).toBe("#DC2626");
    expect(dimColor(bad, "width")).not.toBe("#DC2626");
  });
});
