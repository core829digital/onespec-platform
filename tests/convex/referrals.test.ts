import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("REFERRALS_ENABLED", "1");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

type Db = ReturnType<typeof newDb>;

async function openRegistration(t: Db) {
  await t.run((ctx) => ctx.db.insert("appSettings", { key: "global", registrationOpen: true, resendMode: "noop", updatedAt: Date.now() }));
}

/** A paying account that can invite: owner's e-mail is controlled by the test. */
async function seedReferrer(t: Db, email = "anna@acme.it") {
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.ownerId, { email }));
  return s;
}

async function newUser(t: Db, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { name: "New", email, emailVerificationTime: Date.now() }));
}

async function signUp(t: Db, email: string, referralCode?: string) {
  const userId = await newUser(t, email);
  const res = await t.withIdentity({ subject: userId }).mutation(api.tenants.registerTenant, { companyName: "Nuova Srl", referralCode });
  return { userId, tenantId: res.tenantId };
}

const referralsOf = (t: Db, referredTenantId: Id<"tenants">) =>
  t.run((ctx) => ctx.db.query("referrals").withIndex("by_referred", (q) => q.eq("referredTenantId", referredTenantId)).collect());

describe("codes", () => {
  test("owner gets a stable code; a second call returns the same one", async () => {
    const t = newDb();
    const s = await seedReferrer(t);
    const as = t.withIdentity({ subject: s.ownerId });
    const a = await as.mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId });
    const b = await as.mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId });
    expect(a.code).toMatch(/^OS-[A-Z0-9]{6}$/);
    expect(b.code).toBe(a.code);
    const info = await as.query(api.referrals.getMyReferral, { tenantId: s.tenantId });
    expect(info).toMatchObject({ enabled: true, eligible: true, code: a.code, counts: { pending: 0, qualified: 0, rewarded: 0 } });
  });

  test("plain members cannot create or read the code", async () => {
    const t = newDb();
    const s = await seedReferrer(t);
    const as = t.withIdentity({ subject: s.memberId });
    await expect(as.mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId })).rejects.toThrow();
    await expect(as.query(api.referrals.getMyReferral, { tenantId: s.tenantId })).rejects.toThrow();
  });

  test("another account's owner cannot read this account's referral data", async () => {
    const t = newDb();
    const a = await seedReferrer(t, "a@acme.it");
    const b = await seedReferrer(t, "b@beta.it");
    await expect(t.withIdentity({ subject: b.ownerId }).query(api.referrals.getMyReferral, { tenantId: a.tenantId })).rejects.toThrow();
  });

  test("not eligible while the plan is not active, or for full-access accounts", async () => {
    const t = newDb();
    const s = await seedReferrer(t);
    const as = t.withIdentity({ subject: s.ownerId });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "trialing" }));
    await expect(as.mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId })).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "active", unlimitedAccess: true }));
    await expect(as.mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId })).rejects.toThrow();
  });

  test("switch off: no code is created", async () => {
    vi.stubEnv("REFERRALS_ENABLED", "0");
    const t = newDb();
    const s = await seedReferrer(t);
    await expect(t.withIdentity({ subject: s.ownerId }).mutation(api.referrals.ensureMyReferralCode, { tenantId: s.tenantId })).rejects.toThrow();
    const info = await t.withIdentity({ subject: s.ownerId }).query(api.referrals.getMyReferral, { tenantId: s.tenantId });
    expect(info.enabled).toBe(false);
  });
});

