// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// public/embed.js runs on every dealer's own website, so a change to it is a change to code on other people's pages.
// This pin makes any edit a conscious one: if you changed the loader on purpose, review the diff line by line
// (no eval, no innerHTML, origin + source + id checks on every message), then update the hash below.
const EMBED_JS_SHA256 = "dc1e2b6a81711bcf9e477ec010c8f34bb2864d71db0ff486b9c82f85f0cc255a";

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
