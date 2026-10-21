import { describe, expect, test } from "vitest";
import {
  REFERRAL_ALPHABET,
  canonicalEmail,
  generateReferralCode,
  isDisposableEmail,
  maskCompanyName,
  normalizeReferralCode,
  referralPairProblem,
} from "../convex/lib/referral";

describe("referral code", () => {
  test("generated codes have the canonical shape and no look-alike symbols", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateReferralCode();
      expect(c).toMatch(/^OS-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      expect(normalizeReferralCode(c)).toBe(c);
    }
    expect(REFERRAL_ALPHABET).toHaveLength(31);
    expect(REFERRAL_ALPHABET).not.toMatch(/[01ILO]/);
  });

  test("generated codes are not repeating (1000 draws, 31^6 space)", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateReferralCode()));
    expect(seen.size).toBe(1000);
  });

  test("normalize forgives case, spaces, missing prefix and missing dash", () => {
    expect(normalizeReferralCode(" os-7k4m2q ")).toBe("OS-7K4M2Q");
    expect(normalizeReferralCode("7k4m2q")).toBe("OS-7K4M2Q");
    expect(normalizeReferralCode("OS7K4M2Q")).toBe("OS-7K4M2Q");
    expect(normalizeReferralCode("os- 7k4 m2q")).toBe("OS-7K4M2Q");
  });

  test("normalize refuses anything that cannot be a code", () => {
    for (const bad of ["", "   ", "OS-", "OS-12345", "OS-1234567", "OS-0OIL11", "OS-7K4M2Q-extra", "x".repeat(40), "<script>"]) {
      expect(normalizeReferralCode(bad)).toBeNull();
    }
    expect(normalizeReferralCode(undefined)).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });
});

describe("email canonicalisation and pair rules", () => {
  test("canonical form ignores +tag, case, and gmail dots", () => {
    expect(canonicalEmail("Mario.Rossi+promo@Gmail.com")).toBe("mariorossi@gmail.com");
    expect(canonicalEmail("mario.rossi@googlemail.com")).toBe("mariorossi@gmail.com");
    expect(canonicalEmail("a.b+c@azienda.it")).toBe("a.b@azienda.it");
    expect(canonicalEmail("not-an-email")).toBeNull();
    expect(canonicalEmail("")).toBeNull();
  });

  test("same person with a different spelling is a self-referral", () => {
    expect(referralPairProblem("mario.rossi@gmail.com", "marior.ossi+x@gmail.com")).toBe("SELF_REFERRAL");
  });

  test("same company domain is refused, free mailbox domains are not", () => {
    expect(referralPairProblem("anna@acme.it", "luca@acme.it")).toBe("SAME_ORGANIZATION");
    expect(referralPairProblem("anna@gmail.com", "luca@gmail.com")).toBeNull();
    expect(referralPairProblem("anna@acme.it", "luca@beta.it")).toBeNull();
  });

  test("disposable mailboxes are refused on either side", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(referralPairProblem("anna@acme.it", "x@mailinator.com")).toBe("DISPOSABLE_EMAIL");
    expect(referralPairProblem("x@yopmail.com", "luca@beta.it")).toBe("DISPOSABLE_EMAIL");
  });

  test("missing email on either side is refused", () => {
    expect(referralPairProblem(undefined, "luca@beta.it")).toBe("MISSING_EMAIL");
    expect(referralPairProblem("anna@acme.it", null)).toBe("MISSING_EMAIL");
  });
});

describe("company name masking", () => {
  test("keeps only the first two letters and a short legal form", () => {
    expect(maskCompanyName("Serramenti Rossi Srl")).toBe("Se*** Srl");
    expect(maskCompanyName("Acme")).toBe("Ac***");
    expect(maskCompanyName("Fenster Müller GmbH")).toBe("Fe*** GmbH");
    expect(maskCompanyName("Infissi Bianchi Costruzioni Moderne")).toBe("In***");
    expect(maskCompanyName("")).toBe("***");
    expect(maskCompanyName(undefined)).toBe("***");
  });
});
