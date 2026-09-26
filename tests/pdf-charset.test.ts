import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// Built-in Helvetica covers Windows-1252 only; anything else prints as garbage.
const WIN1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));

test("PDF documents only use characters Helvetica can render", () => {
  const dir = join(__dirname, "..", "src", "lib", "pdfs");
  const bad: string[] = [];
  for (const f of readdirSync(dir).filter((n) => /PDF\.tsx$/.test(n))) {
    readFileSync(join(dir, f), "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        const chars = [...line].filter((c) => c.codePointAt(0)! > 255 && !WIN1252_EXTRA.has(c));
        if (chars.length) bad.push(`${f}:${i + 1} ${[...new Set(chars)].join(" ")}`);
      });
  }
  expect(bad).toEqual([]);
});
