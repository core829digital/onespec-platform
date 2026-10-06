// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The widget's Content-Security-Policy exists twice: as the static header in next.config.mjs (the fallback) and in src/proxy.ts, where the
// per-dealer `frame-ancestors` is appended at request time. They must say the same thing, or a change to one silently weakens or breaks the other.
const list = (src: string, name: string): string[] => {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]\\.join\\("; "\\)`).exec(src);
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((x) => x[1]);
};

describe("widget CSP", () => {
  const config = list(readFileSync("next.config.mjs", "utf8"), "WIDGET_CSP");
  const proxy = list(readFileSync("src/proxy.ts", "utf8"), "WIDGET_CSP_BASE");

  it("is identical in next.config.mjs and src/proxy.ts", () => {
    expect(config.length).toBeGreaterThan(5);
    expect(proxy).toEqual(config);
  });

  it("keeps the protections the embed relies on", () => {
    const csp = config.join("; ");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com"); // the Turnstile challenge is an iframe
    expect(csp).not.toMatch(/\*(?![.]convex)(?!\s*;)/); // no bare wildcard source (only the convex sub-domain wildcards)
    expect(csp).not.toContain("frame-ancestors"); // appended per dealer at request time
    expect(csp).not.toContain("unsafe-eval");
  });
});
