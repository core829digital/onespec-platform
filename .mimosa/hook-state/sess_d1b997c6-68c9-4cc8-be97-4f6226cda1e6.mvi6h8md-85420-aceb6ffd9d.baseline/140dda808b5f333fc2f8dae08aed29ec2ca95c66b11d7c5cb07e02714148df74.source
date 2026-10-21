// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DrawingTabs } from "../src/components/quotes/editor/drawing-tabs";

const render = (value: "elevation" | "plan" | "section" | "hardware", locale = "it", tabs: ("elevation" | "plan" | "section" | "hardware")[] = ["elevation", "plan"]) =>
  renderToStaticMarkup(h(DrawingTabs, { tabs, value, onChange: () => {}, locale }));

describe("drawing tabs", () => {
  test("a tab list with the selected tab marked and focusable, the others skipped by Tab", () => {
    const html = render("plan");
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toMatch(/id="drawing-tab-plan"[^>]*aria-selected="true"[^>]*tabindex="0"|aria-selected="true"[^>]*tabindex="0"[^>]*id="drawing-tab-plan"/);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
  });

  test("labels in the user's language", () => {
    expect(render("elevation", "it")).toContain("Prospetto");
    expect(render("elevation", "it")).toContain("Pianta");
    expect(render("elevation", "de")).toContain("Grundriss");
    expect(render("elevation", "fr")).toContain("Élévation");
    expect(render("elevation", "xx")).toContain("Pianta");
  });

  test("each tab points at its panel", () => {
    const html = render("elevation", "it", ["elevation", "plan", "section", "hardware"]);
    for (const t of ["elevation", "plan", "section", "hardware"]) expect(html).toContain(`aria-controls="drawing-panel-${t}"`);
  });
});
