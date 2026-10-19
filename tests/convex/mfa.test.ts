import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { totpAt } from "../../convex/lib/totp";
import { withMfaGuard, type MfaChecks, type MfaVerdict } from "../../convex/lib/authGuard";
import { newDb, seedTenant } from "./_helpers";

const T0 = 1_800_000_000_000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);
const codeNow = (secret: string) => totpAt(secret, Date.now());

async function world() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const me = t.withIdentity({ subject: s.ownerId });
  const other = t.withIdentity({ subject: s.memberId });
  async function enable() {
    const begin = await me.mutation(api.mfa.beginSetup, {});
    if (!begin.ok) throw new Error("setup refused");
    const done = await me.mutation(api.mfa.confirmSetup, { code: await codeNow(begin.secret) });
    if (!done.ok) throw new Error("confirm refused");
    return { secret: begin.secret, recoveryCodes: done.recoveryCodes };
  }
  const login = (code: string, commit = true, userId = s.ownerId) => t.mutation(internal.mfa.verifyLogin, { userId, code, commit });
  return { t, s, me, other, enable, login };
}

describe("setup", () => {
  test("the secret is stored encrypted and only turns on after a valid first code", async () => {
    const { t, s, me } = await world();
    const begin = await me.mutation(api.mfa.beginSetup, {});
    if (!begin.ok) throw new Error("x");
    expect(begin.uri).toContain(`secret=${begin.secret}`);
    let row = await t.run((ctx) => ctx.db.query("userMfa").first());
    expect(row?.enabled).toBe(false);
    expect(row?.secretEnc.startsWith("v1.")).toBe(true);
    expect(JSON.stringify(row)).not.toContain(begin.secret);
    expect((await me.query(api.mfa.status, {})).enabled).toBe(false);

    const bad = await me.mutation(api.mfa.confirmSetup, { code: "000000" });
    expect(bad).toEqual({ ok: false, error: "MFA_INVALID" });
    expect((await me.query(api.mfa.status, {})).enabled).toBe(false);

    const done = await me.mutation(api.mfa.confirmSetup, { code: await codeNow(begin.secret) });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.recoveryCodes).toHaveLength(10);
    expect(done.recoveryCodes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    row = await t.run((ctx) => ctx.db.query("userMfa").first());
    expect(row?.enabled).toBe(true);
    // Recovery codes exist only as hashes.
    expect(JSON.stringify(row)).not.toContain(done.recoveryCodes[0].replace("-", ""));
    expect(await me.query(api.mfa.status, {})).toMatchObject({ enabled: true, recoveryRemaining: 10, available: true });
    const audit = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).map((a) => a.action));
    expect(audit).toContain("mfa.enabled");
    expect(s.ownerId).toBeTruthy();
  });

  test("cannot start a second setup while it is on; needs sign-in", async () => {
    const { enable, me, t } = await world();
    await enable();
    await expect(me.mutation(api.mfa.beginSetup, {})).rejects.toThrow(/MFA_ALREADY_ENABLED/);
    await expect(t.mutation(api.mfa.beginSetup, {})).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("without the encryption key nothing can be enrolled (fail closed)", async () => {
    const { me } = await world();
    const saved = process.env.MFA_ENCRYPTION_KEY;
    delete process.env.MFA_ENCRYPTION_KEY;
    try {
      await expect(me.mutation(api.mfa.beginSetup, {})).rejects.toThrow(/MFA_NOT_CONFIGURED/);
      expect((await me.query(api.mfa.status, {})).available).toBe(false);
    } finally {
      process.env.MFA_ENCRYPTION_KEY = saved;
    }
  });

  test("setup attempts are rate limited", async () => {
    const { me } = await world();
    for (let i = 0; i < 10; i++) expect((await me.mutation(api.mfa.beginSetup, {})).ok).toBe(true);
    expect(await me.mutation(api.mfa.beginSetup, {})).toEqual({ ok: false, error: "RATE_LIMITED" });
  });
});

