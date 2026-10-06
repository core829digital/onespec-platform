import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { fetchQuery } from "convex/nextjs";
import { api } from "../convex/_generated/api";
import { routing } from "./i18n/routing";
import { localeForCountry } from "./lib/country-locale";
import { buildWidgetCsp, newNonce } from "./lib/widget-csp";

const intlMiddleware = createMiddleware(routing);

const IS_PROD = process.env.NODE_ENV === "production";
const EMBED_CACHE = new Map<string, { ancestors: string; expires: number }>();
const EMBED_TTL_MS = 5 * 60_000;
const EMBED_CACHE_MAX = 5_000;

/** The `frame-ancestors` source list of one widget (cached; the nonce-bearing rest of the CSP is built per request). */
async function widgetAncestors(publicId: string): Promise<string> {
  const cached = EMBED_CACHE.get(publicId);
  if (cached && cached.expires > Date.now()) return cached.ancestors;

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

  // Bounded: random publicIds (valid shape, nonexistent) must not grow this
  // per-instance cache without limit. A Map iterates in insertion order, so
  // the first key is the oldest entry.
  if (EMBED_CACHE.size >= EMBED_CACHE_MAX) {
    const oldest = EMBED_CACHE.keys().next().value;
    if (oldest !== undefined) EMBED_CACHE.delete(oldest);
  }
  EMBED_CACHE.set(publicId, { ancestors, expires: Date.now() + EMBED_TTL_MS });
  return ancestors;
}

/**
 * Continues the request with a nonce-based CSP. Next reads the nonce from the CSP *request* header while rendering and stamps it on its
 * own scripts; the same policy goes out on the response. Pages under it must render per request (never from a static cache).
 */
function nextWithCsp(request: NextRequest, frameAncestors: string): NextResponse {
  const nonce = newNonce();
  const csp = buildWidgetCsp(nonce, frameAncestors);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
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
  "/onboarding",
  "/onboarding/(.*)",
  "/(it|en|fr|ro|de|nl)/app",
  "/(it|en|fr|ro|de|nl)/app/(.*)",
  "/(it|en|fr|ro|de|nl)/onboarding",
  "/(it|en|fr|ro|de|nl)/onboarding/(.*)",
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

    // Sentry's tunnelRoute (next.config.mjs) proxies client error/replay
    // envelopes through this same origin to dodge ad-blockers. Without this
    // early return it falls into the i18n middleware below like any other
    // page path and gets locale-redirected — silently breaking every
    // client-side error report (the POST never reaches the rewrite).
    if (pathname === "/monitoring") {
      return NextResponse.next();
    }

    // The embeddable widget (/w/) and the hosted single-page configurator (/c/):
    // no i18n redirects, and a per-tenant `frame-ancestors` CSP so only the
    // dealer's allow-listed domains can frame the embed.
    if (pathname.startsWith("/w/") || pathname.startsWith("/c/")) {
      const publicId = pathname.split("/")[2] ?? "";
      // A malformed id is a 404 page: still served under the strict policy, framable by nobody else.
      const ancestors = /^[A-Za-z0-9_-]{6,16}$/.test(publicId) ? await widgetAncestors(publicId) : "'self'";
      return nextWithCsp(request, ancestors);
    }

    // Public demo configurators (/demo/*), embedded on the marketing site only.
    if (pathname.startsWith("/demo/")) {
      return nextWithCsp(request, `'self' https://onespec.eu https://www.onespec.eu${IS_PROD ? "" : " http://localhost:*"}`);
    }

    // Public Fascicolo del serramento (QR target), App Posatore (/i/[token]) and
    // the guest site view (/k/[pin]): no i18n redirect — next-intl would rewrite
    // them to /{locale}/…, where no route exists (404). Each page picks its
    // language from the record's market.
    if (pathname.startsWith("/f/") || pathname.startsWith("/i/") || pathname.startsWith("/k/")) {
      return NextResponse.next();
    }

    const prefix = localePrefix(pathname);
    const authed = await convexAuth.isAuthenticated();

    if (isSignedOutOnly(request) && authed) {
      return nextjsMiddlewareRedirect(request, `${prefix}/app/dashboard`);
    }
    if (isProtected(request) && !authed) {
      return nextjsMiddlewareRedirect(request, `${prefix}/auth/login`);
    }

    // First-visit market detection: a visitor on a locale-less path with no
    // manual choice yet is sent to the locale of their geo country (e.g. a
    // visitor from France lands on /fr with the French market behaviour).
    // Runs before next-intl so geo wins over Accept-Language negotiation.
    // The authoritative market stays the tenant's stored `country`; picking a
    // language in the switcher writes the `onespec-locale` cookie and stops
    // any further auto-redirect.
    if (!prefix && !request.cookies.get("onespec-locale")) {
      const geoCountry =
        request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
      const geoLocale = localeForCountry(geoCountry);
      if (geoLocale && geoLocale !== routing.defaultLocale) {
        const url = request.nextUrl.clone();
        url.pathname = `/${geoLocale}${pathname}`;
        const redirect = NextResponse.redirect(url);
        redirect.cookies.set("onespec-locale", geoLocale, {
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          path: "/",
        });
        return redirect;
      }
    }

    const res = intlMiddleware(request);

    // Auto country recognition: persist the edge geo signal so the sign-up
    // funnel (and, later, per-country domain routing) can read it without a
    // fresh header on every request. Advisory only — the authoritative market
    // is the tenant's stored `country`.
    const geo = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
    if (geo && /^[A-Z]{2}$/.test(geo) && request.cookies.get("onespec-country")?.value !== geo) {
      res.cookies.set("onespec-country", geo, {
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        path: "/",
      });
    }
    return res;
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Run on everything except Next internals and static files. `/api/auth` MUST
  // be included so Convex Auth's middleware can serve it.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
