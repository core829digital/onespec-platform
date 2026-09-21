// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, test } from "vitest";
import { WindowDrawing } from "../src/lib/drawing/WindowDrawing";
import { WindowDrawingPdf } from "../src/lib/drawing/WindowDrawingPdf";
import type { DrawingInput } from "../src/lib/drawing/types";

const two: DrawingInput = {
  widthMm: 1200,
  heightMm: 1400,
  category: "finestra2",
  finish: "anthracite",
  sashes: [
    { type: "classic", direction: "left", active: true, widthRatio: 0.5 },
    { type: "tiltturn", direction: "right", active: true, widthRatio: 0.5, main: true },
  ],
};

const door: DrawingInput = {
  widthMm: 900,
  heightMm: 2100,
  category: "porta",
  frameType: "reno65",
  accessories: { avv: "sovrapposto", zanz: "fissa", pers: "fisse" },
  sashes: [{ type: "classic", direction: "right", active: true, handleHeightMm: 1050 }],
};

describe("WindowDrawing (DOM)", () => {
  test("renders an accessible svg for two inputs", () => {
    for (const [input, label] of [[two, "Window two leaves"], [door, "Entrance door"]] as const) {
      const html = renderToStaticMarkup(h(WindowDrawing, { input, ariaLabel: label, className: "drawing" }));
      expect(html).toContain("<svg");
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain('role="img"');
      expect(html).toContain('class="drawing"');
      expect(html).toContain("viewBox=");
    }
  });

  test("interactive layers appear only with callbacks", () => {
    const plain = renderToStaticMarkup(h(WindowDrawing, { input: two }));
    const live = renderToStaticMarkup(
      h(WindowDrawing, { input: two, onSelectSash: () => {}, onResizeSash: () => {}, svgId: "d1" }),
    );
    expect(plain).not.toContain("ew-resize");
    expect(plain).not.toContain("cursor:pointer");
    expect(live).toContain("ew-resize");
    expect(live).toContain("touch-action:none");
    expect(live).toContain("cursor:pointer");
    expect(live).toContain('id="d1"');
  });
});

describe("WindowDrawingPdf", () => {
  test("renders to a PDF buffer", async () => {
    const buf = await renderToBuffer(
      h(
        Document,
        null,
        h(
          Page,
          { size: "A4" },
          h(WindowDrawingPdf, { input: two, options: { showLeafDimensions: true, showMainBadge: true, handleGuide: "all" }, width: 200 }),
          h(WindowDrawingPdf, { input: door, options: { showViolations: true }, width: 120 }),
        ),
      ),
    );
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });
});
