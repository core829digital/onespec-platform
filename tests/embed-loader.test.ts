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
    // Raised from 6000 for the scroll shield (overlay + hint in 6 languages); still about 3 KB once compressed.
    expect(src.length).toBeLessThan(13500);
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
    const el = () => {
      const node = { style: {} as Record<string, string>, children: [] as unknown[], setAttribute() {}, contentWindow: {}, dispatchEvent() {}, appendChild: (c: unknown) => node.children.push(c) };
      return node;
    };
    const window: Record<string, unknown> = { addEventListener() {} };
    const document = { baseURI: "https://dealer.example/", querySelectorAll: () => [script], createElement: el };
    const location = { origin: "https://dealer.example", pathname: "/preventivo" };
    const ctx = vm.createContext({ window, document, location, URL, CustomEvent: class {}, isFinite, parseInt, Math });
    vm.runInContext(src, ctx);
    vm.runInContext(src, ctx);
    expect(made.length).toBe(1);
    // What lands on the page is the box holding the frame (and, with a mouse, the scroll shield).
    expect((made[0] as { children: Array<{ src: string }> }).children[0].src).toBe("https://platform.example/w/ABCDEF1234?from=https%3A%2F%2Fdealer.example%2Fpreventivo");
  });

  it("gives the frame the whole screen while the 3D render is open, then puts it back", () => {
    const attrs: Record<string, string> = { "data-onespec": "ABCDEF1234", src: "https://platform.example/embed.js" };
    const script = {
      src: attrs.src,
      getAttribute: (k: string) => attrs[k] ?? null,
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      parentNode: { insertBefore() {} },
      nextSibling: null,
    };
    let frame: { style: { cssText: string; minHeight: string; height: string }; attrs: Record<string, string>; contentWindow: object; offsetHeight: number; parentNode?: { style: { minHeight: string } } } | undefined;
    const el = () => {
      const node = {
        style: { cssText: "", minHeight: "", height: "" },
        attrs: {} as Record<string, string>,
        contentWindow: {},
        offsetHeight: 700,
        parentNode: undefined as { style: { minHeight: string } } | undefined,
        children: [] as unknown[],
        setAttribute(k: string, v: string) { node.attrs[k] = v; },
        dispatchEvent() {},
        appendChild(c: { attrs?: Record<string, string> }) { node.children.push(c); if (c.attrs) frame = c as never; (c as { parentNode?: unknown }).parentNode = node; },
      };
      return node;
    };
    let handler: ((e: unknown) => void) | undefined;
    const window = { addEventListener: (type: string, fn: (e: unknown) => void) => { if (type === "message") handler = fn; }, innerHeight: 800, self: {}, top: {} };
    (window as { self: unknown; top: unknown }).top = window.self;
    const documentElement = { style: { overflow: "" } };
    const document = { baseURI: "https://dealer.example/", documentElement, querySelectorAll: () => [script], createElement: el };
    const location = { origin: "https://dealer.example", pathname: "/" };
    const ctx = vm.createContext({ window, document, location, URL, CustomEvent: class {}, isFinite, parseInt, Math });
    vm.runInContext(src, ctx);
    expect(frame).toBeDefined();
    // The frame is allowed to use the browser's own full screen.
    expect(frame!.attrs.allow).toBe("fullscreen");
    const before = frame!.style.cssText;
    const msg = (on: boolean, origin = "https://platform.example", id = "ABCDEF1234") => ({ source: frame!.contentWindow, origin, data: { type: "onespec:fullscreen", publicId: id, on } });
    // From another origin or for another widget: ignored.
    handler!(msg(true, "https://evil.example"));
    handler!(msg(true, "https://platform.example", "OTHERID123"));
    expect(frame!.style.cssText).toBe(before);
    handler!(msg(true));
    expect(frame!.style.cssText).toContain("position:fixed");
    expect(frame!.style.cssText).toContain("z-index:2147483647");
    expect(documentElement.style.overflow).toBe("hidden");
    // A resize report while the 3D is open does not shrink it.
    handler!({ source: frame!.contentWindow, origin: "https://platform.example", data: { type: "onespec:resize", publicId: "ABCDEF1234", height: 900 } });
    expect(frame!.style.cssText).toContain("position:fixed");
    handler!(msg(false));
    expect(frame!.style.cssText).toBe(before);
    expect(documentElement.style.overflow).toBe("");
  });
});
