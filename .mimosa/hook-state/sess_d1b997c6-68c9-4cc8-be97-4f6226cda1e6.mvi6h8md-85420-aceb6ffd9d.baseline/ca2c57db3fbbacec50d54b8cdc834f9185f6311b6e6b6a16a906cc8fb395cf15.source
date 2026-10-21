// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HandleColorPopover } from "../src/components/quotes/editor/handle-color-popover";

const render = (locale: string, current?: string) =>
  renderToStaticMarkup(
    h(HandleColorPopover, {
      anchor: { x: 300, y: 200 },
      locale,
      options: [["silver", "Argento"], ["black", "Nero"], ["white", "Bianco"]],
      current,
      onPick: () => {},
      onClose: () => {},
    }),
  );

describe("hardware colour popover", () => {
  test("one swatch per colour, the current one pressed, labelled for screen readers", () => {
    const html = render("it", "black");
    expect(html.match(/<button[^>]*aria-label="(Argento|Nero|Bianco)"/g)).toHaveLength(3);
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('role="dialog"');
  });

  test("speaks the user's language", () => {
    expect(render("it")).toContain("Colore ferramenta");
    expect(render("de")).toContain("Beschlagfarbe");
    expect(render("fr")).toContain("Appliquer à tous les vantaux");
    expect(render("xx")).toContain("Colore ferramenta");
  });
});
