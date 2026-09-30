import { describe, expect, test } from "vitest";
import { demoCopy, demoRegisterUrl } from "../src/lib/demo/demo-copy";

const LANGS = ["it", "en", "fr", "de", "nl", "ro"];

describe("demo copy", () => {
  test("every language has a complete notice", () => {
    for (const l of LANGS) {
      const c = demoCopy(l);
      for (const k of ["title", "body", "cta", "back"] as const) expect(c[k].trim().length).toBeGreaterThan(3);
    }
    // All six are genuinely different texts (no untranslated copy of English).
    expect(new Set(LANGS.map((l) => demoCopy(l).title)).size).toBe(6);
  });

  test("unknown language falls back to English", () => {
    expect(demoCopy("xx")).toEqual(demoCopy("en"));
  });

  test("registration links point to the platform (Italian has no prefix)", () => {
    expect(demoRegisterUrl("it")).toBe("https://platform.onespec.eu/auth/register");
    expect(demoRegisterUrl("fr")).toBe("https://platform.onespec.eu/fr/auth/register");
    expect(demoRegisterUrl("zz")).toBe("https://platform.onespec.eu/en/auth/register");
  });
});
