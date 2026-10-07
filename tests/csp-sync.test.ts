// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_INIT } from "@/lib/theme-init";
import { buildWidgetCsp, newNonce, widgetScriptSrc } from "@/lib/widget-csp";
import { createHash } from "node:crypto";

// The widget's Content-Security-Policy is built per request in src/lib/widget-csp.ts (nonce for scripts + per-dealer frame-ancestors) and applied by src/proxy.ts.
const directives = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d]));

describe("widget CSP", () => {
  const nonce = newNonce();
  const csp = buildWidgetCsp(nonce, "'self' https://dealer.example");
  const d = directives(csp);

  it("never allows inline or eval scripts in production", () => {
    const prod = widgetScriptSrc(nonce, false);
    expect(prod).not.toContain("'unsafe-inline'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain(`'nonce-${nonce}'`);
    expect(prod).toContain("'strict-dynamic'");
    expect(widgetScriptSrc(nonce, true)).toContain("'unsafe-eval'"); // development only
  });

  it("allows the theme-init inline script by its hash", () => {
    const hash = createHash("sha256").update(THEME_INIT).digest("base64");
    expect(d["script-src"]).toContain(`'sha256-${hash}'`);
  });

  it("uses a fresh, long nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    expect([...nonces][0].length).toBeGreaterThanOrEqual(22);
  });

  it("keeps the protections the embed relies on", () => {
    expect(d["default-src"]).toBe("default-src 'self'");
    expect(d["object-src"]).toBe("object-src 'none'");
    expect(d["base-uri"]).toBe("base-uri 'self'");
    expect(d["form-action"]).toBe("form-action 'self'");
    expect(d["frame-src"]).toBe("frame-src https://challenges.cloudflare.com"); // the Turnstile challenge is an iframe
    expect(d["frame-ancestors"]).toBe("frame-ancestors 'self' https://dealer.example");
    expect(csp).not.toMatch(/\*(?![.]convex)(?!\s*;)(?!$)/); // no bare wildcard source (only the convex sub-domain wildcards)
  });

  it("is not duplicated as a static header (two CSPs would be intersected and block the nonce)", () => {
    const config = readFileSync("next.config.mjs", "utf8");
    expect(config).not.toMatch(/value:\s*WIDGET_CSP/);
    expect(config.match(/key: "Content-Security-Policy"/g)).toHaveLength(1); // only the app's frame-ancestors 'none'
    expect(config).not.toContain("script-src");
  });

  it("is applied by the proxy to every embeddable path", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain("nextWithCsp(request, ancestors)");
    expect(proxy).toContain('pathname.startsWith("/demo/")');
    expect(proxy).not.toContain("unsafe-inline");
  });
});

describe("application CSP (report-only phase)", () => {
  it("is report-only, never enforced, and sends reports to Sentry", async () => {
    const { APP_CSP_REPORT_ONLY } = await import("../csp-report-only.mjs");
    const config = readFileSync("next.config.mjs", "utf8");
    expect(config).toContain('key: "Content-Security-Policy-Report-Only"');
    expect(config.match(/key: "Content-Security-Policy"/g)).toHaveLength(1); // the enforced one stays frame-ancestors only
    expect(APP_CSP_REPORT_ONLY).toContain("report-uri https://");
    expect(APP_CSP_REPORT_ONLY).toContain("object-src 'none'");
    expect(APP_CSP_REPORT_ONLY).not.toContain("frame-ancestors"); // not allowed in report-only via meta, and the enforced header owns it
  });
});
