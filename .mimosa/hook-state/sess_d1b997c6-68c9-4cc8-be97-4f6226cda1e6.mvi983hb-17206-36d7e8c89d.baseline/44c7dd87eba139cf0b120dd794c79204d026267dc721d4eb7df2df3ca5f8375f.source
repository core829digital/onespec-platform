// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { WindowDrawing } from "../src/lib/drawing/WindowDrawing";
import { DRAWING_LOCALES, LEAF } from "../src/lib/drawing/drawing-text";
import { PALETTE } from "../src/lib/drawing/finishes";
import type { DrawingInput } from "../src/lib/drawing/types";
import { leafWidthRanges, sashWidthsMm, setSashWidth } from "../src/shared/piece-ops";
import type { ProjectItem } from "../src/shared/pricing";

const sash = (over: object = {}) => ({ type: "classic" as const, direction: "left" as const, active: true, hardware: "", hardwareColor: "", ...over });
const input = (widthMm: number, ratios: number[]): DrawingInput => ({
  widthMm, heightMm: 1400, category: "finestra2", finish: "white",
  sashes: ratios.map((r) => ({ type: "classic", direction: "left", active: true, widthRatio: r })),
});
const leafTexts = (s: ReturnType<typeof buildScene>) => s.primitives.filter((p) => p.type === "text" && p.role === "leafLabel").map((p) => (p.type === "text" ? p.text : ""));

describe("leaf labels on the drawing", () => {
  test("whole millimetres that add up to the frame width", () => {
    expect(leafTexts(buildScene(input(1000, [1 / 3, 1 / 3, 1 / 3]), { showLeafDimensions: true }))).toEqual(["334", "333", "333"]);
    expect(leafTexts(buildScene(input(1431, [0.5, 0.5]), { showLeafDimensions: true }))).toEqual(["716", "715"]);
  });

  test("a clickable box per leaf, only with two or more leaves and only when the leaf dimensions are shown", () => {
    const three = buildScene(input(1500, [0.2, 0.3, 0.5]), { showLeafDimensions: true });
    expect(three.meta.leafDimensions?.map((b) => b.sashIndex)).toEqual([0, 1, 2]);
    for (const b of three.meta.leafDimensions ?? []) {
      expect(b.w).toBeGreaterThanOrEqual(22);
      expect(b.h).toBeGreaterThan(10);
    }
    expect(buildScene(input(1500, [0.2, 0.3, 0.5])).meta.leafDimensions).toBeUndefined();
    expect(buildScene(input(1000, [1]), { showLeafDimensions: true }).meta.leafDimensions).toBeUndefined();
    expect(buildScene(input(1500, [0.2, 0.3, 0.5]), { showLeafDimensions: true, showDimensions: false }).meta.leafDimensions).toBeUndefined();
  });

  test("each box sits under its own leaf, and the outside view mirrors them while keeping the leaf numbers", () => {
    const inside = buildScene(input(1500, [0.2, 0.3, 0.5]), { showLeafDimensions: true });
    const centres = inside.meta.leafDimensions!.map((b) => b.x + b.w / 2);
    expect(centres[0]).toBeLessThan(centres[1]);
    expect(centres[1]).toBeLessThan(centres[2]);
    inside.meta.cells.forEach((c, i) => expect(Math.abs(centres[i] - (c.x + c.w / 2))).toBeLessThan(c.w / 2));
    const outside = buildScene(input(1500, [0.2, 0.3, 0.5]), { showLeafDimensions: true, view: "outside" });
    const mirrored = outside.meta.leafDimensions!.map((b) => b.x + b.w / 2);
    expect(mirrored[0]).toBeGreaterThan(mirrored[2]);
    outside.meta.cells.forEach((c, i) => expect(Math.abs(mirrored[i] - (c.x + c.w / 2))).toBeLessThan(c.w / 2));
    expect(outside.meta.leafDimensions!.map((b) => b.sashIndex)).toEqual([0, 1, 2]);
  });

  test("a leaf below its minimum width is drawn in red", () => {
    const narrow = buildScene({ ...input(1200, [0.2, 0.8]), sashes: [{ type: "classic", direction: "left", active: true, widthRatio: 0.2 }, { type: "classic", direction: "right", active: true, widthRatio: 0.8 }] }, { showLeafDimensions: true, showViolations: true });
    const fills = narrow.primitives.filter((p) => p.type === "text" && p.role === "leafLabel").map((p) => (p.type === "text" ? p.fill : ""));
    expect(fills[0]).toBe(PALETTE.danger); // 240 mm < 300
    expect(fills[1]).not.toBe(PALETTE.danger);
  });
});

