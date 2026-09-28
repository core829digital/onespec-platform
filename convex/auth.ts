import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import { withTurnstileGuard, type Authorize } from "./lib/authGuard";

const password = Password({
  verify: ResendOTP,
  reset: ResendPasswordReset,
});

// `Password()` returns `{ id, type, authorize, options: { authorize, ... } }`;
// the real handler lives in `options` (@convex-dev/auth 0.0.95) and a custom
// `authorize` in the config would REPLACE it, so wrap it in place instead.
const options = (password as unknown as { options?: { authorize?: Authorize } }).options;
if (typeof options?.authorize !== "function") {
  // Library shape changed: fail the deploy loudly instead of silently leaving
  // the front door unprotected.
  throw new Error("Password provider shape changed; Turnstile guard cannot be attached.");
}
options.authorize = withTurnstileGuard(options.authorize);

// Auth token lifecycle hardening (2026-09-28): a stolen long-lived token is a
// long-lived attacker window. Convex Auth already does refresh-token rotation
// on every use, reuse detection (a used token seen again revokes the whole
// token family — see node_modules/@convex-dev/auth/dist/server/implementation/
// refreshTokens.js + mutations/refreshSession.js), and stores the refresh
// token in an httpOnly/secure/`__Host-`-prefixed cookie via the Next.js
// server integration (dist/nextjs/server/cookies.js) — none of that needed
// building, only these two durations needed shortening from the library's
// generous 1h JWT / 30-day session defaults:
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
  jwt: {
    // Access-token lifetime. Short on purpose: this is the window a stolen
    // JWT stays usable for even after the refresh token behind it is
    // rotated/revoked, since a bearer JWT itself isn't revocable mid-flight.
    durationMs: 15 * 60 * 1000, // 15 minutes
  },
  session: {
    // How long the refresh cookie stays valid without being used. Rotated
    // (re-issued) on every refresh by the library, so an active user's
    // session keeps sliding forward; an abandoned/stolen cookie dies in 7
    // days instead of the default 30.
    inactiveDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    // Hard ceiling regardless of activity, so a continuously-refreshed
    // session still can't outlive a month without a real re-login.
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days (library default, set explicitly)
  },
});
