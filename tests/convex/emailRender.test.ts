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
