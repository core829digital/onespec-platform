// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { renderAuthEmail } from "../convex/emails/auth";

vi.stubEnv("SITE_URL", "https://platform.example");
const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];

describe("referral emails", () => {
  test("every language renders all three emails with a subject, a button and the right link", () => {
    for (const l of LOCALES) {
      const invited = renderAuthEmail("referral_invited", l, { percent: 10 });
      const registered = renderAuthEmail("referral_registered", l, {});
      const rewarded = renderAuthEmail("referral_rewarded", l, { amount: "€9.70" });
      for (const m of [invited, registered, rewarded]) {
        expect(m.subject.length).toBeGreaterThan(8);
        expect(m.html).toContain("https://platform.example/app/");
        expect(m.text).toContain("https://platform.example/app/");
      }
      expect(invited.html).toContain("10");
      expect(rewarded.subject).toContain("€9.70");
      expect(rewarded.html).toContain("€9.70");
    }
  });

  test("copy differs per language (nothing left untranslated)", () => {
    const subjects = LOCALES.map((l) => renderAuthEmail("referral_registered", l, {}).subject);
    expect(new Set(subjects).size).toBe(6);
  });

  test("a hostile amount cannot inject HTML or break the subject", () => {
    const m = renderAuthEmail("referral_rewarded", "it", { amount: '<img src=x onerror=alert(1)>\r\nBcc: evil@x.com' });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img src=x");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });

  test("the percentage is rendered as a number only", () => {
    const m = renderAuthEmail("referral_invited", "en", { percent: "<b>x</b>" as unknown as number });
    expect(m.html).not.toContain("<b>x</b>");
  });

  test("a reward paid as money has its own wording in every language", () => {
    for (const l of LOCALES) {
      const credit = renderAuthEmail("referral_rewarded", l, { amount: "€9.70" });
      const money = renderAuthEmail("referral_rewarded", l, { amount: "€9.70", payout: "stripe" });
      expect(money.subject).toContain("€9.70");
      expect(money.subject).not.toBe(credit.subject);
      expect(money.html).not.toBe(credit.html);
      expect(money.html).toContain("Stripe");
    }
  });
});
