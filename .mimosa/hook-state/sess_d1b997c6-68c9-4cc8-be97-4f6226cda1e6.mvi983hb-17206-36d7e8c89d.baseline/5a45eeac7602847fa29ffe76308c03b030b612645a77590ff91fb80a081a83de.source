import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";

type RunQuery = (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Language for the verification / password-reset emails. Convex Auth passes
 * the signIn action ctx as `sendVerificationRequest`'s second argument (not in
 * its public types), so the stored `users.locale` can be read; anything
 * missing or failing falls back to Italian, the platform default.
 */
export async function localeForAuthEmail(ctx: unknown, email: string): Promise<string> {
  try {
    const runQuery = (ctx as { runQuery?: RunQuery } | undefined)?.runQuery;
    if (typeof runQuery !== "function") return "it";
    const locale = await runQuery.call(ctx, internal.users.localeForEmail, { email });
    return typeof locale === "string" ? locale : "it";
  } catch {
    return "it";
  }
}
