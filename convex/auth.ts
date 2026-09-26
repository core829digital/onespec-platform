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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
});
