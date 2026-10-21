// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

let tenant: Record<string, unknown> | null = { country: "IT", priceZone: "nord" };
vi.mock("convex/react", () => ({ useQuery: () => tenant, useMutation: () => async () => ({}) }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => (e: unknown) => String(e) }));

import { PricingTab } from "@/components/configurator/pricing-tab";

const cfg = (extra: object) => ({ tenantId: "t1", currency: "EUR", ...extra }) as never;
const render = (locale: string, messages: unknown, configurator: object) =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: messages as never, children: h(PricingTab, { configuratorId: "c1" as never, configurator: cfg(configurator) }) }));

describe("pricing tab (server render)", () => {
  it("shows slider, decimal field and the live example: Aluplast Nord 285 EUR/m2 x 1.68 m2 + 10%", () => {
    tenant = { country: "IT", priceZone: "nord" };
    const html = render("it", it_, { pricingMode: "standard", marginPercent: 10 });
    expect(html).toContain('type="range"');
    expect(html).toContain('max="100"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('value="10"');
    // Nord supply price of the Aluplast: 203.77 EUR/m2 (market 285 x calibration) x 1.68 m2 = 342.33 -> +10% = 376.56 (margin 34.23)
    expect(html).toMatch(/342,33/);
    expect(html).toMatch(/34,23/);
    expect(html).toMatch(/376,56/);
    // markup 10% = 9,09% on the selling price
    expect(html).toContain("9,09%");
  });

  it("a decimal margin is shown with a comma and valid in every language", () => {
    tenant = { country: "IT", priceZone: "sud" };
    for (const [l, m] of [["it", it_], ["en", en], ["fr", fr], ["de", de], ["nl", nl], ["ro", ro]] as const) {
      const html = render(l, m, { pricingMode: "standard", marginPercent: 12.5 });
      expect(html).toContain('value="12,5"');
      expect(html).not.toMatch(/pricingTab\.|priceGuide\.|priceZone\./);
    }
  });

  it("without a zone it asks for one and shows no example; outside Italy only the margin is offered", () => {
    tenant = { country: "IT" };
    const noZone = render("it", it_, {});
    expect(noZone).toContain("Scegli la zona per attivare il listino standard.");
    expect(noZone).not.toContain("Esempio di prezzo");
    tenant = { country: "FR" };
    const fr_ = render("it", it_, { marginPercent: 5 });
    expect(fr_).toContain("disponibile per l&#x27;Italia");
    expect(fr_).toContain('type="range"');
    expect(fr_).not.toContain("Tabella comparativa");
  });
});

describe("delivery section (server render)", () => {
  it("factory by default: two options, no rate field; own mode shows the rate and adds the service to the example", () => {
    tenant = { country: "IT", priceZone: "centro" };
    const factory = render("it", it_, { pricingMode: "standard" });
    expect(factory).toContain('name="delivery-mode"');
    expect(factory).toContain("Trasporto della fabbrica");
    expect(factory).not.toContain("Costo del mio trasportatore");
    const own = render("it", it_, { pricingMode: "standard", deliveryMode: "own", ownServicePerM2Cents: 1500 });
    expect(own).toContain("Costo del mio trasportatore");
    expect(own).toContain('value="15,00"');
    expect(own).toContain("trasportatore / montatore proprio");
  });

  it("fitting (posa): the section is always there; with a price it offers the default and shows both totals in the example", () => {
    tenant = { country: "IT", priceZone: "nord" };
    const off = render("it", it_, { pricingMode: "standard" });
    expect(off).toContain("Posa (montaggio)");
    expect(off).toContain("Lascia vuoto");
    expect(off).not.toContain('data-testid="example-posa"');
    // 80 EUR/m2 x 1.68 m2 = 134,40 on top of the supply price
    const on = render("it", it_, { pricingMode: "standard", installationPerM2Cents: 8000, installationDefault: "without" });
    expect(on).toContain('value="80,00"');
    expect(on).toContain("Con posa inclusa");
    expect(on).toContain("Solo fornitura (senza posa)");
    expect(on).toContain('data-testid="example-posa"');
    expect(on).toMatch(/342,33/);
    expect(on).toMatch(/476,73/); // 342,33 + 134,40
  });

  it("the fitting texts exist in every language", () => {
    tenant = { country: "IT", priceZone: "nord" };
    for (const [l, m] of [["it", it_], ["en", en], ["fr", fr], ["de", de], ["nl", nl], ["ro", ro]] as const) {
      const html = render(l, m, { pricingMode: "standard", installationPerM2Cents: 8000 });
      expect(html).not.toMatch(/pricingTab\./);
    }
  });
});
