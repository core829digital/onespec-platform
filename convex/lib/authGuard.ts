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
 * `repairEmail` (optional) rewrites a legacy mixed-case address of the same account to the cleaned one before the library looks it up.
 */
export function withInputGuards(inner: Authorize, repairEmail?: (ctx: unknown, email: string) => Promise<unknown>): Authorize {
  return async (params, ctx) => {
    const flow = String(params.flow ?? "");
    const next: Record<string, unknown> = { ...params };
    if (flow === "signIn" || flow === "signUp" || flow === "reset" || flow === "reset-verification" || flow === "email-verification") {
      next.email = must(checkEmail(params.email));
      // Accounts created before the e-mail was lower-cased keep the address as typed; bring it to the canonical form first so the
      // library finds it (convex/authEmails.ts). Never blocks the flow: on failure the library answers as it would have anyway.
      if (repairEmail) {
        try {
          await repairEmail(ctx, next.email as string);
        } catch (e) {
          console.warn("[auth-email] repair skipped", e instanceof Error ? e.message : String(e));
        }
      }
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

/** What the second-factor check answers (convex/mfa.ts `verifyLogin` / `verifyByEmail`). */
export type MfaVerdict = { enabled: false } | { enabled: true; ok: true } | { enabled: true; ok: false; error: string };

export interface MfaChecks {
  /** The password was accepted for this user: is a code needed, and is the typed one right? */
  forUser(ctx: unknown, userId: string, code: string, commit: boolean): Promise<MfaVerdict>;
  /** Password reset: the account is known only by e-mail. */
  forEmail(ctx: unknown, email: string, code: string, commit: boolean): Promise<MfaVerdict>;
}

/**
 * Second factor (authenticator app) on every way a password account can get a session:
 *  - signIn: after the library accepted the password, a user who turned the factor on must also send `mfaCode`;
 *  - reset-verification: the e-mailed reset code alone must not be enough to take over such an account, so the code is checked BEFORE the
 *    password is changed (without using it up) and consumed only once the reset really went through.
 * Fails closed: if the check cannot run, nobody with the factor on gets in. The error names are the codes the login page understands.
 */
export function withMfaGuard(inner: Authorize, checks: MfaChecks): Authorize {
  const code = (p: Record<string, unknown>) => (typeof p.mfaCode === "string" ? p.mfaCode : "");
  return async (params, ctx) => {
    const flow = String(params.flow ?? "");
    if (flow === "reset-verification") {
      const email = String(params.email ?? "");
      const pre = await checks.forEmail(ctx, email, code(params), false);
      if (pre.enabled && !pre.ok) throw new ConvexError(pre.error);
      const result = await inner(params, ctx);
      if (pre.enabled) {
        const done = await checks.forEmail(ctx, email, code(params), true);
        if (done.enabled && !done.ok) throw new ConvexError(done.error);
      }
      return result;
    }
    const result = await inner(params, ctx);
    if (flow !== "signIn") return result;
    const userId = result && typeof result === "object" && "userId" in result ? String((result as { userId: unknown }).userId) : null;
    if (!userId) return result;
    const verdict = await checks.forUser(ctx, userId, code(params), true);
    if (verdict.enabled && !verdict.ok) throw new ConvexError(verdict.error);
    return result;
  };
}

/**
 * Password reset for an address with no password account: the library would throw ("InvalidAccountId"), telling anyone who asks
 * which addresses have an account, and showing a real user who mistyped a bare error. Answer as if the code was sent instead (no
 * e-mail goes out). Sits after the bot check so the two cases cannot be told apart by it either.
 */
export function withQuietReset(inner: Authorize, accountExists: (ctx: unknown, email: string) => Promise<boolean>): Authorize {
  return async (params, ctx) => {
    if (String(params.flow ?? "") === "reset" && !(await accountExists(ctx, String(params.email ?? "")))) return null;
    return inner(params, ctx);
  };
}
