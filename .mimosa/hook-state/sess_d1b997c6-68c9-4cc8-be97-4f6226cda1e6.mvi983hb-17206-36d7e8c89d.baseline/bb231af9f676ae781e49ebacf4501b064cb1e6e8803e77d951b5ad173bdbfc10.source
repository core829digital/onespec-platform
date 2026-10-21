// @vitest-environment node
import { createElement as h, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import it_ from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

vi.mock("convex/react", () => ({ useMutation: () => async () => ({}), useQuery: () => undefined, useAction: () => async () => ({}) }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => (e: unknown) => String(e) }));

import { AddressStep, CompanyStep, ContactStep, PricingStep, TaxStep, type OnboardingProfile } from "../src/components/onboarding/steps";

const profile: OnboardingProfile = {
  name: "Rossi Infissi Srl", vatId: "IT01234567897", street: "Via Roma 1", postalCode: "00100", city: "Roma",
  phone: "+390612345678", email: "info@rossi.it", website: "", defaultVatPercent: 22, viesAcknowledged: false,
  marginPercent: 20, deliveryMode: "factory", ownServicePerM2Cents: 0, pricingSaved: false,
};
const base = { tenantId: "t1" as never, profile, tenantCountry: "IT", onSaved: () => undefined };
const rates = [{ key: "std", percent: 22, label: "22%" }];
const MSG = { it: it_, en, fr, de, nl, ro } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (el: ComponentType<any>, props: object, locale: keyof typeof MSG = "it") =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: MSG[locale] as never, children: h(el, props) }));

describe("onboarding steps", () => {
  it("company step shows the country VAT format and enables the button for valid data", () => {
    const html = render(CompanyStep, base);
    expect(html).toContain("Partita IVA");
    expect(html).toContain("IT01234567897");
    expect(html).not.toContain('disabled=""');
  });

  it("company step blocks the button on an invalid VAT checksum", () => {
    const html = render(CompanyStep, { ...base, profile: { ...profile, vatId: "IT01234567890" } });
    expect(html).toContain('disabled=""');
  });

  it("address and contact steps render", () => {
    expect(render(AddressStep, base)).toContain("CAP");
    expect(render(ContactStep, base)).toContain("Telefono");
  });

  it("tax step explains VIES in all six languages", () => {
    const needles = { it: "VIES", en: "VIES", fr: "VIES", de: "VIES", nl: "VIES", ro: "VIES" } as const;
    for (const l of Object.keys(MSG) as (keyof typeof MSG)[]) {
      const html = render(TaxStep, { ...base, vatRates: rates }, l);
      expect(html).toContain(needles[l]);
      expect(html).toContain("2006/112");
      expect(html).not.toContain("onboarding.tax");
    }
  });

  it("pricing step asks for the zone only in Italy", () => {
    expect(render(PricingStep, { ...base, italy: true, priceZone: null })).toContain("Dove lavori in Italia");
    expect(render(PricingStep, { ...base, italy: false, priceZone: null })).not.toContain("Dove lavori in Italia");
  });
});
