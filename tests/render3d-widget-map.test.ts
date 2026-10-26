import { describe, expect, test } from "vitest";
import { catalogOptions, freshWidgetState } from "../src/components/widget/widget-catalog";
import { getDict } from "../src/components/widget/widget-i18n";
import { colorSwatches, hardwareSwatches, window3dFromState } from "../src/components/widget/widget-render3d";
import { buildWindow3D, sashLayout } from "../src/lib/render3d/window-3d";
import { RENDER3D } from "../src/lib/render3d/render3d-text";
import { DRAWING_LOCALES } from "../src/lib/drawing/drawing-text";

const options = catalogOptions(undefined, getDict("it"), "it-IT");

describe("widget -> 3D model", () => {
  test("the configuration becomes the same window: size, leaves, colour and hardware", () => {
    const state = freshWidgetState(options);
    const model = window3dFromState(state, options, state.color);
    expect(model.widthMm).toBe(state.width);
    expect(model.heightMm).toBe(state.height);
    expect(model.sashes).toHaveLength(state.sashes.length);
    expect(model.frameHex).toMatch(/^#[0-9a-f]{6}$/i);
    const rig = buildWindow3D(model);
    expect(rig.hitTargets.length).toBeGreaterThan(0);
    const layout = sashLayout(model);
    expect(layout.reduce((n, l) => n + l.width, 0)).toBeCloseTo(model.widthMm - 2 * 68, 6);
    rig.dispose();
  });

  test("a leaf switched off in a combined panel does not open", () => {
    const state = freshWidgetState(options);
    const sashes = state.sashes.map((s, i) => (i === 0 ? { ...s, type: "classic" as const, active: false } : s));
    const model = window3dFromState({ ...state, sashes }, options, state.color);
    expect(model.sashes[0].type).toBe("fix");
  });

  test("every catalogue colour and hardware colour has a swatch with a real hex", () => {
    const colours = colorSwatches(options);
    expect(colours.length).toBe(options.color.length);
    for (const c of colours) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
    const hw = hardwareSwatches(options);
    expect(hw.length).toBe(options.hardwareColor.length);
    for (const c of hw) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("3D texts", () => {
  test("all six languages have every word, and the pose / corner lists are complete", () => {
    const keys = Object.keys(RENDER3D.it).sort();
    for (const l of DRAWING_LOCALES) {
      expect(Object.keys(RENDER3D[l]).sort()).toEqual(keys);
      expect(RENDER3D[l].corner).toHaveLength(4);
      expect(Object.keys(RENDER3D[l].pose).sort()).toEqual(["closed", "open", "tilt"]);
      for (const [k, v] of Object.entries(RENDER3D[l])) if (typeof v === "string") expect(v.trim(), `${l}.${k}`).not.toBe("");
    }
  });
});
