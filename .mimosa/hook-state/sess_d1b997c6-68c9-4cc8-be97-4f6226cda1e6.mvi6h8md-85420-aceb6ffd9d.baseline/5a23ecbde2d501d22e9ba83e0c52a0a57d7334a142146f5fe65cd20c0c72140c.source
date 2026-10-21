import { describe, expect, test } from "vitest";
import { base32Decode, base32Encode, otpauthUri, totpAt, verifyTotp } from "../convex/lib/totp";

// RFC 6238 Appendix B: secret "12345678901234567890" (SHA-1). The RFC lists 8-digit codes; ours are the last 6 digits of the same value.
const SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  test.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])("code at t=%i is %s (RFC vector)", async (t, code) => {
    expect(await totpAt(SECRET, t * 1000)).toBe(code);
  });

  test("base32 round-trips and ignores spaces, dashes and case", () => {
    const bytes = Uint8Array.from([1, 2, 3, 250, 251, 252, 0, 99, 100]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
    expect(base32Decode("gezd gnbv-gy3t qojq")).toEqual(base32Decode("GEZDGNBVGY3TQOJQ"));
    expect(() => base32Decode("0189")).toThrow();
  });

  test("accepts the previous and next step, refuses two steps away", async () => {
    const now = 1_700_000_000_000;
    expect(await verifyTotp(SECRET, await totpAt(SECRET, now - 30_000), now)).not.toBeNull();
    expect(await verifyTotp(SECRET, await totpAt(SECRET, now + 30_000), now)).not.toBeNull();
    expect(await verifyTotp(SECRET, await totpAt(SECRET, now - 90_000), now)).toBeNull();
  });

  test("a code already used (step <= lastStep) is never accepted again", async () => {
    const now = 1_700_000_000_000;
    const code = await totpAt(SECRET, now);
    const step = await verifyTotp(SECRET, code, now);
    expect(step).not.toBeNull();
    expect(await verifyTotp(SECRET, code, now, step!)).toBeNull();
  });

  test("malformed codes are refused", async () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 345"]) expect(await verifyTotp(SECRET, bad, 1_700_000_000_000)).toBeNull();
  });

  test("otpauth link carries issuer, account and parameters", () => {
    const uri = otpauthUri("OneSpec", "a+b@x.com", "ABC");
    expect(uri).toBe("otpauth://totp/OneSpec:a%2Bb%40x.com?secret=ABC&issuer=OneSpec&algorithm=SHA1&digits=6&period=30");
  });
});
