// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WindowDrawing } from "../src/lib/drawing/WindowDrawing";
import type { DrawingInput, DrawingSash } from "../src/lib/drawing/types";

const input = (sashes: Partial<DrawingSash>[]): DrawingInput => ({
  widthMm: 1200,
  heightMm: 1400,
  category: "finestra2",
  finish: "white",
  sashes: sashes.map((s) => ({ type: "classic", direction: "left", active: true, widthRatio: 1 / sashes.length, ...s })),
});

const render = (i: DrawingInput, selected: number | null, withHandler = true) =>
  renderToStaticMarkup(
    h(WindowDrawing, {
      input: i,
      options: { selectedSash: selected },
      onSelectSash: () => {},
      ...(withHandler ? { onFlipSash: () => {}, flipLabel: "Inverti apertura" } : {}),
    }),
  );

describe("flip-opening button on the drawing", () => {
  test("shown on the selected hinged or sliding leaf, with an accessible name", () => {
    for (const type of ["classic", "tiltturn", "sliding", "liftslide"] as const) {
      const html = render(input([{ type }]), 0);
      expect(html, type).toContain('data-testid="flip-sash"');
      expect(html).toContain('aria-label="Inverti apertura"');
      expect(html).toContain('role="button"');
      expect(html).toContain('tabindex="0"');
    }
  });

  test("not shown for fixed, vasistas, inactive leaves, no selection or no handler", () => {
    expect(render(input([{ type: "fix" }]), 0)).not.toContain("flip-sash");
    expect(render(input([{ type: "tilt" }]), 0)).not.toContain("flip-sash");
    expect(render(input([{ active: false }]), 0)).not.toContain("flip-sash");
    expect(render(input([{}]), null)).not.toContain("flip-sash");
    expect(render(input([{}]), 0, false)).not.toContain("flip-sash");
  });

  test("only one button, on the selected leaf", () => {
    const html = render(input([{}, { type: "tiltturn" }]), 1);
    expect(html.match(/data-testid="flip-sash"/g)).toHaveLength(1);
  });
});
