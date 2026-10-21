import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("live queries are hydration-safe", () => {
  it("no component imports useQuery straight from convex/react (use @/lib/convex-query: React error #418 otherwise)", () => {
    const offenders = walk("src")
      .filter((f) => !f.endsWith("convex-query.ts"))
      .filter((f) => /import \{[^}]*\buseQuery\b[^}]*\} from "convex\/react"/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
