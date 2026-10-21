// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test, vi } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";
import { Pagination } from "../src/components/ui/Pagination";
import { StatusBadge } from "../src/components/app-shell/status-badge";
import { MultiSupplierTable } from "../src/components/quotes/MultiSupplierTable";

vi.mock("framer-motion", () => ({ motion: new Proxy({}, { get: () => "div" }) }));

const LOCALES = { it, en, fr, de, nl, ro } as const;

function render(locale: keyof typeof LOCALES, node: React.ReactElement): string {
  const errors: unknown[] = [];
  const html = renderToStaticMarkup(
    h(NextIntlClientProvider, {
      locale,
      messages: LOCALES[locale] as never,
      timeZone: "UTC",
      onError: (e: unknown) => errors.push(e),
      children: node,
    }),
  );
  expect(errors).toEqual([]); // a missing key is reported here
  return html;
}

describe.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])("shared components in %s", (locale) => {
  test("Pagination has every label and no Italian leftovers outside it", () => {
    const html = render(locale, h(Pagination, { totalItems: 100, config: { itemsPerPage: 10 } }));
    expect(html).toContain("aria-label=");
    if (locale !== "it") expect(html).not.toMatch(/Prima pagina|Pagina successiva|Elementi per pagina/);
  });

  test("StatusBadge is translated for requests and configurators", () => {
    const quote = render(locale, h(StatusBadge, { status: "quoted" }));
    const cfg = render(locale, h(StatusBadge, { status: "published", kind: "configurator" }));
    if (locale !== "it") {
      expect(quote).not.toContain("Preventivo inviato");
      expect(cfg).not.toContain("Pubblicato");
    }
  });

  test("MultiSupplierTable empty state is translated", () => {
    const html = render(
      locale,
      h(MultiSupplierTable, { items: [], onItemsChange: () => {}, suppliers: [] }),
    );
    if (locale !== "it") expect(html).not.toContain("Nessun articolo");
  });
});
