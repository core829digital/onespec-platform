import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { guardedListeners } from "../src/components/dnd/kit";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

/** Body of one @keyframes block (they contain no nested braces beyond the step blocks). */
function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start === -1) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return "";
}

describe("motion rules (docs/ANIMAZIONI.md)", () => {
  const OURS = ["os-rise", "os-reveal", "os-spring-in", "os-layer-in", "os-bob", "os-stroke", "os-grow", "os-shimmer", "os-fade", "os-lift", "os-morph-in"];

  test.each(OURS)("%s exists and animates only compositor properties (no layout, no paint-heavy properties)", (name) => {
    const body = keyframes(name);
    expect(body, `@keyframes ${name} missing`).not.toBe("");
    for (const bad of ["width", "height", "top", "left", "right", "bottom", "margin", "padding", "font-size", "border", "box-shadow", "filter", "background"]) {
      expect(body, `${name} animates ${bad}`).not.toMatch(new RegExp(`(^|[\\s;{])${bad}\\s*:`));
    }
  });

  test("everything switches off under prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation-duration: 0\.001ms !important/);
  });

  test("cascade is capped: delay never exceeds 8 steps of 40 ms and the cap is also in the --i helper", () => {
    expect(css).toMatch(/min\(var\(--i, 0\), 8\) \* 40ms/);
    expect(css).not.toMatch(/animation-delay:\s*(?:[4-9]\d\d|\d{4,})ms/);
  });

  test("the skeleton shimmer runs on a translated pseudo-element (compositor), never on background-position", () => {
    expect(keyframes("shimmer")).toContain("background-position"); // legacy marketing shimmer, unused by skeletons
    expect(keyframes("os-shimmer")).toContain("translateX");
    expect(css).toMatch(/\.os-skel[^{]*::after[\s\S]*?animation: os-shimmer/);
  });

  test("hover lift uses the independent translate property, so it never fights an entrance animation", () => {
    expect(css).toMatch(/\.os-float:hover\s*\{[^}]*translate: 0 -4px/);
  });
});

describe("drag listeners (src/components/dnd/kit.tsx)", () => {
  const press = (insideControl: boolean) => {
    const card = {};
    const control = { closest: (sel: string) => (insideControl && sel.includes("button") ? control : null) };
    return { target: insideControl ? control : { closest: () => null }, currentTarget: card } as unknown as { target: EventTarget | null; currentTarget: EventTarget | null };
  };

  test("a press on the card starts the drag; a press on a button, link or select inside it does not", () => {
    let started = 0;
    const l = guardedListeners({ onMouseDown: (() => void started++) as never, onTouchStart: (() => void started++) as never });
    l.onMouseDown(press(false));
    expect(started).toBe(1);
    l.onMouseDown(press(true));
    l.onTouchStart(press(true));
    expect(started).toBe(1);
    l.onTouchStart(press(false));
    expect(started).toBe(2);
  });

  test("no listeners → nothing to attach", () => {
    expect(guardedListeners(undefined)).toEqual({});
  });
});
