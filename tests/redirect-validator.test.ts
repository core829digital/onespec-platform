import { describe, expect, test } from "vitest";
import { validateRedirect, getSafeRedirect, getOptionalRedirect } from "@/lib/redirect-validator";

describe("redirect-validator", () => {
  test("accepts an invite-acceptance path (regression: was missing, causing invited members to be dropped into onboarding instead of back to the invite — 2026-09-29)", () => {
    expect(validateRedirect("/invite/abc123token")).toBe("/invite/abc123token");
    // Locale-prefixed (next-intl) variant, matching how the app actually links it.
    expect(validateRedirect("/it/invite/abc123token")).toBe("/it/invite/abc123token");
  });

  test("still accepts every other previously-allowed destination", () => {
    for (const p of ["/app/dashboard", "/auth/login", "/onboarding", "/f/tok", "/i/tok", "/w/pub", "/c/pub", "/q/tok", "/k/1234", "/legal/privacy", "/api/geo"]) {
      expect(validateRedirect(p)).toBe(p);
    }
  });

  test("still rejects an absolute/cross-origin URL (open-redirect guard)", () => {
    expect(validateRedirect("https://evil.example.com/invite/x")).toBeNull();
    expect(validateRedirect("//evil.example.com")).toBeNull();
  });

  test("still rejects a path outside the allowlist", () => {
    expect(validateRedirect("/something-random")).toBeNull();
  });

  test("getSafeRedirect falls back when invalid, getOptionalRedirect returns null", () => {
    expect(getSafeRedirect("/invite/x", "/app/dashboard")).toBe("/invite/x");
    expect(getSafeRedirect(null, "/app/dashboard")).toBe("/app/dashboard");
    expect(getSafeRedirect("https://evil.example.com", "/app/dashboard")).toBe("/app/dashboard");
    expect(getOptionalRedirect("/invite/x")).toBe("/invite/x");
    expect(getOptionalRedirect(null)).toBeNull();
  });
});
