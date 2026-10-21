import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { Scrypt } from "lucia";
import { api, internal } from "../../convex/_generated/api";
import { newDb } from "./_helpers";
import { totpAt } from "../../convex/lib/totp";

/**
 * The real Convex Auth sign-in action, end to end: sign-up + e-mail code, sign-in, password reset, and the accounts created before
 * e-mails were lower-cased (2026-10-09), which could no longer sign in or reset their password.
 */

beforeAll(async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.JWT_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, " ");
  const jwk = { ...(publicKey.export({ format: "jwk" }) as Record<string, unknown>), use: "sig", alg: "RS256" };
  process.env.JWKS = JSON.stringify({ keys: [jwk] });
  process.env.SITE_URL = "https://platform.example";
});

// The noop mailer logs every code it would send; the tests read them back from there.
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function lastCode(kind: "verify" | "reset", email: string): string {
  const hit = [...logged].reverse().find((l) => l.startsWith(`[email:noop] ${kind} -> ${email}`));
  const code = hit?.match(/code: (\d{6})/)?.[1];
  if (!code) throw new Error(`no ${kind} code logged for ${email}`);
  return code;
}

const PASSWORD = "Serramenti2026!";
const signIn = (t: ReturnType<typeof newDb>, params: Record<string, unknown>) =>
  t.action(api.auth.signIn, { provider: "password", params });

async function signUp(t: ReturnType<typeof newDb>, email: string) {
  await signIn(t, { flow: "signUp", email, password: PASSWORD, name: "Mario Rossi", birthDate: "1980-05-04", termsAccepted: true });
  const res = await signIn(t, { flow: "email-verification", email: email.trim().toLowerCase(), code: lastCode("verify", email.trim().toLowerCase()) });
  expect(res.tokens).toBeTruthy();
}

/** An account as the platform stored it before 2026-10-09: the address exactly as typed, verified, with a password. */
async function seedLegacyAccount(t: ReturnType<typeof newDb>, typed: string, password = PASSWORD) {
  const secret = await new Scrypt().hash(password);
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: typed, emailVerificationTime: Date.now(), name: "Anna Bianchi" });
    const accountId = await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: typed, secret, emailVerified: typed });
    return { userId, accountId };
  });
}

describe("password accounts, end to end", () => {
  test("sign-up, sign-in with any casing and spacing, wrong password refused", async () => {
    const t = newDb();
    await signUp(t, "nuovo@ditta.it");
    expect((await signIn(t, { flow: "signIn", email: "nuovo@ditta.it", password: PASSWORD })).tokens).toBeTruthy();
    expect((await signIn(t, { flow: "signIn", email: "  Nuovo@Ditta.IT ", password: PASSWORD })).tokens).toBeTruthy();
    await expect(signIn(t, { flow: "signIn", email: "nuovo@ditta.it", password: "Sbagliata2026!" })).rejects.toThrow();
  });

  test("password reset: code by e-mail, new password works, old one no longer does", async () => {
    const t = newDb();
    await signUp(t, "reset@ditta.it");
    await signIn(t, { flow: "reset", email: "Reset@Ditta.it" });
    const code = lastCode("reset", "reset@ditta.it");
    const res = await signIn(t, { flow: "reset-verification", email: "reset@ditta.it", code, newPassword: "NuovaPassword2026!" });
    expect(res.tokens).toBeTruthy();
    expect((await signIn(t, { flow: "signIn", email: "reset@ditta.it", password: "NuovaPassword2026!" })).tokens).toBeTruthy();
    await expect(signIn(t, { flow: "signIn", email: "reset@ditta.it", password: PASSWORD })).rejects.toThrow();
  });

  test("reset for an unknown address answers the same way and sends nothing", async () => {
    const t = newDb();
    await expect(signIn(t, { flow: "reset", email: "nessuno@ditta.it" })).resolves.toBeTruthy();
    expect(logged.some((l) => l.includes("nessuno@ditta.it"))).toBe(false);
  });

  test("a wrong reset code changes nothing", async () => {
    const t = newDb();
    await signUp(t, "codice@ditta.it");
    await signIn(t, { flow: "reset", email: "codice@ditta.it" });
    const right = lastCode("reset", "codice@ditta.it");
    const wrong = right === "000000" ? "111111" : "000000";
    await expect(signIn(t, { flow: "reset-verification", email: "codice@ditta.it", code: wrong, newPassword: "NuovaPassword2026!" })).rejects.toThrow();
    expect((await signIn(t, { flow: "signIn", email: "codice@ditta.it", password: PASSWORD })).tokens).toBeTruthy();
  });
});

