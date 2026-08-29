import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const isWidget = createRouteMatcher(["/w/(.*)"]);
const isAuthPage = createRouteMatcher([
  "/:locale/auth/:path*",
  "/auth/:path*",
]);
const isProtected = createRouteMatcher([
  "/:locale/app/:path*",
  "/app/:path*",
  "/:locale/auth/onboarding",
  "/auth/onboarding",
]);

function localized(request: Request, path: string) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] || "";
  const isLocale = routing.locales.includes(firstSegment as any);
  const locale = isLocale ? firstSegment : routing.defaultLocale;
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${path}`;
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isWidget(request)) return;

  const authed = await convexAuth.isAuthenticated();

  if (isAuthPage(request) && authed) {
    return nextjsMiddlewareRedirect(request, localized(request, "/app/dashboard"));
  }

  if (isProtected(request) && !authed) {
    return nextjsMiddlewareRedirect(request, localized(request, "/auth/login"));
  }

  return intl(request);
});

export const config = { matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"] };