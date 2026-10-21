// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MIN_SASH_WIDTH, widgetLeafMins, widgetLeafRanges, widgetLeafWidths, withLeafWidth } from "../src/components/widget/leaf-edit";
import { SpecDrawing } from "../src/components/widget/spec-drawing";
import { getDict } from "../src/components/widget/widget-i18n";
import type { Sash } from "../src/components/widget/widget-pricing";

const sash = (over: Partial<Sash> = {}): Sash => ({ type: "classic", direction: "left", active: true, hardware: "maco", hardwareColor: "white", ...over }) as Sash;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("leaf widths in the widget", () => {
  it("whole millimetres that add up to the frame, from explicit or missing shares", () => {
    expect(widgetLeafWidths(1000, [sash({ widthRatio: 1 / 3 }), sash({ widthRatio: 1 / 3 }), sash({ widthRatio: 1 / 3 })])).toEqual([334, 333, 333]);
    expect(widgetLeafWidths(1200, [sash(), sash()])).toEqual([600, 600]);
    expect(sum(widgetLeafWidths(1777, [sash({ widthRatio: 0.2 }), sash(), sash()]))).toBe(1777);
  });

  it("uses the widget's own minimums per opening type", () => {
    const sashes = [sash({ type: "tiltturn" }), sash({ type: "classic" }), sash({ type: "sliding" })];
    expect(widgetLeafMins(sashes)).toEqual([MIN_SASH_WIDTH.tiltturn, MIN_SASH_WIDTH.classic, MIN_SASH_WIDTH.sliding]);
    expect(widgetLeafRanges(2000, sashes)[0]).toEqual({ min: 415, max: 2000 - 300 - 400 });
  });

  it("sets one leaf, the others adapt; impossible values change nothing (null)", () => {
    const two = [sash({ widthRatio: 0.5 }), sash({ widthRatio: 0.5 })];
    const next = withLeafWidth(1200, two, 0, 500)!;
    expect(widgetLeafWidths(1200, next)).toEqual([500, 700]);
    expect(next.every((s) => typeof s.widthRatio === "number")).toBe(true);
    expect(sum(next.map((s) => s.widthRatio!))).toBeCloseTo(1, 12);
    expect(withLeafWidth(1200, two, 0, 299)).toBeNull();
    expect(withLeafWidth(1200, two, 0, 901)).toBeNull();
    expect(withLeafWidth(1200, two, 5, 500)).toBeNull();
    expect(withLeafWidth(1200, two, 0, 500.5)).toBeNull();
  });

  it("keeps the other properties of every leaf", () => {
    const two = [sash({ type: "tiltturn", handleHeightMm: 700, main: true } as never), sash({ direction: "right" })];
    const next = withLeafWidth(1400, two, 1, 600)!;
    expect(next[0]).toMatchObject({ type: "tiltturn", handleHeightMm: 700, main: true });
    expect(next[1]).toMatchObject({ direction: "right" });
  });
});

describe("leaf labels in the widget drawing", () => {
  const draw = (sashes: Sash[], extra: object = {}) =>
    renderToStaticMarkup(h(SpecDrawing, { width: 1200, height: 1400, material: "pvc", sashes, selected: null, ...extra }));

  it("a row of leaf widths with several leaves, none for a single leaf", () => {
    const html = draw([sash({ widthRatio: 0.25 }), sash({ widthRatio: 0.75 })]);
    expect(html).toContain(">300<");
    expect(html).toContain(">900<");
    const single = draw([sash()]);
    expect(single).not.toMatch(/>1200</); // only the overall "1200 mm" label
  });

  it("clickable, named buttons only when editing is offered", () => {
    const sashes = [sash({ widthRatio: 0.5 }), sash({ widthRatio: 0.5 })];
    expect(draw(sashes)).not.toContain("leaf-dim-");
    const html = draw(sashes, { onEditLeafWidth: () => {}, leafText: { edit: "Modifica la larghezza dell'anta {n}", invalid: "x" } });
    expect(html).toContain('data-testid="leaf-dim-0"');
    expect(html).toContain('data-testid="leaf-dim-1"');
    expect(html).toContain("anta 2: 600 mm");
    expect(html).toContain('tabindex="0"');
  });

  it("a leaf under its minimum is flagged in red", () => {
    const html = draw([sash({ widthRatio: 0.2 }), sash({ widthRatio: 0.8 })]);
    expect(html).toMatch(/fill="#DC2626"[^>]*>240</);
  });

  it("every widget language has the texts", () => {
    for (const l of ["en", "it", "fr", "de", "nl", "ro"]) {
      const d = getDict(l);
      expect(d.leafEdit).toContain("{n}");
      expect(d.leafInvalid).toContain("{min}");
      expect(d.leafHint.length).toBeGreaterThan(10);
    }
  });
});
