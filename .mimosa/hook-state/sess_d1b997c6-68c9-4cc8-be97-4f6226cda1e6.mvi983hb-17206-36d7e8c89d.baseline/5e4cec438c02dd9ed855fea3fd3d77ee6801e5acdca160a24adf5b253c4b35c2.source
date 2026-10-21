// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Convex validators only check TYPES: `v.string()` accepts a 5 MB string. Every public mutation/action that takes free text must
 * therefore bound it itself (assertShortText / assertLongText / checkText / must / a length check / an allow-list). This is a
 * heuristic guard, not a proof: it fails when a new public function takes a text argument and the body contains no recognisable
 * check at all, so the omission is noticed in review rather than in production.
 */
const GUARD =
  /assert\w*\(|check\w+\(|must\(|clean\w*\(|sanitize\w*\(|normalize\w*\(|validate\w*\(|parse\w*\(|\.length\s*[<>]|\.slice\(0,|\.includes\(|\.has\(|isGrade|isValid\w*\(|company[A-Z]\w*\(|supportedCountry\(/; // companyName/companyAddress/companyContact: convex/lib/companyProfile.ts
// Arguments that are identifiers, codes or enumerations (bounded by their own lookup), not free text.
const NOT_FREE_TEXT = /(Id|id|token|key|code|email|status|kind|type|locale|lang|currency|country|plan|role|slug|pin)$/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "_generated" ? [] : files(join(dir, e.name))) : e.name.endsWith(".ts") && e.name !== "schema.ts" ? [join(dir, e.name)] : [],
  );
}

describe("server-side bounds on free text", () => {
  test("every public mutation/action with a text argument has a recognisable check", () => {
    const offenders: string[] = [];
    for (const f of files("convex")) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/export const (\w+) = (?:mutation|action)\(\{/g)) {
        const start = (m.index ?? 0) + m[0].length;
        const rest = src.slice(start);
        const next = rest.search(/\nexport const /);
        const body = next === -1 ? rest : rest.slice(0, next);
        const args = body.match(/args:\s*\{([\s\S]*?)\},\s*(?:handler|returns)/)?.[1] ?? "";
        const texts = [...args.matchAll(/(\w+):\s*v\.(?:optional\()?string\(\)/g)].map((x) => x[1]).filter((n) => !NOT_FREE_TEXT.test(n));
        // delete*/remove* only use the text to look a row up; nothing is stored.
        if (/^(delete|remove)/.test(m[1])) continue;
        if (texts.length && !GUARD.test(body)) offenders.push(`${f}: ${m[1]}(${texts.join(", ")})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
