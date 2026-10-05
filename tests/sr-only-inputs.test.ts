import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A visually hidden (sr-only) radio / checkbox is absolutely positioned. Without a positioned ancestor it sits at the page origin, and
// focusing it on click scrolls the app shell (overflow hidden) up: the sidebar and the top bar slide over the content and the bottom of the
// screen goes blank. Every label that wraps one must therefore be `relative`.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("sr-only inputs", () => {
  it("are always inside a positioned (relative) label", () => {
    const offenders: string[] = [];
    for (const f of files("src")) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("sr-only") || !/type="(radio|checkbox)"/.test(lines.slice(Math.max(0, i - 6), i + 1).join(" "))) return;
        for (let j = i; j >= Math.max(0, i - 12); j--) {
          if (/<label\b/.test(lines[j]) || (lines[j].includes("className=") && lines[j].includes("cursor-pointer"))) {
            if (!/\brelative\b/.test(lines[j])) offenders.push(`${f}:${j + 1}`);
            return;
          }
        }
        offenders.push(`${f}:${i + 1} (no label found)`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
