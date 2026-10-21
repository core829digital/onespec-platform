// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("phone: no zoom, no sideways drag", () => {
  const css = read("src/app/globals.css");
  const widgetCss = read("src/components/widget/widget.css");

  test("every text field is 16px on touch screens (iOS zooms the page in on focus otherwise)", () => {
    expect(css).toMatch(/@media \(max-width: 1023px\), \(hover: none\) and \(pointer: coarse\)\s*\{[\s\S]*?select,\s*textarea\s*\{\s*font-size: 16px;/);
  });
  test("the page itself can never be wider than the screen", () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*max-width: 100%;[^}]*overflow-x: clip;/);
  });
  test("the embedded widget has the same 16px rule (inline styles need !important) and stacks with minmax(0, 1fr)", () => {
    expect(widgetCss).toMatch(/font-size: 16px !important;/);
    expect(widgetCss).toMatch(/\[data-tw-grid\],\s*\.tw-widget-root \[data-tw-row\]\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important;/);
  });
  test("the viewport never blocks pinch-zoom (accessibility): zoom is prevented by the 16px rule, not by maximum-scale", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).not.toMatch(/maximumScale|userScalable/);
  });
  test("no element is sized with 100vw (it ignores the scrollbar and overflows)", () => {
    // `max-w-[calc(100vw-2rem)]` style caps are fine; a plain width of 100vw / w-screen is not.
    for (const f of ["src/components/app-shell/setup-guide-widget.tsx"]) expect(read(f)).not.toMatch(/[^-]w-screen|width:\s*"?100vw/);
  });
});
