import { describe, expect, test, vi } from "vitest";
import { ageOn, checkBirthDate, checkPassword, checkSignup } from "../src/shared/signup";
import { withInputGuards } from "../convex/lib/authGuard";

const NOW = new Date("2026-10-09T10:00:00Z");
const base = { name: "Mario Rossi", email: "Mario@Example.COM ", password: "abcdef12", birthDate: "1990-05-20", termsAccepted: true };

describe("age", () => {
  test("whole years, birthday not yet reached", () => {
    expect(ageOn("2008-10-09", NOW)).toBe(18);
    expect(ageOn("2008-10-10", NOW)).toBe(17);
    expect(ageOn("2024-02-30", NOW)).toBeNull(); // not a real date
    expect(ageOn("20/05/1990", NOW)).toBeNull();
  });
  test("18+ required, nonsense refused", () => {
    expect(checkBirthDate("2008-10-09", NOW)).toMatchObject({ ok: true });
    expect(checkBirthDate("2008-10-10", NOW)).toEqual({ ok: false, code: "UNDERAGE" });
    expect(checkBirthDate("2030-01-01", NOW)).toEqual({ ok: false, code: "BIRTHDATE_FORMAT" });
    expect(checkBirthDate("1800-01-01", NOW)).toEqual({ ok: false, code: "BIRTHDATE_FORMAT" });
    expect(checkBirthDate("", NOW)).toEqual({ ok: false, code: "REQUIRED" });
    expect(checkBirthDate(19900101, NOW)).toEqual({ ok: false, code: "REQUIRED" });
  });
});

describe("password", () => {
  test("length, letter+digit, not the e-mail, no control characters", () => {
    expect(checkPassword("abcdef12")).toMatchObject({ ok: true });
    expect(checkPassword("abc12")).toEqual({ ok: false, code: "PASSWORD_WEAK" });
    expect(checkPassword("abcdefgh")).toEqual({ ok: false, code: "PASSWORD_WEAK" });
    expect(checkPassword("12345678")).toEqual({ ok: false, code: "PASSWORD_WEAK" });
    expect(checkPassword("a1".repeat(65))).toEqual({ ok: false, code: "PASSWORD_TOO_LONG" });
    expect(checkPassword("abcd\u0000ef12")).toEqual({ ok: false, code: "INVALID_CHARS" });
    expect(checkPassword("x@y.it1", "X@Y.it1")).toEqual({ ok: false, code: "PASSWORD_WEAK" });
  });
});

describe("checkSignup", () => {
  test("cleans name and e-mail", () => {
    const r = checkSignup(base, NOW);
    expect(r).toMatchObject({ ok: true, value: { name: "Mario Rossi", email: "mario@example.com", birthDate: "1990-05-20" } });
  });
  test("each problem names its field", () => {
    expect(checkSignup({ ...base, name: "<b>x</b>" }, NOW)).toMatchObject({ ok: false, field: "name" });
    expect(checkSignup({ ...base, email: "nope" }, NOW)).toMatchObject({ ok: false, field: "email", code: "EMAIL_FORMAT" });
    expect(checkSignup({ ...base, birthDate: "2015-01-01" }, NOW)).toMatchObject({ ok: false, field: "birthDate", code: "UNDERAGE" });
    expect(checkSignup({ ...base, termsAccepted: false }, NOW)).toMatchObject({ ok: false, field: "terms", code: "TERMS_REQUIRED" });
  });
  test("company data is validated per country; DPA needs VAT + address", () => {
    const company = { companyName: "Serramenti Rossi Srl", country: "IT", vatId: "IT00905811006", street: "Via Roma 1", postalCode: "00100", city: "Roma" };
    const ok = checkSignup({ ...base, ...company, dpaAccepted: true }, NOW);
    expect(ok).toMatchObject({ ok: true, value: { company: { vatId: "IT00905811006", city: "Roma" }, dpa: { signerName: "Mario Rossi" } } });
    expect(checkSignup({ ...base, ...company, vatId: "IT00905811007" }, NOW)).toMatchObject({ ok: false, field: "vatId" });
    expect(checkSignup({ ...base, ...company, postalCode: "1234" }, NOW)).toMatchObject({ ok: false, field: "postalCode" });
    expect(checkSignup({ ...base, ...company, country: "ZZ" }, NOW)).toMatchObject({ ok: false, field: "country" });
    expect(checkSignup({ ...base, companyName: "Acme Srl", country: "IT", dpaAccepted: true }, NOW)).toMatchObject({ ok: false, field: "dpa", code: "DPA_REQUIRED" });
    expect(checkSignup({ ...base, dpaAccepted: true }, NOW)).toMatchObject({ ok: false, field: "dpa" });
    // Company is optional at sign-up.
    expect(checkSignup(base, NOW)).toMatchObject({ ok: true });
  });
});

describe("withInputGuards", () => {
  const inner = vi.fn(async (p: Record<string, unknown>) => p);
  const guarded = withInputGuards(inner as never);
  test("normalises the e-mail on every flow before the library sees it", async () => {
    inner.mockClear();
    await guarded({ flow: "signIn", email: "  A@X.com ", password: "whatever1" }, {});
    expect(inner.mock.calls[0][0]).toMatchObject({ email: "a@x.com" });
    await guarded({ flow: "reset", email: "B@X.com" }, {});
    expect(inner.mock.calls[1][0]).toMatchObject({ email: "b@x.com" });
  });
  test("refuses bad e-mails, huge or missing passwords, incomplete sign-ups", async () => {
    inner.mockClear();
    await expect(guarded({ flow: "signIn", email: "x", password: "a" }, {})).rejects.toThrow("VALIDATION_EMAIL_FORMAT");
    await expect(guarded({ flow: "signIn", email: "a@b.co", password: "x".repeat(500) }, {})).rejects.toThrow("INVALID_INPUT");
    await expect(guarded({ flow: "signIn", email: "a@b.co" }, {})).rejects.toThrow("INVALID_INPUT");
    await expect(guarded({ flow: "signUp", ...base, birthDate: "2015-01-01" }, {})).rejects.toThrow("VALIDATION_UNDERAGE");
    await expect(guarded({ flow: "signUp", ...base, termsAccepted: false }, {})).rejects.toThrow("VALIDATION_TERMS_REQUIRED");
    expect(inner).not.toHaveBeenCalled();
  });
  test("a valid sign-up goes through with cleaned values", async () => {
    inner.mockClear();
    await guarded({ flow: "signUp", ...base }, {});
    expect(inner.mock.calls[0][0]).toMatchObject({ email: "mario@example.com", name: "Mario Rossi" });
  });
});
