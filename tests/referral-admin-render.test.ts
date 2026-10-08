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

const state = vi.hoisted(() => ({ viewer: undefined as unknown, rows: undefined as unknown }));
vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => true })); // the page is rendered as if hydration were over, so the (mocked) live answers show
vi.mock("convex/react", () => ({
  useQuery: (_fn: unknown, args: unknown) => (args === undefined ? state.viewer : args === "skip" ? undefined : state.rows),
  useMutation: () => async () => null,
}));
vi.mock("@/i18n/navigation", () => ({ Link: (p: { href: string; children?: unknown }) => h("a", { href: p.href }, p.children as never) }));
vi.mock("@/hooks/useRunAction", () => ({ useRunAction: () => async () => null }));

import AdminReferralsPage from "../src/app/[locale]/app/admin/referrals/page";

const MESSAGES = { it, en, fr, de, nl, ro } as const;
const problems: string[] = [];

function render(locale: keyof typeof MESSAGES) {
  problems.length = 0;
  const out = renderToString(
    h(NextIntlClientProvider, { locale, timeZone: "UTC", messages: MESSAGES[locale] as never, onError: (e: Error) => void problems.push(e.message), children: h(AdminReferralsPage) }),
  );
  expect(problems).toEqual([]);
  return out;
}

const side = (name: string, email: string) => ({ tenantId: "t", name, email, plan: "pro", planStatus: "active" });
const ROWS = [
  { id: "r1", status: "rejected", reason: "SAME_ORGANIZATION", code: "OS-AAAAAA", createdAt: Date.UTC(2026, 9, 1), qualifiedAt: null, holdUntil: null, rewardCents: null, rewardedAt: null, clawbackNote: null, referrer: side("Acme Srl", "anna@acme.it"), referred: side("Acme Due", "marco@acme.it") },
  { id: "r2", status: "qualified", reason: null, code: "OS-BBBBBB", createdAt: Date.UTC(2026, 9, 2), qualifiedAt: Date.UTC(2026, 9, 3), holdUntil: Date.UTC(2026, 10, 2), rewardCents: 970, rewardedAt: null, clawbackNote: null, referrer: side("Beta", "b@beta.it"), referred: side("Gamma", "g@gamma.it") },
];

beforeEach(() => {
  state.viewer = { isPlatformAdmin: true };
  state.rows = ROWS;
});

describe("admin referrals page", () => {
  test("lists referrals with both accounts, reason and credit, in every language", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"] as const) {
      const html = render(l);
      expect(html).toContain("anna@acme.it");
      expect(html).toContain("SAME_ORGANIZATION");
      expect(html).toContain("OS-BBBBBB");
    }
  });
  test("non-admins see only the forbidden message, no data", () => {
    state.viewer = { isPlatformAdmin: false };
    const html = render("it");
    expect(html).toContain("riservata");
    expect(html).not.toContain("anna@acme.it");
  });
  test("loading and empty states", () => {
    state.viewer = undefined;
    expect(render("it")).toContain("Caricamento");
    state.viewer = { isPlatformAdmin: true };
    state.rows = [];
    expect(render("en")).toContain("No invitations.");
  });
  test("actions follow the status: reopen for refused, reject for open ones", () => {
    const html = render("en");
    expect(html).toContain("Reopen"); // r1 rejected
    expect(html).toContain("Reject"); // r2 qualified
  });
});
