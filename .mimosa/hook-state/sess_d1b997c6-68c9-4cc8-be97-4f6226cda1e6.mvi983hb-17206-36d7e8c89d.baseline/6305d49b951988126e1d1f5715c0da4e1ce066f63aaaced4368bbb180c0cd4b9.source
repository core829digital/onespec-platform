// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { describe, expect, test } from "vitest";
import { buildLegendScene } from "../src/lib/drawing/build-legend";
import { DRAWING_LOCALES, LEGEND, TITLES } from "../src/lib/drawing/drawing-text";
import { SceneSvg } from "../src/lib/drawing/render-dom";
import { sceneToSvg } from "../src/lib/drawing/to-svg";

describe("symbol legend", () => {
  test("every language has every row, short enough to fit, and real translations", () => {
    for (const l of DRAWING_LOCALES) {
      for (const [key, lines] of Object.entries(LEGEND[l])) {
        expect(lines.length, `${l}.${key}`).toBeGreaterThan(0);
        for (const line of lines) expect(line.length, `${l}.${key}: ${line}`).toBeLessThanOrEqual(42);
        if (l !== "it") expect(lines.join(" "), `${l}.${key}`).not.toBe(LEGEND.it[key as keyof typeof LEGEND.it].join(" "));
      }
      expect(TITLES[l].legend.length).toBeGreaterThan(3);
    }
  });

  test("the scene is deterministic and draws one icon + text per symbol", () => {
    const a = buildLegendScene("de");
    expect(buildLegendScene("de")).toEqual(a);
    expect(a.primitives.filter((p) => p.type === "text").length).toBeGreaterThanOrEqual(8);
    expect(a.primitives.some((p) => p.type === "text" && p.text === TITLES.de.legend)).toBe(true);
    expect(a.viewBox.w).toBeGreaterThan(200);
  });

  test("falls back to Italian for an unknown language", () => {
    expect(buildLegendScene("xx")).toEqual(buildLegendScene("it"));
  });

  test("renders as inline SVG for the editor and for HTML exports", () => {
    const scene = buildLegendScene("fr");
    const dom = renderToStaticMarkup(h(SceneSvg, { scene, ariaLabel: "legend" }));
    expect(dom).toContain("<svg");
    expect(dom).toContain("Charnières");
    expect(sceneToSvg(scene)).toContain("Légende des symboles");
  });
});
