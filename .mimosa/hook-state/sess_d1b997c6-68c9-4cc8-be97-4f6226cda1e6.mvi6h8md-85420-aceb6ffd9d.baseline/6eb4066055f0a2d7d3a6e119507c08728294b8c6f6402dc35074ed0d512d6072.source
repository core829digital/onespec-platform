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

let lastCheck: unknown = null;
vi.mock("convex/react", () => ({ useQuery: () => lastCheck, useAction: () => async () => ({ status: "valid" }) }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => (e: unknown) => String(e) }));

import { FiscalPanel, emptyFiscal, useFiscal, type FiscalState } from "../src/components/quotes/fiscal-panel";

const OPTIONS = [{ percent: 22, label: "22%" }, { percent: 10, label: "10%" }, { percent: 4, label: "4%" }];

function Harness({ state, requested = 22 }: { state: FiscalState; requested?: number }) {
  const res = useFiscal("t1" as never, "IT", state, requested);
  return h(FiscalPanel, { tenantId: "t1" as never, value: state, onChange: () => undefined, resolution: res, vatOptions: OPTIONS, requestedPercent: requested, onRequestedPercent: () => undefined });
}
const render = (state: FiscalState, locale = "it", messages: unknown = it_, requested = 22) =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: messages as never, children: h(Harness, { state, requested }) }));

const biz = (country: string, vat = ""): FiscalState => ({ ...emptyFiscal(country), buyerIsBusiness: true, buyerVatId: vat });
const fresh = (valid = true) => ({ valid, checkedAt: Date.now(), name: "ACME GMBH", address: null });

describe("fiscal panel", () => {
  it("domestic customer: national rate, no VIES, rate select enabled", () => {
    lastCheck = null;
    const html = render({ ...emptyFiscal("IT") });
    expect(html).toContain("aliquota IVA nazionale");
    expect(html).not.toContain("Verifica VIES");
    expect(html).not.toContain("disabled");
  });

  it("foreign EU business, not yet verified: 0% is blocked, the national rate is still applied", () => {
    lastCheck = null;
    const html = render(biz("DE", "DE136695976"), "it", it_, 0);
    expect(html).toContain("Verifica VIES");
    expect(html).toContain("verifica VIES (obbligatoria)");
    expect(html).toContain("Non ancora verificata in VIES");
  });

  it("verified in VIES: forced 0% with reverse charge, the rate select is locked, the proof is shown", () => {
    lastCheck = fresh(true);
    const html = render(biz("DE", "DE136695976"));
    expect(html).toContain("inversione contabile");
    expect(html).toContain("IVA applicata: 0%");
    expect(html).toContain("ACME GMBH");
    expect(html).toMatch(/<select id="fiscal-rate"[^>]*disabled/);
  });

  it("a VIES answer that says 'not active' keeps the customer on the national rate", () => {
    lastCheck = fresh(false);
    const html = render(biz("DE", "DE136695976"));
    expect(html).toContain("Non risulta attiva in VIES");
    expect(html).toContain("IVA applicata: 22%");
  });

  it("customer outside the EU: export 0%, no VIES button", () => {
    lastCheck = null;
    const html = render(biz("CH"));
    expect(html).toContain("esportazione, IVA 0%");
    expect(html).not.toContain("Verifica VIES");
  });

  it("a wrong VAT number shows the reason and blocks", () => {
    lastCheck = null;
    expect(render(biz("DE", "DE136695977"))).toContain("ultima cifra di controllo non torna");
    expect(render(biz("DE", "FR40303265045"))).toContain("prefisso della partita IVA");
    expect(render(biz("DE", "DE13669597"))).toContain("formato giusto");
  });

  it("a private customer has no VAT field; a manual 0% asks for the reason", () => {
    lastCheck = null;
    const priv = render({ ...emptyFiscal("FR"), buyerIsBusiness: false });
    expect(priv).not.toContain('id="fiscal-vat"');
    const manual = render({ ...emptyFiscal("IT"), manualZero: true, manualReason: "" }, "it", it_, 22);
    expect(manual).toContain('id="fiscal-reason"');
    expect(manual).toContain("motivo dell&#x27;esenzione");
  });

  it.each([["it", it_], ["en", en], ["fr", fr], ["de", de], ["nl", nl], ["ro", ro]] as const)("renders in %s with no missing key", (l, m) => {
    lastCheck = fresh(true);
    expect(render(biz("DE", "DE136695976"), l, m)).not.toMatch(/fiscal\.|errors\./);
  });
});
