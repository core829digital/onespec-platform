// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";
import { keyForCode } from "../src/lib/errors";

const MESSAGES = { it, en, fr, de, nl, ro } as const;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "_generated") return [];
    return statSync(p).isDirectory() ? sources(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** Every stable code the backend throws on purpose (ConvexError("CODE") or ConvexError({ code: "CODE" })). */
function thrownCodes(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of sources("convex")) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/new ConvexError\(\s*(?:\{\s*code:\s*)?"([A-Z][A-Z0-9_]+)"/g)) out.set(m[1], file);
  }
  return out;
}

// Codes that are deliberately shown with the generic message: internal or operator-only paths.
const GENERIC_ON_PURPOSE = new Set<string>([]);

describe("error codes", () => {
  const codes = thrownCodes();

  test("found the codes", () => {
    expect(codes.size).toBeGreaterThan(100);
  });

  test("no deliberate backend error falls through to the generic message", () => {
    const generic = [...codes].filter(([c]) => keyForCode(c) === "generic" && !GENERIC_ON_PURPOSE.has(c));
    expect(generic.map(([c, f]) => `${c} (${f})`)).toEqual([]);
  });

  test("every message key used exists, non-empty, in every language", () => {
    const keys = new Set([...codes.keys()].map(keyForCode));
    keys.add(keyForCode("TURNSTILE_FAILED"));
    keys.add(keyForCode("UPLOAD_FAILED"));
    keys.add(keyForCode("NO_SUPPLIER_LINES"));
    keys.add(keyForCode("QUOTE_CREATE_FAILED"));
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      const table = messages.errors as Record<string, string>;
      for (const key of keys) {
        expect(typeof table[key] === "string" && table[key].trim().length > 5, `${locale}.errors.${key}`).toBe(true);
      }
    }
  });

  test("translations are real (not copies of the Italian text) outside Italian", () => {
    const table = it.errors as Record<string, string>;
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      if (locale === "it") continue;
      const other = messages.errors as Record<string, string>;
      for (const key of Object.keys(table)) {
        if (["generic"].includes(key)) continue;
        expect(other[key], `${locale}.errors.${key}`).not.toBe(table[key]);
      }
    }
  });
});
