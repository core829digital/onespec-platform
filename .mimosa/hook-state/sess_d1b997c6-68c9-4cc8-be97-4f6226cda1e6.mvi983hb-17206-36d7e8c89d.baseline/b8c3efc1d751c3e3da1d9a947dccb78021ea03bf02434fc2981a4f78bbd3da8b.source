import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every literal `t("key")` call must resolve in every locale file: next-intl
 * throws / renders the raw key at runtime for a missing message, so a typo or
 * a forgotten locale would only surface in production.
 */
const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(join(__dirname, "..", "messages", `${l}.json`), "utf8"))]),
);

function has(obj: unknown, path: string): boolean {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !(part in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return true;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

describe("i18n keys", () => {
  test("every literal t(\"…\") key exists in all six locales", () => {
    const missing: string[] = [];
    for (const file of walk(join(__dirname, "..", "src"))) {
      const src = readFileSync(file, "utf8");
      // Each call resolves against the NEAREST preceding declaration of that
      // translator name: files often hold several components, each binding
      // `t` to its own namespace.
      const decls = [...src.matchAll(/const (\w+) = (?:useTranslations|await getTranslations)\(\s*"([^"]+)"\s*\)/g)].map(
        (m) => ({ name: m[1], ns: m[2], at: m.index ?? 0 }),
      );
      for (const name of new Set(decls.map((d) => d.name))) {
        const call = new RegExp(`\\b${name}\\(\\s*"([A-Za-z0-9_.]+)"`, "g");
        for (const m of src.matchAll(call)) {
          const at = m.index ?? 0;
          const decl = decls.filter((d) => d.name === name && d.at < at).pop();
          if (!decl) continue;
          const key = `${decl.ns}.${m[1]}`;
          for (const l of LOCALES) if (!has(messages[l], key)) missing.push(`${l}: ${key}  (${file.split("/src/")[1]})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
