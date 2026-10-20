import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

// Issue #32: an outbound call without a deadline blocks its action until the platform timeout when a provider hangs.
test("every outbound fetch in convex/ carries an abort signal", () => {
  const root = join(__dirname, "..", "convex");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (n === "_generated" || n === "node_modules") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith(".ts")) files.push(p);
    }
  };
  walk(root);
  const missing: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bfetch\(/g)) {
      // The call's argument list: up to the matching closing parenthesis.
      let depth = 0;
      let end = m.index! + "fetch".length;
      for (; end < src.length; end++) {
        if (src[end] === "(") depth++;
        else if (src[end] === ")" && --depth === 0) break;
      }
      if (!/\bsignal\b/.test(src.slice(m.index!, end))) {
        missing.push(`${relative(root, f)}:${src.slice(0, m.index!).split("\n").length}`);
      }
    }
  }
  expect(missing).toEqual([]);
});
