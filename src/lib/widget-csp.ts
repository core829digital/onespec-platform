import { createHash } from "node:crypto";
import { THEME_INIT } from "./theme-init";

/**
 * Content-Security-Policy of the embeddable surfaces (/w, /c, /demo), built per request by src/proxy.ts.
 *
 * Scripts: no 'unsafe-inline'. Next's own inline bootstrap scripts carry the per-request nonce (Next reads it from the CSP request header),
 * the theme-init script is allowed by hash, and 'strict-dynamic' lets those trusted scripts load the rest (Turnstile, PostHog, Speed Insights).
 * The host list is only the fallback for browsers without 'strict-dynamic' (they ignore it where supported).
 * Styles keep 'unsafe-inline': React sets inline style attributes on the SVG drawing and the layout, and CSS cannot run code.
 *
 * Everything except script-src is mirrored in next.config.mjs (tests/csp-sync.test.ts keeps the two in step).
 */
const THEME_INIT_HASH = `'sha256-${createHash("sha256").update(THEME_INIT).digest("base64")}'`;

const SCRIPT_HOSTS = "https://challenges.cloudflare.com https://va.vercel-scripts.com https://us-assets.i.posthog.com";

/** Every directive except script-src and frame-ancestors, in the order next.config.mjs lists them. */
export const WIDGET_CSP_COMMON = [
  "default-src 'self'",
  // frame-src: the Turnstile challenge renders in an iframe, not just a script — without this, default-src's 'self' fallback blocks it.
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://*.convex.cloud https://*.convex.site https://va.vercel-scripts.com https://vitals.vercel-insights.com https://us.i.posthog.com https://us-assets.i.posthog.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** A fresh, unguessable value for each request (128 bits, base64). */
export function newNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}

export function widgetScriptSrc(nonce: string, dev = process.env.NODE_ENV !== "production"): string {
  // React needs eval in development only (to rebuild server stacks in the browser); never in production.
  return `script-src 'self' 'nonce-${nonce}' ${THEME_INIT_HASH} 'strict-dynamic' ${SCRIPT_HOSTS}${dev ? " 'unsafe-eval'" : ""}`;
}

export function buildWidgetCsp(nonce: string, frameAncestors: string): string {
  return [WIDGET_CSP_COMMON[0], widgetScriptSrc(nonce), ...WIDGET_CSP_COMMON.slice(1), `frame-ancestors ${frameAncestors}`].join("; ");
}
