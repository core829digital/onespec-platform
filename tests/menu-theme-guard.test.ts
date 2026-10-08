// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/** The menus must keep wearing the OneSpec palette and moving; these are the rules that make that so (guards against a silent revert to the generic grey, un-animated look). */
const css = readFileSync("src/app/globals.css", "utf8");
const menu = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");

describe("OneSpec menus", () => {
  test("Radix menus use the OneSpec classes, not the generic shadcn grey", () => {
    expect(menu).toContain('"os-menu"');
    expect(menu).toContain("os-menu-item");
    expect(menu).not.toMatch(/--popover\)/);
    expect(menu).not.toContain("animate-in"); // tw-animate-css is not imported: those classes did nothing
  });
  test("menu surface, highlight and selection come from the OneSpec tokens", () => {
    const block = css.slice(css.indexOf(".os-menu {"), css.indexOf(".os-menu-item {"));
    expect(block).toContain("var(--color-bg-alt)");
    expect(block).toContain("var(--color-border)");
    const items = css.slice(css.indexOf(".os-menu-item {"));
    expect(items).toContain("var(--color-mint-light)");
    expect(items).toContain("var(--color-mint-text)");
  });
  test("native selects: themed popup (base-select), mint selection, and the pseudo-class form that survives the CSS minifier", () => {
    expect(css).toContain("appearance: base-select");
    expect(css).toContain("select:open::picker(select)");
    expect(css).not.toContain("::picker(select):popover-open"); // the minifier drops this form: the popup would stay invisible
    expect(css).toMatch(/select option:checked[^}]*var\(--color-mint-light\)/);
  });
  test("native controls follow the app theme and motion respects prefers-reduced-motion", () => {
    expect(css).toContain(":root { color-scheme: dark; }");
    expect(css).toContain('[data-theme="light"] { color-scheme: light; }');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.001ms/);
  });
  test("the press effect never reaches SVG elements (it made the drawing's dimensions impossible to edit)", () => {
    const press = css.split("\n").filter((l) => l.includes("scale(0.97)") && l.includes(":active"));
    expect(press.length).toBeGreaterThan(0);
    for (const line of press) expect(line).toContain(":not(svg *)");
    // Any rule that sets a transform on every [role=button] must also exclude SVG.
    for (const line of css.split("\n")) if (/\[role="button"\][^{]*\{[^}]*transform:/.test(line)) expect(line).toContain(":not(svg *)");
  });
});
