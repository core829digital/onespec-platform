// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// public/embed.js runs on the pages of the dealers' customers: keep it small and boring. (Its behaviour in a real browser is
// covered by e2e/widget-iframe.mjs; here: it parses, and it stays free of the constructs that would make it dangerous.)
const src = readFileSync("public/embed.js", "utf8");

describe("public/embed.js", () => {
  it("is valid JavaScript", () => {
    expect(() => new vm.Script(src)).not.toThrow();
  });
  it("uses no eval, no innerHTML, no document.write, no remote code, no storage", () => {
    for (const bad of [/\beval\s*\(/, /new Function/, /\.innerHTML/, /\.outerHTML/, /document\.write/, /insertAdjacentHTML/, /importScripts/, /localStorage|sessionStorage|document\.cookie/, /XMLHttpRequest|fetch\s*\(/]) {
      expect(src, String(bad)).not.toMatch(bad);
    }
  });
  it("only trusts messages from the frame it created, from the platform's origin, for its own widget", () => {
    expect(src).toMatch(/e\.source !== f\.iframe\.contentWindow/);
    expect(src).toMatch(/e\.origin !== f\.origin/);
    expect(src).toMatch(/d\.publicId !== f\.id/);
  });
  it("validates the id and clamps what it applies", () => {
    expect(src).toContain("/^[A-Za-z0-9_-]{6,16}$/");
    expect(src).toMatch(/Math\.min\(20000, Math\.max\(200/);
  });
  it("is small (a loader, not a framework)", () => {
    expect(src.length).toBeLessThan(6000);
  });
  it("runs twice without creating a second frame", () => {
    // Minimal DOM stand-in: one script tag, an insertion point; the second run must find it already marked as done.
    const made: unknown[] = [];
    const attrs: Record<string, string> = { "data-onespec": "ABCDEF1234", src: "https://platform.example/embed.js" };
    const script = {
      src: attrs.src,
      getAttribute: (k: string) => attrs[k] ?? null,
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      parentNode: { insertBefore: (el: unknown) => made.push(el) },
      nextSibling: null,
    };
    const el = () => ({ style: {} as Record<string, string>, setAttribute() {}, contentWindow: {}, dispatchEvent() {} });
    const window: Record<string, unknown> = { addEventListener() {} };
    const document = { baseURI: "https://dealer.example/", querySelectorAll: () => [script], createElement: el };
    const ctx = vm.createContext({ window, document, URL, CustomEvent: class {}, isFinite, parseInt, Math });
    vm.runInContext(src, ctx);
    vm.runInContext(src, ctx);
    expect(made.length).toBe(1);
    expect((made[0] as { src: string }).src).toBe("https://platform.example/w/ABCDEF1234");
  });
});
