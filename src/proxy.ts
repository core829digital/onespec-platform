import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { fetchQuery } from "convex/nextjs";
import { api } from "../convex/_generated/api";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Non-widget directives for /w/* — kept in sync with next.config.mjs. The
// per-tenant `frame-ancestors` is appended here, at request time.
const WIDGET_CSP_BASE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://va.vercel-scripts.com",
  "connect-src 'self' https://*.convex.cloud https://*.convex.site https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const IS_PROD = process.env.NODE_ENV === "production";
const EMBED_CACHE = new Map<string, { csp: string; expires: number }>();
const EMBED_TTL_MS = 5 * 60_000;

async function widgetCsp(publicId: string): Promise<string> {
  const cached = EMBED_CACHE.get(publicId);
  if (cached && cached.expires > Date.now()) return cached.csp;

  let ancestors = "'self'";
  try {
    const policy = await fetchQuery(api.widget.getEmbedPolicy, { publicId });
    if (policy.frameAncestors.length > 0) {
      ancestors = `'self' ${policy.frameAncestors.join(" ")}`;
    } else if (!IS_PROD) {
      // Dev convenience only — never a wildcard in production.
      ancestors = "*";
    }
  } catch {
    // Convex unreachable — fail closed to same-origin (in-app preview still works).
    ancestors = IS_PROD ? "'self'" : "*";
  }

  const csp = `${WIDGET_CSP_BASE}; frame-ancestors ${ancestors}`;
  EMBED_CACHE.set(publicId, { csp, expires: Date.now() + EMBED_TTL_MS });
  return csp;
}

const isSignedOutOnly = createRouteMatcher([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/(it|en|fr|ro|de|nl)/auth/login",
  "/(it|en|fr|ro|de|nl)/auth/register",
  "/(it|en|fr|ro|de|nl)/auth/forgot-password",
  "/(it|en|fr|ro|de|nl)/auth/reset-password",
]);

const isProtected = createRouteMatcher([
  "/app",
  "/app/(.*)",
  "/(it|en|fr|ro|de|nl)/app",
  "/(it|en|fr|ro|de|nl)/app/(.*)",
]);

function localePrefix(pathname: string): string {
  const seg = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(seg) ? `/${seg}` : "";
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const { pathname } = request.nextUrl;

    // Convex Auth's wrapper already handled /api/auth before us. /api/* passes
    // straight through.
    if (pathname.startsWith("/api/")) {
      return;
    }

    // The embeddable widget: no i18n redirects, but inject a per-tenant
    // `frame-ancestors` CSP so only the dealer's allow-listed domains can frame it.
    if (pathname.startsWith("/w/")) {
      const publicId = pathname.split("/")[2] ?? "";
      if (!/^[A-Za-z0-9_-]{6,16}$/.test(publicId)) return;
      const res = NextResponse.next();
      res.headers.set("Content-Security-Policy", await widgetCsp(publicId));
      return res;
    }

    const prefix = localePrefix(pathname);
    const authed = await convexAuth.isAuthenticated();

    if (isSignedOutOnly(request) && authed) {
      return nextjsMiddlewareRedirect(request, `${prefix}/app/dashboard`);
    }
    if (isProtected(request) && !authed) {
      return nextjsMiddlewareRedirect(request, `${prefix}/auth/login`);
    }

    return intlMiddleware(request);
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Run on everything except Next internals and static files. `/api/auth` MUST
  // be included so Convex Auth's middleware can serve it.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
