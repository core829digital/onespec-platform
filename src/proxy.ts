import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

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

    // Convex Auth's wrapper already handled /api/auth before us. Any other
    // /api/* or /w/* request must pass straight through (no i18n redirects).
    if (pathname.startsWith("/api/") || pathname.startsWith("/w/")) {
      return;
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
