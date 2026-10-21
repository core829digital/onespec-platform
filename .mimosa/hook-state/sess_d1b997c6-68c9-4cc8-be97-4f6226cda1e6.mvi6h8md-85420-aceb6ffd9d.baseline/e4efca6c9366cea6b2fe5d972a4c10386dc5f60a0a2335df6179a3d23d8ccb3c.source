import { describe, expect, test } from "vitest";
import { renderAuthEmail } from "../../convex/emails/auth";

describe("renderAuthEmail — HTML injection defence", () => {
  test("a hostile leadName / leadEmail is HTML-escaped in the quote notification", () => {
    const r = renderAuthEmail("new_quote_request", "it", {
      leadName: '<img src=x onerror=alert(1)>',
      leadEmail: '"><script>alert(2)</script>',
      configuratorName: "<b>x</b>",
      priceCents: 12345,
      quoteId: "abc123",
    });
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;img src=x");
    expect(r.html).toContain("&lt;script&gt;");
    // subject stays a single line
    expect(r.subject).not.toMatch(/[\r\n]/);
  });

  test("a javascript: acceptUrl in an invitation is neutralised to #", () => {
    const r = renderAuthEmail("invitation", "en", {
      companyName: "Acme <x>",
      inviterName: "Eve</strong><script>1</script>",
      role: "admin",
      acceptUrl: "javascript:alert(1)",
    });
    expect(r.html).toContain('href="#"');
    expect(r.html).not.toContain("javascript:alert");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("Acme &lt;x&gt;");
  });

  test("legit https acceptUrl is preserved", () => {
    const r = renderAuthEmail("invitation", "en", {
      companyName: "Acme",
      acceptUrl: "https://app.onespec.io/invite/tok123",
    });
    expect(r.html).toContain('href="https://app.onespec.io/invite/tok123"');
  });
});

describe("renderAuthEmail — languages", () => {
  const TEMPLATES = [
    "verify",
    "reset",
    "welcome",
    "new_quote_request",
    "quote_status_changed",
    "member_joined",
    "configurator_published",
    "plan_limit",
    "system",
    "invitation",
  ];
  const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];
  const data = {
    code: "123456",
    companyName: "Acme",
    leadName: "Jean",
    leadEmail: "jean@example.com",
    configuratorName: "Cfg",
    priceCents: 1000,
    quoteId: "q1",
    newStatus: "won",
    userName: "Ana",
    version: 2,
    message: "m",
    role: "admin",
    acceptUrl: "https://app.onespec.io/invite/x",
    limit: 40,
    locked: true,
  };

  test("every template renders a distinct subject per language", () => {
    for (const tpl of TEMPLATES) {
      const subjects = LOCALES.map((l) => renderAuthEmail(tpl, l, data).subject);
      for (const s of subjects) expect(s.length).toBeGreaterThan(0);
      // system/notification subjects may legitimately coincide (e.g. "Notification" in en/fr)
      if (tpl !== "system") expect(new Set(subjects).size).toBeGreaterThanOrEqual(5);
    }
  });

  test("French verification email is actually French", () => {
    const r = renderAuthEmail("verify", "fr", { code: "654321" });
    expect(r.subject).toContain("code de vérification");
    expect(r.html).toContain("654321");
    expect(r.html).toContain("configurateur de menuiseries");
  });

  test("quote status is translated, never the raw key", () => {
    expect(renderAuthEmail("quote_status_changed", "de", data).subject).toContain("Gewonnen");
    expect(renderAuthEmail("quote_status_changed", "it", data).subject).not.toContain("won");
  });

  test("invitation role key is translated in the email's language", () => {
    expect(renderAuthEmail("invitation", "nl", data).html).toContain("beheerder");
    expect(renderAuthEmail("invitation", "it", { ...data, role: "member" }).html).toContain("membro");
  });

  test("plan limit renders from structured data in each language", () => {
    expect(renderAuthEmail("plan_limit", "fr", data).text).toContain("40 demandes");
    expect(renderAuthEmail("plan_limit", "en", { limit: 40, locked: false }).text).toContain("upgrade to raise the limit");
  });

  test("unknown locale falls back to Italian", () => {
    expect(renderAuthEmail("welcome", "xx", data).subject).toBe("Benvenuto in onespec");
  });
});