describe("leaf labels in the interactive drawing", () => {
  const render = (extra: object, ratios = [0.5, 0.5]) =>
    renderToStaticMarkup(h(WindowDrawing, { input: input(1200, ratios), options: { showLeafDimensions: true }, onSelectSash: () => {}, ...extra }));

  test("each label is a keyboard-reachable button with a name that says which leaf", () => {
    const html = render({ onEditLeafWidth: () => {}, leafWidthRanges: [{ min: 300, max: 900 }, { min: 300, max: 900 }], leafText: LEAF.it });
    for (const i of [0, 1]) {
      expect(html).toContain(`data-testid="leaf-dim-${i}"`);
      expect(html).toContain(`aria-label="Modifica la larghezza dell&#x27;anta ${i + 1}: 600 mm"`);
    }
    expect((html.match(/data-testid="leaf-dim-/g) ?? []).length).toBe(2);
    expect(html).toContain('tabindex="0"');
  });

  test("no editing without a handler", () => {
    expect(render({})).not.toContain("leaf-dim-");
  });

  test("a single leaf has nothing to edit on its own", () => {
    expect(render({ onEditLeafWidth: () => {} }, [1])).not.toContain("leaf-dim-");
  });

  test("every language has the three texts, with their placeholders", () => {
    for (const l of DRAWING_LOCALES) {
      expect(LEAF[l].edit).toContain("{n}");
      expect(LEAF[l].invalid).toContain("{min}");
      expect(LEAF[l].invalid).toContain("{max}");
      expect(LEAF[l].hint.length).toBeGreaterThan(10);
    }
  });
});

describe("setSashWidth on a piece", () => {
  const piece = (ratios: number[], width = 1500): ProjectItem =>
    ({ productType: "window", material: "pvc", quality: {}, width, height: 1400, quantity: 1, glazing: "double", color: "white", insectScreen: false, sashes: ratios.map((r) => sash({ widthRatio: r })) }) as unknown as ProjectItem;

  test("sets the leaf, the others adapt, the ratios add up to 1 and the widths to the frame", () => {
    const r = setSashWidth(piece([0.2, 0.3, 0.5]), 0, 600);
    if (!r.ok) throw new Error("should be ok");
    expect(sashWidthsMm(r.item)[0]).toBe(600);
    expect(sashWidthsMm(r.item).reduce((a, b) => a + b, 0)).toBe(1500);
    expect(r.item.sashes.reduce((a, s) => a + (s.widthRatio ?? 0), 0)).toBeCloseTo(1, 12);
  });

  test("the same value twice changes nothing; typing back the old value restores the layout", () => {
    const a = setSashWidth(piece([0.5, 0.5]), 0, 700);
    if (!a.ok) throw new Error("ok");
    const again = setSashWidth(a.item, 0, 700);
    if (!again.ok) throw new Error("ok");
    expect(sashWidthsMm(again.item)).toEqual([700, 800]);
    const back = setSashWidth(a.item, 0, 750);
    if (!back.ok) throw new Error("ok");
    expect(sashWidthsMm(back.item)).toEqual([750, 750]);
  });

  test("ranges follow each leaf type's minimum; out of range is refused with the limits", () => {
    const p = piece([0.5, 0.5], 1200);
    p.sashes[1] = sash({ type: "tiltturn", widthRatio: 0.5 }) as never;
    expect(leafWidthRanges(p)).toEqual([{ min: 300, max: 1200 - 415 }, { min: 415, max: 1200 - 300 }]);
    expect(setSashWidth(p, 0, 299)).toEqual({ ok: false, reason: "range", min: 300, max: 785 });
    expect(setSashWidth(p, 0, 786)).toEqual({ ok: false, reason: "range", min: 300, max: 785 });
  });
});
