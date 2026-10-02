// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test } from "vitest";
import it from "../messages/it.json";
import { SashPanel } from "../src/components/quotes/sash-panel";
import type { EditorSash } from "../src/shared/sash-rules";

function render(sash: Partial<EditorSash>): string {
  const full: EditorSash = { type: "classic", direction: "left", active: true, hardware: "maco", hardwareColor: "white", ...sash };
  const panel = h(SashPanel, {
    sash: full,
    index: 0,
    siblingTypes: [full.type],
    itemHeightMm: 1400,
    hardwareOptions: [["maco", "MACO"]],
    hardwareColorOptions: [["white", "Bianco"]],
    onPatch: () => {},
    onClose: () => {},
  });
  return renderToStaticMarkup(
    h(NextIntlClientProvider, { locale: "it", messages: it as never, timeZone: "UTC", children: panel }),
  );
}

describe("sash panel: opening direction", () => {
  test("hinged leaf: Sx/Dx with the opening explained", () => {
    const html = render({ type: "classic", direction: "right" });
    expect(html).toContain("Apertura (vista interna)");
    expect(html).toContain("da sinistra a destra");
    expect(html).toContain("da destra a sinistra");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toMatch(/cernier|maniglia\b.*\bscorrimento/i);
  });

  test("vasistas: no direction to pick, only the note", () => {
    const html = render({ type: "tilt" });
    expect(html).not.toContain("Apertura (vista interna)");
    expect(html).toContain("un solo modo di apertura");
  });

  test("fixed leaf: no direction control", () => {
    expect(render({ type: "fix" })).not.toContain("Apertura (vista interna)");
  });

  test("sliding: the side is the direction of travel", () => {
    const html = render({ type: "sliding", direction: "left" });
    expect(html).toContain("scorre verso sinistra");
    expect(html).not.toContain("da sinistra a destra");
  });
});
