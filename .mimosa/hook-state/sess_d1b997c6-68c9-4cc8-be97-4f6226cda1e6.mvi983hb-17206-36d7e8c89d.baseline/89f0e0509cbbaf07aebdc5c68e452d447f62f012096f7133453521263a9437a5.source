// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { PriceGuide } from "@/components/pricing/price-guide";
import { ZonePicker } from "@/components/pricing/zone-picker";
import { STANDARD_PROFILES, ZONE_REGIONS, averageComplete } from "@/shared/standard-pricing";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

const LOCALES: Array<[string, unknown]> = [["it", it_], ["en", en], ["fr", fr], ["de", de], ["nl", nl], ["ro", ro]];
const render = (locale: string, messages: unknown, node: unknown, props: object) =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: messages as never, children: h(node as never, props as never) }));

describe("price guide", () => {
  it.each(LOCALES)("renders every section with real numbers in %s (no missing keys)", (locale, messages) => {
    const html = render(locale, messages, PriceGuide, {});
    // All 12 profiles and the three zone averages computed from the table (365 / 345 / 325).
    for (const sp of STANDARD_PROFILES) expect(html).toContain(sp.name.replace("&", "&amp;"));
    for (const z of ["nord", "centro", "sud"] as const) expect(html.replace(/[\s  .,]/g, "")).toContain(String(averageComplete(z)));
    expect(html).toMatch(/12[.,]5/);
    expect(html).not.toMatch(/priceGuide\.|priceZone\./);
    // The example: 500 + 20% = 600, profit 100 = 16.67% of the selling price.
    expect(html).toMatch(/600/);
    expect(html).toMatch(/16[.,]67/);
  });

  it("zone picker is a radio group with regions and the chosen zone checked", () => {
    const html = render("it", it_, ZonePicker, { value: "centro", onChange: () => {} });
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/value="centro"[^>]*checked|checked[^>]*value="centro"/);
    for (const r of ZONE_REGIONS.sud) expect(html).toContain(r);
  });
});