describe("accounts created before e-mails were lower-cased", () => {
  test("sign in again, and the stored address becomes canonical", async () => {
    const t = newDb();
    const { userId, accountId } = await seedLegacyAccount(t, "Anna.Bianchi@Ditta.IT");
    expect((await signIn(t, { flow: "signIn", email: "anna.bianchi@ditta.it", password: PASSWORD })).tokens).toBeTruthy();
    const after = await t.run(async (ctx) => ({ account: await ctx.db.get(accountId), user: await ctx.db.get(userId) }));
    expect(after.account?.providerAccountId).toBe("anna.bianchi@ditta.it");
    expect(after.user?.email).toBe("anna.bianchi@ditta.it");
    // Typed the old way, still fine.
    expect((await signIn(t, { flow: "signIn", email: "Anna.Bianchi@Ditta.IT", password: PASSWORD })).tokens).toBeTruthy();
  });

  test("can reset the password", async () => {
    const t = newDb();
    await seedLegacyAccount(t, "Luca.Verdi@Ditta.it ", "VecchiaPassword1!");
    await signIn(t, { flow: "reset", email: "luca.verdi@ditta.it" });
    const code = lastCode("reset", "luca.verdi@ditta.it");
    expect((await signIn(t, { flow: "reset-verification", email: "luca.verdi@ditta.it", code, newPassword: "NuovaPassword2026!" })).tokens).toBeTruthy();
    expect((await signIn(t, { flow: "signIn", email: "luca.verdi@ditta.it", password: "NuovaPassword2026!" })).tokens).toBeTruthy();
  });

  test("with two-step verification on, the reset still asks for the app code", async () => {
    const t = newDb();
    const { userId } = await seedLegacyAccount(t, "Sara.Gialli@Ditta.it");
    const me = t.withIdentity({ subject: userId });
    const begin = await me.mutation(api.mfa.beginSetup, {});
    if (!begin.ok) throw new Error("setup refused");
    const done = await me.mutation(api.mfa.confirmSetup, { code: await totpAt(begin.secret, Date.now()) });
    if (!done.ok) throw new Error("confirm refused");

    await signIn(t, { flow: "reset", email: "sara.gialli@ditta.it" });
    const code = lastCode("reset", "sara.gialli@ditta.it");
    // The e-mailed code alone is not enough (before the fix the user was not found by address and the check was skipped): no session,
    // the password is unchanged.
    expect((await signIn(t, { flow: "reset-verification", email: "sara.gialli@ditta.it", code, newPassword: "NuovaPassword2026!" })).tokens).toBeNull();
    expect((await signIn(t, { flow: "signIn", email: "sara.gialli@ditta.it", password: PASSWORD })).tokens).toBeNull(); // old password still right, code asked
    const res = await signIn(t, { flow: "reset-verification", email: "sara.gialli@ditta.it", code, newPassword: "NuovaPassword2026!", mfaCode: await totpAt(begin.secret, Date.now() + 30_000) }); // next step: the setup code cannot be replayed
    expect(res.tokens).toBeTruthy();
  });

  test("sign-in with two-step verification: password alone gives no session, password + app code signs in, a wrong code is refused", async () => {
    const t = newDb();
    const { userId } = await seedLegacyAccount(t, "Marco@Ditta.it");
    const me = t.withIdentity({ subject: userId });
    const begin = await me.mutation(api.mfa.beginSetup, {});
    if (!begin.ok) throw new Error("setup refused");
    await me.mutation(api.mfa.confirmSetup, { code: await totpAt(begin.secret, Date.now()) });
    const creds = { flow: "signIn", email: "marco@ditta.it", password: PASSWORD };
    expect((await signIn(t, creds)).tokens).toBeNull();
    await expect(signIn(t, { ...creds, mfaCode: "000000" })).rejects.toThrow(/MFA_INVALID/);
    expect((await signIn(t, { ...creds, mfaCode: await totpAt(begin.secret, Date.now() + 30_000) })).tokens).toBeTruthy();
    await expect(signIn(t, { ...creds, password: "Sbagliata2026!" })).rejects.toThrow();
  });

  test("signing up again with the same address does not create a second user", async () => {
    const t = newDb();
    const { userId } = await seedLegacyAccount(t, "Paolo@Ditta.it");
    const again = { flow: "signUp", email: "paolo@ditta.it", name: "Paolo Neri", birthDate: "1975-01-01", termsAccepted: true };
    // Another password: refused (the address is taken).
    await expect(signIn(t, { ...again, password: "AltraPassword2026!" })).rejects.toThrow(/already exists/);
    // The account's own password: the library treats it as a sign-in to the SAME user (Convex Auth behaviour, no takeover).
    expect((await signIn(t, { ...again, password: PASSWORD })).tokens).toBeTruthy();
    const users = await t.run((ctx) => ctx.db.query("users").take(10));
    expect(users.map((u) => u._id)).toEqual([userId]);
  });

  test("the daily sweep normalises everybody, and leaves case-only duplicates for a person", async () => {
    const t = newDb();
    const a = await seedLegacyAccount(t, "Uno@Ditta.it");
    await seedLegacyAccount(t, "due@ditta.it");
    await seedLegacyAccount(t, "DUE@ditta.it"); // the same person signed up twice
    const res = await t.mutation(internal.authEmails.normalizeAllEmails, {});
    expect(res).toMatchObject({ repaired: 1, conflicts: 1, done: true });
    const accounts = await t.run((ctx) => ctx.db.query("authAccounts").take(10));
    expect(accounts.map((x) => x.providerAccountId).sort()).toEqual(["DUE@ditta.it", "due@ditta.it", "uno@ditta.it"]);
    expect((await t.run((ctx) => ctx.db.get(a.userId)))?.email).toBe("uno@ditta.it");
    // Running it again changes nothing more.
    expect(await t.mutation(internal.authEmails.normalizeAllEmails, {})).toMatchObject({ repaired: 0, conflicts: 1 });
  });
});
