// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { parseDimensionInput } from "../src/lib/drawing/dimension-edit";
import { DIMENSION } from "../src/lib/drawing/drawing-text";
import { DRAWING_LOCALES } from "../src/lib/drawing/drawing-text";

describe("parseDimensionInput", () => {
  const p = (raw: string) => parseDimensionInput(raw, 200, 6000);
  test("plain numbers and units", () => {
    expect(p("1200")).toEqual({ ok: true, mm: 1200 });
    expect(p("  950 mm ")).toEqual({ ok: true, mm: 950 });
    expect(p("950MM")).toEqual({ ok: true, mm: 950 });
  });
  test("thousands grouping is not a decimal", () => {
    expect(p("1.200")).toEqual({ ok: true, mm: 1200 });
    expect(p("1 200")).toEqual({ ok: true, mm: 1200 });
    expect(p("5.000")).toEqual({ ok: true, mm: 5000 });
  });
  test("decimals are rounded", () => {
    expect(p("1200,4")).toEqual({ ok: true, mm: 1200 });
    expect(p("1200.6")).toEqual({ ok: true, mm: 1201 });
  });
  test("refuses empty, text and out-of-range values", () => {
    expect(p("")).toEqual({ ok: false, reason: "empty" });
    expect(p("   ")).toEqual({ ok: false, reason: "empty" });
    expect(p("abc")).toEqual({ ok: false, reason: "number" });
    expect(p("12abc")).toEqual({ ok: false, reason: "number" });
    expect(p("199")).toEqual({ ok: false, reason: "range" });
    expect(p("6001")).toEqual({ ok: false, reason: "range" });
    expect(p("-500")).toEqual({ ok: false, reason: "range" });
    expect(p("1e9")).toEqual({ ok: false, reason: "range" });
  });
  test("the limits themselves are valid", () => {
    expect(p("200")).toEqual({ ok: true, mm: 200 });
    expect(p("6000")).toEqual({ ok: true, mm: 6000 });
  });
});

describe("dimension label boxes", () => {
  const input = { widthMm: 1200, heightMm: 1400, category: "finestra2", finish: "white", sashes: [{ type: "classic", direction: "left", active: true, widthRatio: 1 }] } as never;
  test("present when dimensions are drawn, absent when hidden", () => {
    const s = buildScene(input);
    expect(s.meta.dimensions?.width?.w).toBeGreaterThan(20);
    expect(s.meta.dimensions?.height?.h).toBeGreaterThan(20);
    expect(buildScene(input, { showDimensions: false }).meta.dimensions).toEqual({});
  });
  test("the width box sits under the frame, the height box to its right", () => {
    const s = buildScene(input);
    const f = s.meta.frame;
    expect(s.meta.dimensions!.width!.y).toBeGreaterThan(f.y + f.h);
    expect(s.meta.dimensions!.height!.x).toBeGreaterThan(f.x + f.w);
  });
  test("boxes are mirrored in the outside view (height label moves to the left)", () => {
    const o = buildScene(input, { view: "outside" });
    expect(o.meta.dimensions!.height!.x + o.meta.dimensions!.height!.w).toBeLessThan(o.meta.frame.x);
  });
  test("every language has the edit words with their placeholders", () => {
    for (const l of DRAWING_LOCALES) {
      expect(DIMENSION[l].invalid).toContain("{min}");
      expect(DIMENSION[l].invalid).toContain("{max}");
      expect(DIMENSION[l].editWidth.length).toBeGreaterThan(3);
    }
  });
});
