import { verifyTurnstileToken } from "./turnstile";

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
      if (!(await verifyTurnstileToken(token))) throw new Error("TURNSTILE_FAILED");
    }
    return inner(params, ctx);
  };
}