describe("sign-in check", () => {
  test("a user without the factor passes; with it, the code is required, single-use and time-limited", async () => {
    const { enable, login, t, s } = await world();
    expect(await login("")).toEqual({ enabled: false });
    const { secret } = await enable();

    // No code: asked for it, not counted as a failure.
    expect(await login("")).toEqual({ enabled: true, ok: false, error: "MFA_REQUIRED" });
    expect((await t.run((ctx) => ctx.db.query("userMfa").first()))?.failedCount).toBe(0);

    // The code used to confirm the setup cannot be used again; the next step's code works once.
    later(30_000);
    const code = await codeNow(secret);
    expect(await login(code)).toEqual({ enabled: true, ok: true });
    expect(await login(code)).toEqual({ enabled: true, ok: false, error: "MFA_INVALID" });
    expect(s.ownerId).toBeTruthy();
  });

  test("peek (commit=false) accepts a valid code without using it up", async () => {
    const { enable, login } = await world();
    const { secret } = await enable();
    later(30_000);
    const code = await codeNow(secret);
    expect(await login(code, false)).toEqual({ enabled: true, ok: true });
    expect(await login(code, false)).toEqual({ enabled: true, ok: true });
    expect(await login(code, true)).toEqual({ enabled: true, ok: true });
    expect(await login(code, false)).toEqual({ enabled: true, ok: false, error: "MFA_INVALID" });
  });

  test("five wrong codes lock checking for 15 minutes — even the right code is refused — then it recovers", async () => {
    const { enable, login, t } = await world();
    const { secret } = await enable();
    later(30_000);
    for (let i = 0; i < 5; i++) expect(await login("111111")).toMatchObject({ ok: false, error: "MFA_INVALID" });
    expect(await login(await codeNow(secret))).toEqual({ enabled: true, ok: false, error: "MFA_LOCKED" });
    const audit = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).map((a) => a.action));
    expect(audit).toContain("mfa.locked");
    later(15 * 60_000 + 1000);
    expect(await login(await codeNow(secret))).toEqual({ enabled: true, ok: true });
  });

  test("a recovery code works once, in any spelling, and is logged", async () => {
    const { enable, login, me, t } = await world();
    const { recoveryCodes } = await enable();
    const spelled = recoveryCodes[0].toLowerCase().replace("-", " ");
    expect(await login(spelled)).toEqual({ enabled: true, ok: true });
    expect(await login(recoveryCodes[0])).toMatchObject({ ok: false, error: "MFA_INVALID" });
    expect(await login(recoveryCodes[1])).toEqual({ enabled: true, ok: true });
    expect((await me.query(api.mfa.status, {})).recoveryRemaining).toBe(8);
    const audit = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).filter((a) => a.action === "mfa.recovery_used"));
    expect(audit).toHaveLength(2);
  });

  test("oversized or garbage input is refused without touching the secret", async () => {
    const { enable, login } = await world();
    await enable();
    expect(await login("x".repeat(500))).toMatchObject({ ok: false, error: "MFA_INVALID" });
    expect(await login("abc")).toMatchObject({ ok: false, error: "MFA_INVALID" });
  });

  test("a secret copied onto another user's row does not decrypt (bound to its owner)", async () => {
    const { enable, t, s } = await world();
    const { secret } = await enable();
    const row = await t.run((ctx) => ctx.db.query("userMfa").first());
    await t.run((ctx) => ctx.db.insert("userMfa", { userId: s.memberId, secretEnc: row!.secretEnc, enabled: true, createdAt: Date.now(), failedCount: 0, recovery: [] }));
    later(30_000);
    expect(await t.mutation(internal.mfa.verifyLogin, { userId: s.memberId, code: await codeNow(secret), commit: true })).toEqual({ enabled: true, ok: false, error: "MFA_UNAVAILABLE" });
  });

  test("lookup by e-mail (password reset)", async () => {
    const { enable, t, s } = await world();
    const { recoveryCodes } = await enable();
    const email = (await t.run((ctx) => ctx.db.get(s.ownerId)))?.email as string;
    expect(await t.mutation(internal.mfa.verifyByEmail, { email: "nobody@example.com", code: "", commit: true })).toEqual({ enabled: false });
    expect(await t.mutation(internal.mfa.verifyByEmail, { email, code: "", commit: false })).toMatchObject({ error: "MFA_REQUIRED" });
    expect(await t.mutation(internal.mfa.verifyByEmail, { email, code: recoveryCodes[0], commit: true })).toEqual({ enabled: true, ok: true });
  });
});

describe("turning it off and recovery codes", () => {
  test("disabling needs a valid code; a stolen open session cannot remove it", async () => {
    const { enable, me, t } = await world();
    const { secret } = await enable();
    expect(await me.mutation(api.mfa.disable, { code: "123456" })).toEqual({ ok: false, error: "MFA_INVALID" });
    expect((await me.query(api.mfa.status, {})).enabled).toBe(true);
    later(30_000);
    expect(await me.mutation(api.mfa.disable, { code: await codeNow(secret) })).toEqual({ ok: true });
    expect((await me.query(api.mfa.status, {})).enabled).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("userMfa").collect())).toHaveLength(0);
    await expect(me.mutation(api.mfa.disable, { code: "123456" })).rejects.toThrow(/MFA_NOT_ENABLED/);
  });

  test("regenerating replaces all codes: old ones stop working", async () => {
    const { enable, me, login } = await world();
    const { secret, recoveryCodes } = await enable();
    later(30_000);
    const res = await me.mutation(api.mfa.regenerateRecoveryCodes, { code: await codeNow(secret) });
    if (!res.ok) throw new Error("x");
    expect(res.recoveryCodes).toHaveLength(10);
    expect(await login(recoveryCodes[0])).toMatchObject({ ok: false });
    expect(await login(res.recoveryCodes[0])).toEqual({ enabled: true, ok: true });
  });

  test("one user's factor never touches another's", async () => {
    const { enable, other, login, s } = await world();
    await enable();
    expect((await other.query(api.mfa.status, {})).enabled).toBe(false);
    expect(await login("", true, s.memberId)).toEqual({ enabled: false });
    await expect(other.mutation(api.mfa.disable, { code: "123456" })).rejects.toThrow(/MFA_NOT_ENABLED/);
  });

  test("erasing the account removes the factor", async () => {
    const { enable, t, s } = await world();
    await enable();
    await t.mutation(internal.mfa.eraseForUser, { userId: s.ownerId });
    expect(await t.run((ctx) => ctx.db.query("userMfa").collect())).toHaveLength(0);
  });
});

