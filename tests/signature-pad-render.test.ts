// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import { SignaturePad, SignaturePadBase } from "../src/components/signature-pad";

describe("signature pad markup", () => {
  it("the themed pad sits on the theme's background (dark page, dark pad) and says where to sign", () => {
    const html = renderToStaticMarkup(h(SignaturePadBase, { onChange: () => {}, hint: "Firma qui", clearLabel: "Cancella" }));
    expect(html).toContain("bg-[var(--color-bg)]");
    expect(html).not.toContain("bg-white");
    expect(html).toContain('aria-label="Firma qui"');
    expect(html).toContain("Firma qui");
    expect(html).not.toContain("Cancella"); // nothing to clear yet
  });

  it("the paper pad (installer's phone page) is always a white sheet", () => {
    const html = renderToStaticMarkup(h(SignaturePadBase, { onChange: () => {}, hint: "Signez ici", clearLabel: "Effacer", surface: "paper" }));
    expect(html).toContain("bg-white");
    expect(html).toContain("border-zinc-300");
  });

  it("the platform pad speaks the page's language, and can be locked while saving", () => {
    for (const [locale, msgs, hint] of [["it", it_, it_.signaturePad.hint], ["en", en, en.signaturePad.hint]] as const) {
      const html = renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: msgs as never, children: h(SignaturePad, { onChange: () => {}, disabled: true }) }));
      expect(html).toContain(hint);
      expect(html).toContain("pointer-events-none opacity-50");
    }
  });
});
