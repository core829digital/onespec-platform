// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { ConfiguratorPicker, isShowroomReady, resolveChoice, type PickerConfigurator } from "@/components/showroom/configurator-picker";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => h("a", { href, ...rest }, children as never),
}));

const list: PickerConfigurator[] = [
  { _id: "a", name: "Vecchio", status: "published", publishedCatalogVersion: 3 },
  { _id: "b", name: "Bozza nuova", status: "draft" },
  { _id: "c", name: "Pubblicato senza versione", status: "published" },
  { _id: "d", name: "Archiviato", status: "archived", publishedCatalogVersion: 1 },
];

describe("showroom configurator choice", () => {
  it("only a published configurator with a catalogue version can be used", () => {
    expect(list.map(isShowroomReady)).toEqual([true, false, false, false]);
  });

  it("takes the first candidate that is still usable, else lets the server decide", () => {
    expect(resolveChoice(list, "a", "x")).toBe("a");
    expect(resolveChoice(list, "b", "a")).toBe("a");
    expect(resolveChoice(list, null, "a")).toBe("a");
    expect(resolveChoice(list, "b", "c", "d")).toBeUndefined();
    expect(resolveChoice(list, undefined, null)).toBeUndefined();
    expect(resolveChoice([], "a")).toBeUndefined();
  });
});

const render = (locale: string, messages: unknown, props: Parameters<typeof ConfiguratorPicker>[0]) =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: messages as never, children: h(ConfiguratorPicker, props) }));

describe("ConfiguratorPicker (server render)", () => {
  it("lists every configurator, drafts disabled and marked, the one in use selected", () => {
    const html = render("it", it_, { configurators: list, value: "a", onChange: () => {} });
    expect(html).toContain("Vecchio");
    expect(html).toContain('<option value="b" disabled="">Bozza nuova · bozza, non pubblicato</option>');
    expect(html).toMatch(/<option value="a" selected="">Vecchio<\/option>|<option value="a">Vecchio<\/option>/);
    expect(html).toContain("/app/configurators");
    expect(html).not.toContain("Nessuno dei tuoi configuratori è pubblicato");
  });

  it("explains what to do when nothing is published", () => {
    const html = render("it", it_, { configurators: [list[1]], value: undefined, onChange: () => {} });
    expect(html).toContain("Scegli un configuratore");
    expect(html).toContain("Nessuno dei tuoi configuratori è pubblicato");
  });

  it("renders nothing without configurators", () => {
    expect(render("it", it_, { configurators: [], value: undefined, onChange: () => {} })).toBe("");
  });

  it("has every text in the six languages", () => {
    for (const [l, m] of Object.entries({ it: it_, en, fr, de, nl, ro })) {
      const html = render(l, m, { configurators: [list[0], list[1]], value: "a", onChange: () => {} });
      expect(html).not.toMatch(/showroom\.configurator/);
      expect(html.length).toBeGreaterThan(300);
    }
  });
});
