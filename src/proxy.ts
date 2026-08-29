import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Placeholder: auth middleware only for now (intl middleware moved to layout)
  return undefined;
});

export const config = { matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"] };