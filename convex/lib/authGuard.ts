import { ConvexError } from "convex/values";
import { verifyTurnstileToken } from "./turnstile";
import { checkEmail } from "../../src/shared/validation";
import { checkSignup } from "../../src/shared/signup";
import { must } from "./validate";

/**
 * Bot check on the auth front door, enforced SERVER-side. A client-only check
 * would be bypassable (signIn is a public action anyone can call directly).
 *
 * Guarded flows: signIn (login), signUp (register + resend code), reset (send
 * reset code). Not guarded: email-verification / reset-verification — they
 * already require the emailed one-time code.
 *
 * Enforced only when TURNSTILE_SECRET is set AND TURNSTILE_ENFORCE_AUTH=1, so
 * it can be switched on after the site key is confirmed live in the frontend
 * build (turning it on without the key would lock every user out).
 */
export const GUARDED_FLOWS = new Set(["signIn", "signUp", "reset"]);

export type Authorize = (params: Record<string, unknown>, ctx: unknown) => Promise<unknown>;

export function withTurnstileGuard(inner: Authorize): Authorize {
  return async (params, ctx) => {
    const enforced = !!process.env.TURNSTILE_SECRET && process.env.TURNSTILE_ENFORCE_AUTH === "1";
    if (enforced && GUARDED_FLOWS.has(String(params.flow))) {
      const token = typeof params.turnstileToken === "string" ? params.turnstileToken : "";
      if (!(await verifyTurnstileToken(token))) throw new ConvexError("TURNSTILE_FAILED");
    }
    return inner(params, ctx);
  };
}

/**
 * Input validation + sanitisation on every auth flow, before the library (or the bot check) sees it: the e-mail is cleaned and
 * lower-cased once, so "A@x.com " and "a@x.com" are the same account; passwords are bounded; a sign-up must carry a valid date of
 * birth (18+) and accepted terms. `signIn` does NOT apply the strength rules to the password, so accounts created earlier still log in.
 */
export function withInputGuards(inner: Authorize): Authorize {
  return async (params, ctx) => {
    const flow = String(params.flow ?? "");
    const next: Record<string, unknown> = { ...params };
    if (flow === "signIn" || flow === "signUp" || flow === "reset" || flow === "reset-verification" || flow === "email-verification") {
      next.email = must(checkEmail(params.email));
    }
    if (flow === "signIn") {
      if (typeof params.password !== "string" || params.password === "" || params.password.length > 128) throw new ConvexError("INVALID_INPUT");
    }
    if (flow === "signUp") {
      const parsed = checkSignup(next);
      if (!parsed.ok) throw new ConvexError(`VALIDATION_${parsed.code}`);
      next.name = parsed.value.name;
    }
    return inner(next, ctx);
  };
}
