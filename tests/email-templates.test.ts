// @vitest-environment node
import { describe, expect, test } from "vitest";
import { renderAuthEmail, type AuthEmailData } from "../convex/emails/auth";

const TEMPLATES = ["verify", "reset", "welcome_alpha", "welcome", "new_quote_request", "quote_status_changed", "member_joined", "configurator_published", "plan_limit", "system", "team_access", "invitation", "referral_invited", "referral_registered", "referral_rewarded", "admin_resend"];
const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];

const DATA: AuthEmailData = {
  code: "123456",
  companyName: "Serramenti Rossi <script>alert(1)</script>",
  seatNumber: 3,
  leadName: "Mario \"Rossi\" <b>",
  leadEmail: "mario@example.com",
  priceCents: 123456,
  configuratorName: "Finestre PVC",
  quoteId: "abc123",
  newStatus: "won",
  userName: "Anna",
  version: 2,
  message: "Messaggio <img src=x onerror=alert(1)>",
  href: "https://platform.onespec.eu/app/dashboard",
  inviterName: "Luca",
  role: "member",
  acceptUrl: "https://platform.onespec.eu/auth/join?i=tok",
  kind: "invite",
  teamName: "Squadra posa",
  inviteeName: "Paolo",
  grade: "montatore",
  joinUrl: "https://platform.onespec.eu/auth/join?i=tok",
  expiresText: "7d",
  limit: 50,
  amount: "€ 25,00",
  percent: 20,
  payout: "credit",
};

describe("automatic e-mails: every template, every language", () => {
  for (const template of TEMPLATES) {
    for (const locale of LOCALES) {
      test(`${template} / ${locale}`, () => {
        const r = renderAuthEmail(template, locale, DATA);
        // A complete, phone-friendly document.
        expect(r.html.startsWith("<!doctype html>")).toBe(true);
        expect(r.html).toContain('name="viewport"');
        expect(r.html).toContain(`<html lang="${locale}">`);
        expect(r.html).toContain("max-width:600px");
        // Gmail clips messages above ~102 KB.
        expect(r.html.length).toBeLessThan(40_000);
        // A subject is one short line; there is always a plain-text alternative.
        expect(r.subject.trim().length).toBeGreaterThan(3);
        expect(r.subject).not.toMatch(/[\r\n]/);
        expect(r.subject.length).toBeLessThan(120);
        expect(r.text.trim().length).toBeGreaterThan(10);
        // Nothing half-filled, nothing injected.
        for (const bad of ["undefined", "NaN", "[object", "{n}", "{name}"]) expect(r.html).not.toContain(bad);
        expect(r.html).not.toContain("<script>");
        expect(r.html).not.toContain("<img src=x");
      });
    }
  }
});
