// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { captureReferralFromUrl, clearStoredReferral, looksLikeReferralCode, readStoredReferral } from "../src/lib/referral-capture";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("referral capture", () => {
  test("stores a well-formed ?ref= and reads it back", () => {
    captureReferralFromUrl("?ref=OS-7K4M2Q&utm=x");
    expect(readStoredReferral()).toBe("OS-7K4M2Q");
  });

  test("ignores a missing or malformed ref", () => {
    captureReferralFromUrl("?foo=1");
    captureReferralFromUrl("?ref=<script>");
    captureReferralFromUrl("?ref=" + "A".repeat(50));
    expect(readStoredReferral()).toBeUndefined();
    expect(looksLikeReferralCode("OS-7K4M2Q")).toBe(true);
    expect(looksLikeReferralCode("a b")).toBe(false);
    expect(looksLikeReferralCode(null)).toBe(false);
  });

  test("expires after 30 days", () => {
    captureReferralFromUrl("?ref=OS-7K4M2Q");
    const day = 24 * 60 * 60 * 1000;
    expect(readStoredReferral(Date.now() + 29 * day)).toBe("OS-7K4M2Q");
    expect(readStoredReferral(Date.now() + 31 * day)).toBeUndefined();
    expect(readStoredReferral()).toBeUndefined(); // the expired entry was removed
  });

  test("clear removes it; corrupted storage is harmless", () => {
    captureReferralFromUrl("?ref=OS-7K4M2Q");
    clearStoredReferral();
    expect(readStoredReferral()).toBeUndefined();
    localStorage.setItem("onespec-ref", "{not json");
    expect(readStoredReferral()).toBeUndefined();
  });

  test("storage that throws never breaks the page", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } });
    expect(() => captureReferralFromUrl("?ref=OS-7K4M2Q")).not.toThrow();
    expect(readStoredReferral()).toBeUndefined();
    expect(() => clearStoredReferral()).not.toThrow();
  });
});