describe("attaching a code at registration", () => {
  async function setup() {
    const t = newDb();
    await openRegistration(t);
    const ref = await seedReferrer(t);
    const { code } = await t.withIdentity({ subject: ref.ownerId }).mutation(api.referrals.ensureMyReferralCode, { tenantId: ref.tenantId });
    return { t, ref, code };
  }

  test("a valid code links the new account (pending)", async () => {
    const { t, ref, code } = await setup();
    const { tenantId } = await signUp(t, "luca@beta.it", code);
    const rows = await referralsOf(t, tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", referrerTenantId: ref.tenantId, code });
    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.referredBy).toBe(rows[0]._id);
    const info = await t.withIdentity({ subject: ref.ownerId }).query(api.referrals.getMyReferral, { tenantId: ref.tenantId });
    expect(info.counts.pending).toBe(1);
    const audit = await t.run((ctx) => ctx.db.query("auditLog").withIndex("by_action", (q) => q.eq("action", "referral.attached")).collect());
    expect(audit).toHaveLength(1);
  });

  test("the code is accepted typed loosely (lower case, no prefix)", async () => {
    const { t, code } = await setup();
    const { tenantId } = await signUp(t, "luca@beta.it", code.slice(3).toLowerCase());
    expect((await referralsOf(t, tenantId))[0]?.status).toBe("pending");
  });

  test("unknown or malformed codes leave no trace and never block signup", async () => {
    const { t } = await setup();
    for (const [i, bad] of ["OS-ZZZZZZ", "garbage", "<script>alert(1)</script>", ""].entries()) {
      const { tenantId } = await signUp(t, `user${i}@beta.it`, bad);
      expect(await referralsOf(t, tenantId)).toHaveLength(0);
      expect((await t.run((ctx) => ctx.db.get(tenantId)))?.referredBy).toBeUndefined();
    }
  });

  test("signing up without a code is untouched", async () => {
    const { t } = await setup();
    const { tenantId } = await signUp(t, "luca@beta.it");
    expect(await referralsOf(t, tenantId)).toHaveLength(0);
  });

  test("self-referral (same mailbox, another spelling) is rejected and recorded", async () => {
    const { t, code } = await setup();
    const { tenantId } = await signUp(t, "Anna+second@acme.it", code);
    const rows = await referralsOf(t, tenantId);
    expect(rows[0]).toMatchObject({ status: "rejected", rejectionReason: "SELF_REFERRAL" });
    expect((await t.run((ctx) => ctx.db.get(tenantId)))?.referredBy).toBeUndefined();
  });

  test("a colleague on the same company domain is rejected", async () => {
    const { t, code } = await setup();
    const { tenantId } = await signUp(t, "marco@acme.it", code);
    expect((await referralsOf(t, tenantId))[0]).toMatchObject({ status: "rejected", rejectionReason: "SAME_ORGANIZATION" });
  });

  test("two different people on a free mailbox domain are fine", async () => {
    const t = newDb();
    await openRegistration(t);
    const ref = await seedReferrer(t, "anna@gmail.com");
    const { code } = await t.withIdentity({ subject: ref.ownerId }).mutation(api.referrals.ensureMyReferralCode, { tenantId: ref.tenantId });
    const { tenantId } = await signUp(t, "luca@gmail.com", code);
    expect((await referralsOf(t, tenantId))[0]?.status).toBe("pending");
  });

  test("a throwaway mailbox is rejected", async () => {
    const { t, code } = await setup();
    const { tenantId } = await signUp(t, "x@mailinator.com", code);
    expect((await referralsOf(t, tenantId))[0]).toMatchObject({ status: "rejected", rejectionReason: "DISPOSABLE_EMAIL" });
  });

  test("a code whose owner stopped paying is rejected", async () => {
    const { t, ref, code } = await setup();
    await t.run((ctx) => ctx.db.patch(ref.tenantId, { planStatus: "suspended" }));
    const { tenantId } = await signUp(t, "luca@beta.it", code);
    expect((await referralsOf(t, tenantId))[0]).toMatchObject({ status: "rejected", rejectionReason: "REFERRER_NOT_ELIGIBLE" });
  });

  test("a disabled code is ignored", async () => {
    const { t, code } = await setup();
    await t.run(async (ctx) => {
      const row = await ctx.db.query("referralCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
      await ctx.db.patch(row!._id, { disabledAt: Date.now() });
    });
    const { tenantId } = await signUp(t, "luca@beta.it", code);
    expect(await referralsOf(t, tenantId)).toHaveLength(0);
  });

  test("switched off: the code is ignored and signup still works", async () => {
    const { t, code } = await setup();
    vi.stubEnv("REFERRALS_ENABLED", "0");
    const { tenantId } = await signUp(t, "luca@beta.it", code);
    expect(await referralsOf(t, tenantId)).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(tenantId)))?.planStatus).toBe("pending_plan");
  });

  test("each invited account appears once, even if it asks again", async () => {
    const { t, ref, code } = await setup();
    const { tenantId, userId } = await signUp(t, "luca@beta.it", code);
    // Same account invoking the internal attach again (e.g. a retry) must not duplicate.
    await t.run(async (ctx) => {
      const { attachReferral } = await import("../../convex/referrals");
      const r = await attachReferral(ctx, { referredTenantId: tenantId, referredUserId: userId, rawCode: code });
      expect(r.status).toBe("ignored");
    });
    expect(await referralsOf(t, tenantId)).toHaveLength(1);
    expect(ref.tenantId).toBeTruthy();
  });
});
