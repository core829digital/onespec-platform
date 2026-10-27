// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// public/embed.js runs on every dealer's own website, so a change to it is a change to code on other people's pages.
// This pin makes any edit a conscious one: if you changed the loader on purpose, review the diff line by line
// (no eval, no innerHTML, origin + source + id checks on every message), then update the hash below.
const EMBED_JS_SHA256 = "1c2047c4f1cb4abc98ae1e5ee84450e7fbd8b1e683a917e88a2c1d1f30ba804d";

describe("public/embed.js", () => {
  const src = readFileSync("public/embed.js", "utf8");

  it("is unchanged since its last review (update the pin after reviewing a deliberate change)", () => {
    expect(createHash("sha256").update(src).digest("hex")).toBe(EMBED_JS_SHA256);
  });

  it("stays free of dynamic code execution and HTML injection", () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\s*\(|new Function|innerHTML|outerHTML|document\.write|insertAdjacentHTML|setTimeout\s*\(\s*["']/);
  });
});
