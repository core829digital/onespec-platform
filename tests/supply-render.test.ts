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

let queryResult: unknown;
vi.mock("convex/react", () => ({ useQuery: () => queryResult, useMutation: () => async () => ({}), useAction: () => async () => ({}) }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => (e: unknown) => String(e) }));
vi.mock("@/lib/confirm-dialog", () => ({ requestConfirm: async () => true }));

import { SupplyCard } from "../src/components/supply/supply-card";
import { ProfitPanel } from "../src/components/supply/profit-panel";
import { NAV_GROUPS } from "../src/components/app-shell/nav-items";
import { PROFIT_WINDOWS_MONTHS } from "../src/shared/supply";

const MSG = { it: it_, en, fr, de, nl, ro } as const;
const wrap = (el: ReturnType<typeof h>, locale: keyof typeof MSG = "it") =>
  renderToStaticMarkup(h(NextIntlClientProvider, { locale, messages: MSG[locale] as never, children: el }));

const base = { _id: "s1", _creationTime: 1, tenantId: "t1", quoteId: "q1", reference: "Q-2026-0007", customerName: "Giuseppe Verdi", revenueExVatCents: 100000, quotedAt: 1, createdAt: 1, updatedAt: 1, costCents: 0, profitCents: 100000 };
const partners = [{ _id: "p1", name: "Winarhi Srl", roles: ["producer", "deliverer"] }];
const card = (over: object, isAdmin = false, locale: keyof typeof MSG = "it") =>
  wrap(h(SupplyCard, { supply: { ...base, status: "quote", ...over } as never, partners: partners as never, isAdmin }), locale);

describe("supply card", () => {
  it("quote stage offers the order step; revert and delete need admin", () => {
    const html = card({});
    expect(html).toContain("Segna come ordinato");
    expect(html).not.toContain("Passo indietro");
    expect(card({}, true)).toContain("Elimina");
  });
  it("order stage asks for the factory cost on the way to production", () => {
    const html = card({ status: "order" });
    expect(html).toContain("Manda in produzione");
    expect(html).toContain("Costo fabbrica (senza IVA)");
    expect(html).toContain("Winarhi Srl");
  });
  it("production stage asks for transport and shows the factory payment state", () => {
    const html = card({ status: "production", factoryCostCents: 60000, profitCents: 40000 });
    expect(html).toContain("Avvia la consegna");
    expect(html).toContain("Fabbrica da pagare");
    expect(html).toContain("Segna come pagata");
  });
  it("delivered supply has no further step", () => {
    const html = card({ status: "delivered", factoryCostCents: 60000, transportCostCents: 2000, deliveredAt: Date.UTC(2026, 8, 1), profitCents: 38000 });
    expect(html).not.toContain("Segna come consegnata");
    expect(html).toContain("Consegnata");
  });
  it("renders in all six languages without missing keys", () => {
    for (const l of Object.keys(MSG) as (keyof typeof MSG)[]) {
      const html = card({ status: "order" }, true, l);
      expect(html).not.toMatch(/supply\.(stages|advance|fields)/);
    }
  });
});

describe("profit panel", () => {
  it("shows the eight periods in every language", () => {
    const windows = PROFIT_WINDOWS_MONTHS.map((months) => ({ months, from: 0, to: 1, count: 2, revenueExVatCents: 300000, costCents: 200000, netProfitCents: 100000 }));
    queryResult = { now: 1, windows, expected: { count: 1, revenueExVatCents: 5, costCents: 1, netProfitCents: 4 } };
    for (const l of Object.keys(MSG) as (keyof typeof MSG)[]) {
      const html = wrap(h(ProfitPanel, { tenantId: "t1" as never }), l);
      expect(html).not.toContain("supply.profit");
      expect((html.match(/tabular-nums/g) ?? []).length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("navigation", () => {
  it("has the Fornitura entry, available on every plan", () => {
    const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === "/app/supply");
    expect(item).toBeDefined();
    expect(item?.feature).toBeUndefined();
    for (const m of Object.values(MSG)) expect(typeof (m.nav as Record<string, unknown>).supply).toBe("string");
  });
});
