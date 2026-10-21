import { describe, expect, test } from "vitest";
import { ERROR_COPY, ERROR_LOCALES, detectServerErrorLocale, fromLanguageList, toErrorLocale } from "../src/lib/error-copy";

describe("error screens copy", () => {
  test("every supported language has every string, non-empty, and differs from Italian (except it)", () => {
    const keys = Object.keys(ERROR_COPY.it) as Array<keyof typeof ERROR_COPY.it>;
    for (const l of ERROR_LOCALES) {
      for (const k of keys) {
        expect(ERROR_COPY[l][k], `${l}.${k}`).toBeTruthy();
        if (l !== "it") expect(ERROR_COPY[l][k], `${l}.${k} must be translated`).not.toBe(ERROR_COPY.it[k]);
      }
    }
  });

  test("language detection", () => {
    expect(toErrorLocale("fr-BE")).toBe("fr");
    expect(toErrorLocale("xx")).toBeUndefined();
    expect(fromLanguageList("nl-BE,nl;q=0.9,en;q=0.8")).toBe("nl");
    expect(fromLanguageList("ja,zh;q=0.9,de;q=0.5")).toBe("de");
    expect(detectServerErrorLocale("ro", "fr")).toBe("ro"); // cookie wins
    expect(detectServerErrorLocale(undefined, "de-DE,de;q=0.9")).toBe("de");
    expect(detectServerErrorLocale(undefined, undefined)).toBe("it");
  });
});
