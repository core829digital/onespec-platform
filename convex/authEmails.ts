import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { checkEmail } from "../src/shared/validation";

/**
 * Legacy e-mail casing on password accounts.
 *
 * Since 2026-10-09 every auth flow trims and lower-cases the e-mail before Convex Auth looks the account up
 * (`withInputGuards`). Accounts created before that kept the address exactly as typed ("Mario.Rossi@Ditta.it"), and Convex Auth
 * matches `authAccounts.providerAccountId` exactly: those people could no longer sign in, the reset code was refused ("Invalid
 * code": the Email provider compares the address with the account's), and signing up again would have created a second user.
 *
 * The fix rewrites the stored address to its canonical form: lazily for the person who is signing in (`repairLegacyEmail`,
 * called by the auth guard before the library runs) and for everybody else by a periodic sweep (`normalizeAllEmails`).
 * Two accounts that differ only by case are never merged automatically: they are left as they are and reported.
 */

const PROVIDER = "password";
/** Upper bound for one scan of the password accounts (a mutation may read far more; this keeps it predictable). */
const SCAN_LIMIT = 5000;

export function canonicalEmail(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const c = checkEmail(raw);
  return c.ok ? c.value : null;
}

async function alignUserEmail(ctx: MutationCtx, account: Doc<"authAccounts">, email: string): Promise<boolean> {
  const user = await ctx.db.get(account.userId);
  if (!user || user.email === email || canonicalEmail(user.email) !== email) return false;
  await ctx.db.patch(user._id, { email });
  return true;
}

type Repair = "ok" | "repaired" | "missing" | "conflict";

async function repair(ctx: MutationCtx, email: string): Promise<Repair> {
  const exact = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", PROVIDER).eq("providerAccountId", email))
    .unique();
  if (exact) {
    await alignUserEmail(ctx, exact, email);
    return "ok";
  }
  const matches: Doc<"authAccounts">[] = [];
  let seen = 0;
  for await (const a of ctx.db.query("authAccounts").withIndex("providerAndAccountId", (q) => q.eq("provider", PROVIDER))) {
    if (++seen > SCAN_LIMIT) break;
    if (canonicalEmail(a.providerAccountId) === email) {
      matches.push(a);
      if (matches.length > 1) break;
    }
  }
  if (matches.length === 0) return "missing";
  if (matches.length > 1) {
    console.warn(`[auth-email] two password accounts differ only by case for ${email}: left untouched, needs a manual merge`);
    return "conflict";
  }
  await ctx.db.patch(matches[0]._id, { providerAccountId: email });
  await alignUserEmail(ctx, matches[0], email);
  console.log(`[auth-email] legacy address normalised for account ${matches[0]._id}`);
  return "repaired";
}

/** Called by the auth guard with the already-cleaned e-mail, before Convex Auth looks the account up. */
export const repairLegacyEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<Repair> => {
    const email = canonicalEmail(args.email);
    if (!email) return "missing";
    return await repair(ctx, email);
  },
});

/** Periodic sweep (crons.ts): every password account and its user end up with the canonical address. Idempotent. */
export const normalizeAllEmails = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ repaired: number; conflicts: number; done: boolean }> => {
    const page = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", PROVIDER))
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    let repaired = 0;
    let conflicts = 0;
    for (const a of page.page) {
      const email = canonicalEmail(a.providerAccountId);
      if (!email) continue;
      if (a.providerAccountId === email) {
        if (await alignUserEmail(ctx, a, email)) repaired++;
        continue;
      }
      // Indexed check only (no scan per row): the first variant takes the canonical address, a second one is reported.
      const exact = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", PROVIDER).eq("providerAccountId", email))
        .unique();
      if (exact) {
        // Most likely the person signed up again when the old address stopped working. Their data may sit on either user, so
        // this needs a person, not a script.
        console.warn(`[auth-email] legacy account ${a._id} duplicates an existing account for ${email}: left untouched, needs a manual merge`);
        conflicts++;
        continue;
      }
      await ctx.db.patch(a._id, { providerAccountId: email });
      await alignUserEmail(ctx, a, email);
      repaired++;
    }
    if (conflicts > 0) {
      await ctx.scheduler.runAfter(0, internal.ops.alert, {
        source: "auth",
        message: `Account duplicati per maiuscole/minuscole nell'email: ${conflicts}. Lasciati intatti, serve un'unione manuale (vedi i log "[auth-email]").`,
      });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.authEmails.normalizeAllEmails, { cursor: page.continueCursor });
    return { repaired, conflicts, done: page.isDone };
  },
});

/** Is there a password account for this (already cleaned) address? Used to answer a reset request the same way either way. */
export const hasPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", PROVIDER).eq("providerAccountId", args.email))
      .unique();
    return account !== null;
  },
});
