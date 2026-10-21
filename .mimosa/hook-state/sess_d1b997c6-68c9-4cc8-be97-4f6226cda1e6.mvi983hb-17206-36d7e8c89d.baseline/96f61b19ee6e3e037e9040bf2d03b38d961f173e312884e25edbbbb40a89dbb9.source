// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Dead-code guard for issue #37: convex/lib/pricing.ts was a stale twin of the live
 * fiscal-preview flow with zero callers, and unlike the live path it still carried its
 * own VAT arithmetic — a copy that would silently diverge further (fiscal registry #53).
 * Keep it deleted: neither the module nor any reference to it may come back.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("dead fiscal module stays deleted (#37)", () => {
  test("convex/lib/pricing.ts does not exist", () => {
    expect(existsSync("convex/lib/pricing.ts")).toBe(false);
  });

  test("no source or generated file references lib/pricing", () => {
    const offenders = ["convex", "src", "tests"]
      .flatMap((r) => walk(r))
      .map((f) => relative(".", f).replaceAll("\\", "/"))
      .filter((f) => f !== "tests/pricing-dead-module.test.ts")
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return text.includes("lib/pricing") || text.includes("lib.pricing");
      });
    expect(offenders).toEqual([]);
  });
});