describe("sign-in guard", () => {
  const verdicts = (v: MfaVerdict) => {
    const calls: string[] = [];
    const checks: MfaChecks = {
      forUser: async (_c, id, code, commit) => (calls.push(`user:${id}:${code}:${commit}`), v),
      forEmail: async (_c, email, code, commit) => (calls.push(`email:${email}:${code}:${commit}`), v),
    };
    return { calls, checks };
  };

  test("signIn: a user with the factor but no code gets no session (no error: production hides error texts from the auth proxy)", async () => {
    const { checks } = verdicts({ enabled: true, ok: false, error: "MFA_REQUIRED" });
    const guarded = withMfaGuard(async () => ({ userId: "u1" }), checks);
    expect(await guarded({ flow: "signIn", email: "a@b.c" }, {})).toBeNull();
  });

  test("signIn: a wrong code is still an error", async () => {
    const { checks } = verdicts({ enabled: true, ok: false, error: "MFA_INVALID" });
    const guarded = withMfaGuard(async () => ({ userId: "u1" }), checks);
    await expect(guarded({ flow: "signIn", email: "a@b.c", mfaCode: "000000" }, {})).rejects.toThrow(/MFA_INVALID/);
  });

  test("signIn: correct code passes the library result through", async () => {
    const { checks, calls } = verdicts({ enabled: true, ok: true });
    const guarded = withMfaGuard(async () => ({ userId: "u1" }), checks);
    expect(await guarded({ flow: "signIn", mfaCode: "123456" }, {})).toEqual({ userId: "u1" });
    expect(calls).toEqual(["user:u1:123456:true"]);
  });

  test("signIn: no check for accounts without the factor, and none when the password failed", async () => {
    const { checks, calls } = verdicts({ enabled: false });
    expect(await withMfaGuard(async () => ({ userId: "u1" }), checks)({ flow: "signIn" }, {})).toEqual({ userId: "u1" });
    const failing = withMfaGuard(async () => { throw new Error("Invalid credentials"); }, checks);
    await expect(failing({ flow: "signIn" }, {})).rejects.toThrow("Invalid credentials");
    expect(calls).toHaveLength(1);
  });

  test("other flows are untouched", async () => {
    const { checks, calls } = verdicts({ enabled: true, ok: false, error: "MFA_REQUIRED" });
    const guarded = withMfaGuard(async () => "ok", checks);
    expect(await guarded({ flow: "signUp" }, {})).toBe("ok");
    expect(await guarded({ flow: "reset" }, {})).toBe("ok");
    expect(calls).toHaveLength(0);
  });

  test("reset-verification: the code is checked BEFORE the password changes, and consumed only after success", async () => {
    const order: string[] = [];
    const checks: MfaChecks = {
      forUser: async () => ({ enabled: false }),
      forEmail: async (_c, _e, _code, commit) => (order.push(commit ? "commit" : "peek"), { enabled: true, ok: true }),
    };
    const inner = async () => (order.push("reset"), { userId: "u1", sessionId: "s1" });
    const res = await withMfaGuard(inner, checks)({ flow: "reset-verification", email: "a@b.c", mfaCode: "123456" }, {});
    expect(res).toEqual({ userId: "u1", sessionId: "s1" });
    expect(order).toEqual(["peek", "reset", "commit"]);
  });

  test("reset-verification: without a valid code the password is never changed", async () => {
    let changed = false;
    const checks: MfaChecks = { forUser: async () => ({ enabled: false }), forEmail: async () => ({ enabled: true, ok: false, error: "MFA_INVALID" }) };
    const inner = async () => { changed = true; return {}; };
    await expect(withMfaGuard(inner, checks)({ flow: "reset-verification", email: "a@b.c" }, {})).rejects.toThrow(/MFA_INVALID/);
    expect(changed).toBe(false);
  });

  test("reset-verification: a wrong reset e-mail code does not use up the authenticator code", async () => {
    const commits: boolean[] = [];
    const checks: MfaChecks = { forUser: async () => ({ enabled: false }), forEmail: async (_c, _e, _code, commit) => (commits.push(commit), { enabled: true, ok: true }) };
    const inner = async () => { throw new Error("Invalid code"); };
    await expect(withMfaGuard(inner, checks)({ flow: "reset-verification", email: "a@b.c", mfaCode: "1" }, {})).rejects.toThrow("Invalid code");
    expect(commits).toEqual([false]);
  });
});
