// @vitest-environment node
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, test, vi } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

const state = vi.hoisted(() => ({ tenant: undefined as unknown, info: undefined as unknown, visible: true }));

vi.mock("convex/react", () => ({
  useQuery: (_fn: unknown, args: unknown) => (args === "skip" ? undefined : args && typeof args === "object" && "tenantId" in (args as object) ? state.info : state.tenant),
  useMutation: () => async () => ({ code: "OS-NEW234" }),
  useConvexAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: (p: { href: string; children?: unknown; className?: string }) => h("a", { href: p.href, className: p.className }, p.children as never) }));
vi.mock("@/lib/use-referral-visible", () => ({ useReferralVisible: () => state.visible }));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => () => "error" }));

import ReferralPage from "../src/app/[locale]/app/account/referral/page";

const MESSAGES = { it, en, fr, de, nl, ro } as const;
type Loc = keyof typeof MESSAGES;

const INFO = {
  enabled: true,
  eligible: true,
  code: "OS-7K4M2Q",
  shareBase: "https://onespec.eu",
  counts: { invited: 3, registered: 1, waiting: 1, rewarded: 1 },
  earnedCents: 970,
  pendingCents: 1970,
  rewardsLeftThisYear: 9,
  rules: { holdDays: 30, maxPerYear: 10 },
  rewards: {
    referrerPercent: 10,
    inviteePercent: 10,
    plans: [
      { plan: "base", name: "Base", monthlyCreditCents: 970, annualCreditCents: 9700 },
      { plan: "pro", name: "Pro", monthlyCreditCents: 1970, annualCreditCents: 19700 },
    ],
  },
  history: [
    { id: "a", status: "rewarded", company: "Se*** Srl", createdAt: Date.UTC(2026, 8, 1), holdUntil: null, rewardCents: 970 },
    { id: "b", status: "waiting", company: "Ac***", createdAt: Date.UTC(2026, 8, 20), holdUntil: Date.UTC(2026, 9, 25), rewardCents: 1970 },
    { id: "c", status: "registered", company: "Bi*** GmbH", createdAt: Date.UTC(2026, 9, 1), holdUntil: null, rewardCents: null },
  ],
};

const problems: string[] = [];

function render(locale: Loc) {
  problems.length = 0;
  const out = renderToString(
    h(
      NextIntlClientProvider,
      {
        locale,
        timeZone: "UTC",
        messages: MESSAGES[locale] as never,
        onError: (e: Error) => {
          problems.push(e.message);
        },
        children: h(ReferralPage),
      },
    ),
  );
  // a missing translation key (or any i18n problem) fails the test
  expect(problems).toEqual([]);
  return out;
}

beforeEach(() => {
  state.tenant = { _id: "t1" };
  state.info = INFO;
  state.visible = true;
});

describe("referral page", () => {
  test("shows code, link, numbers, amounts and a masked history", () => {
    const html = render("it");
    expect(html).toContain("OS-7K4M2Q");
    expect(html).toContain("https://onespec.eu/?ref=OS-7K4M2Q");
    expect(html).toContain("Se*** Srl");
    expect(html).toContain("In attesa");
    expect(html).toContain("Pro");
    expect(html).toMatch(/19[.,]70|197,00|197/); // yearly credit for Pro is 197 EUR
    expect(html).toContain("wa.me");
    expect(html).toContain("10%");
  });

  test("the shared link carries the language prefix (not Italian)", () => {
    expect(render("fr")).toContain("https://onespec.eu/fr/?ref=OS-7K4M2Q");
  });

  test("renders in all six languages with every key present", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"] as Loc[]) {
      const html = render(l);
      expect(html.length).toBeGreaterThan(1500);
      expect(html).toContain("OS-7K4M2Q");
    }
  });

  test("loading and unavailable states", () => {
    state.tenant = undefined;
    expect(render("it")).toContain("Caricamento");
    state.tenant = { _id: "t1" };
    state.visible = false;
    const html = render("it");
    expect(html).toContain("Programma non disponibile");
    expect(html).not.toContain("OS-7K4M2Q");
  });

  test("an eligible account without a code yet sees the creating message", () => {
    state.info = { ...INFO, code: null };
    const html = render("it");
    expect(html).toContain("Sto creando il tuo codice");
    expect(html).not.toContain("wa.me");
  });

  test("empty history", () => {
    state.info = { ...INFO, history: [], counts: { invited: 0, registered: 0, waiting: 0, rewarded: 0 } };
    expect(render("en")).toContain("No invitations yet");
  });
});
