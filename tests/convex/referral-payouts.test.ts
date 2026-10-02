import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import { newDb, seedTenant } from "./_helpers";
import { cardFingerprints, firstRealPayment, hasRefundOrDispute, sharesAny } from "../../convex/referralPayouts";
import { ensureReferralCoupon } from "../../convex/lib/referralCoupon";
import { DAY_MS } from "../../convex/lib/referralRewards";

const T0 = new Date("2026-10-01T00:00:00Z").getTime();
type Db = ReturnType<typeof newDb>;

/* ----------------------------- a tiny fake Stripe ----------------------------- */

interface FakeStripe {
  invoices: Record<string, unknown[]>;
  cards: Record<string, string[]>;
  charges: Record<string, unknown[]>;
  balances: Record<string, number>;
  txns: Record<string, Array<{ id: string; amount: number; metadata?: Record<string, string> }>>;
  coupons: Set<string>;
  posts: Array<{ path: string; body: URLSearchParams; key: string | null }>;
  idem: Map<string, unknown>;
  failReads: boolean;
}

function installStripe(): FakeStripe {
  const st: FakeStripe = { invoices: {}, cards: {}, charges: {}, balances: {}, txns: {}, coupons: new Set(), posts: [], idem: new Map(), failReads: false };
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/v1/, "");
      const method = init?.method ?? "GET";
      const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json });
      const customer = u.searchParams.get("customer") ?? "";
      if (method === "GET") {
        if (st.failReads) return reply(500, { error: { message: "boom" } });
        if (path === "/invoices") return reply(200, { data: st.invoices[customer] ?? [] });
        if (path === "/payment_methods") return reply(200, { data: (st.cards[customer] ?? []).map((f) => ({ card: { fingerprint: f } })) });
        if (path === "/charges") return reply(200, { data: st.charges[customer] ?? [] });
        let m = path.match(/^\/customers\/([^/]+)\/balance_transactions$/);
        if (m) return reply(200, { data: st.txns[m[1]] ?? [] });
        m = path.match(/^\/customers\/([^/]+)$/);
        if (m) return reply(200, { balance: st.balances[m[1]] ?? 0 });
        m = path.match(/^\/coupons\/(.+)$/);
        if (m) return st.coupons.has(m[1]) ? reply(200, { id: m[1] }) : reply(404, { error: { message: "No such coupon" } });
      }
      if (method === "POST") {
        const body = new URLSearchParams(init?.body ?? "");
        const key = init?.headers?.["Idempotency-Key"] ?? null;
        st.posts.push({ path, body, key });
        if (key && st.idem.has(key)) return reply(200, st.idem.get(key));
        const m = path.match(/^\/customers\/([^/]+)\/balance_transactions$/);
        if (m) {
          const txn = { id: `cbtxn_${++n}`, amount: Number(body.get("amount")), metadata: { referralId: body.get("metadata[referralId]") ?? "", ...(body.get("metadata[clawbackOf]") ? { clawbackOf: body.get("metadata[clawbackOf]") as string } : {}) } };
          (st.txns[m[1]] ??= []).push(txn);
          st.balances[m[1]] = (st.balances[m[1]] ?? 0) + txn.amount;
          if (key) st.idem.set(key, txn);
          return reply(200, txn);
        }
        if (path === "/coupons") {
          st.coupons.add(body.get("id") as string);
          return reply(200, { id: body.get("id") });
        }
      }
      return reply(404, { error: { message: `unhandled ${method} ${path}` } });
    }),
  );
  return st;
}

let stripe: FakeStripe;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubEnv("REFERRALS_ENABLED", "1");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  stripe = installStripe();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* -------------------------------- scenarios -------------------------------- */

interface Scenario {
  t: Db;
  referrerId: Id<"tenants">;
  referredId: Id<"tenants">;
  referralId: Id<"referrals">;
}

async function scenario(opts: { referredPlan?: "base" | "pro" | "essentials" } = {}): Promise<Scenario> {
  const t = newDb();
  const ref = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(ref.tenantId, { stripeCustomerId: "cus_ref", stripeSubscriptionId: "sub_ref" }));
  const referred = await seedTenant(t, { plan: opts.referredPlan ?? "base" });
  await t.run((ctx) => ctx.db.patch(referred.tenantId, { stripeCustomerId: "cus_new", stripeSubscriptionId: "sub_new" }));
  const referralId = await t.run((ctx) =>
    ctx.db.insert("referrals", { referrerTenantId: ref.tenantId, referredTenantId: referred.tenantId, code: "OS-AAAAAA", status: "pending", createdAt: T0 }),
  );
  await t.run((ctx) => ctx.db.patch(referred.tenantId, { referredBy: referralId }));
  return { t, referrerId: ref.tenantId, referredId: referred.tenantId, referralId };
}

const paidInvoice = (id: string, cents: number, atMs: number) => ({ id, amount_paid: cents, created: Math.floor(atMs / 1000), status_transitions: { paid_at: Math.floor(atMs / 1000) } });
const referral = (s: Scenario) => s.t.run((ctx) => ctx.db.get(s.referralId));
const creditPosts = () => stripe.posts.filter((p) => /balance_transactions$/.test(p.path));

async function qualify(s: Scenario, paidAt = T0) {
  stripe.invoices["cus_new"] = [paidInvoice("in_1", 9700, paidAt)];
  await s.t.action(internal.referralPayouts.qualifySweep, {});
}

describe("pure helpers", () => {
  test("hasRefundOrDispute", () => {
    expect(hasRefundOrDispute([{ amount_refunded: 0 }, { disputed: false }])).toBe(false);
    expect(hasRefundOrDispute([{ amount_refunded: 100 }])).toBe(true);
    expect(hasRefundOrDispute([{ disputed: true }])).toBe(true);
    expect(hasRefundOrDispute(undefined)).toBe(false);
  });
  test("card fingerprints and overlap", () => {
    expect(cardFingerprints([{ card: { fingerprint: "a" } }, { card: {} }, {}])).toEqual(["a"]);
    expect(sharesAny(["a", "b"], ["c", "b"])).toBe(true);
    expect(sharesAny(["a"], ["c"])).toBe(false);
    expect(sharesAny([], ["c"])).toBe(false);
  });
  test("first real payment ignores zero invoices and picks the earliest", () => {
    const got = firstRealPayment([paidInvoice("late", 500, 2000_000), { id: "zero", amount_paid: 0, created: 1 }, paidInvoice("early", 700, 1000_000)]);
    expect(got).toEqual({ id: "early", paidCents: 700, paidAtMs: 1000_000 });
    expect(firstRealPayment([{ id: "z", amount_paid: 0 }])).toBeNull();
    expect(firstRealPayment(null)).toBeNull();
  });
});

describe("checkout discount", () => {
  test("pending referral gets the plan's discount; nothing once it has qualified", async () => {
    const s = await scenario();
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referredId, plan: "base" })).toEqual({ amountCents: 1940 });
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referredId, plan: "pro" })).toEqual({ amountCents: 3940 });
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referredId, plan: "enterprise" })).toBeNull();
    await s.t.run((ctx) => ctx.db.patch(s.referralId, { status: "qualified" }));
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referredId, plan: "base" })).toBeNull();
  });
  test("no referral, or system switched off: no discount", async () => {
    const s = await scenario();
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referrerId, plan: "base" })).toBeNull();
    vi.stubEnv("REFERRALS_ENABLED", "0");
    expect(await s.t.query(internal.referrals.checkoutDiscount, { tenantId: s.referredId, plan: "base" })).toBeNull();
  });
  test("coupon is created once and then reused", async () => {
    expect(await ensureReferralCoupon(1940)).toBe("onespec-ref-1940");
    expect(await ensureReferralCoupon(1940)).toBe("onespec-ref-1940");
    const creations = stripe.posts.filter((p) => p.path === "/coupons");
    expect(creations).toHaveLength(1);
    expect(creations[0].body.get("amount_off")).toBe("1940");
    expect(creations[0].body.get("currency")).toBe("eur");
    expect(creations[0].body.get("duration")).toBe("repeating");
    expect(creations[0].body.get("duration_in_months")).toBe("1");
  });
  test("coupon helper refuses nonsense amounts", async () => {
    expect(await ensureReferralCoupon(0)).toBeNull();
    expect(await ensureReferralCoupon(-5)).toBeNull();
    expect(await ensureReferralCoupon(12.5)).toBeNull();
    expect(stripe.posts).toHaveLength(0);
  });
});

describe("qualification", () => {
  test("first real payment qualifies and starts a 30-day hold", async () => {
    const s = await scenario();
    await qualify(s, T0 - 2 * DAY_MS);
    const r = await referral(s);
    expect(r).toMatchObject({ status: "qualified", firstInvoiceId: "in_1", firstInvoicePaidCents: 9700, rewardCents: 3000 });
    expect(r?.holdUntil).toBe(T0 - 2 * DAY_MS + 30 * DAY_MS);
  });

  test("the reward follows the plan the invited account is on (Pro = 60 EUR)", async () => {
    const s = await scenario({ referredPlan: "pro" });
    await qualify(s);
    expect((await referral(s))?.rewardCents).toBe(6000);
  });

  test("a free trial (0 EUR invoice) does not qualify", async () => {
    const s = await scenario();
    stripe.invoices["cus_new"] = [{ id: "in_trial", amount_paid: 0, created: 1 }];
    await s.t.action(internal.referralPayouts.qualifySweep, {});
    expect((await referral(s))?.status).toBe("pending");
  });

  test("the same physical card on both accounts is rejected", async () => {
    const s = await scenario();
    stripe.cards["cus_new"] = ["fp_same"];
    stripe.cards["cus_ref"] = ["fp_other", "fp_same"];
    await qualify(s);
    expect(await referral(s)).toMatchObject({ status: "rejected", rejectionReason: "SAME_CARD" });
  });

  test("the same Stripe customer on both accounts is rejected", async () => {
    const s = await scenario();
    await s.t.run((ctx) => ctx.db.patch(s.referredId, { stripeCustomerId: "cus_ref" }));
    stripe.invoices["cus_ref"] = [paidInvoice("in_1", 9700, T0)];
    await s.t.action(internal.referralPayouts.qualifySweep, {});
    expect(await referral(s)).toMatchObject({ status: "rejected", rejectionReason: "SAME_CUSTOMER" });
  });

  test("Stripe unreadable: nothing is decided, it is retried later", async () => {
    const s = await scenario();
    stripe.invoices["cus_new"] = [paidInvoice("in_1", 9700, T0)];
    stripe.failReads = true;
    await s.t.action(internal.referralPayouts.qualifySweep, {});
    expect((await referral(s))?.status).toBe("pending");
    stripe.failReads = false;
    await s.t.action(internal.referralPayouts.qualifySweep, {});
    expect((await referral(s))?.status).toBe("qualified");
  });

  test("system switched off: no new qualification", async () => {
    const s = await scenario();
    stripe.invoices["cus_new"] = [paidInvoice("in_1", 9700, T0)];
    vi.stubEnv("REFERRALS_ENABLED", "0");
    const res = await s.t.action(internal.referralPayouts.qualifySweep, {});
    expect(res.skipped).toBe("REFERRALS_DISABLED");
    expect((await referral(s))?.status).toBe("pending");
  });

  test("a plan without a reward is rejected", async () => {
    const s = await scenario();
    await s.t.run((ctx) => ctx.db.patch(s.referredId, { plan: "enterprise" }));
    await qualify(s);
    expect(await referral(s)).toMatchObject({ status: "rejected", rejectionReason: "PLAN_NOT_ELIGIBLE" });
  });
});

describe("reward", () => {
  async function qualified(paidAt = T0) {
    const s = await scenario();
    await qualify(s, paidAt);
    return s;
  }

  test("nothing is paid during the hold", async () => {
    const s = await qualified();
    vi.setSystemTime(T0 + 29 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect((await referral(s))?.status).toBe("qualified");
  });

  test("after the hold the inviter gets a credit on the Stripe balance, once", async () => {
    const s = await qualified();
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(1);
    expect(creditPosts()[0].path).toBe("/customers/cus_ref/balance_transactions");
    expect(creditPosts()[0].body.get("amount")).toBe("-3000"); // negative = credit
    expect(creditPosts()[0].body.get("currency")).toBe("eur");
    expect(creditPosts()[0].key).toBe(`referral-reward-${s.referralId}`);
    const r = await referral(s);
    expect(r?.status).toBe("rewarded");
    expect(r?.stripeBalanceTxnId).toMatch(/^cbtxn_/);
    // a second run, or an overlapping one, never pays again
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(1);
  });

  test("a credit that already reached Stripe (crash before saving) is found, not duplicated", async () => {
    const s = await qualified();
    stripe.txns["cus_ref"] = [{ id: "cbtxn_old", amount: -3000, metadata: { referralId: String(s.referralId) } }];
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect(await referral(s)).toMatchObject({ status: "rewarded", stripeBalanceTxnId: "cbtxn_old" });
  });

  test("two overlapping claims: only one proceeds", async () => {
    const s = await qualified();
    vi.setSystemTime(T0 + 31 * DAY_MS);
    const a = await s.t.mutation(internal.referralPayouts.claimReward, { referralId: s.referralId });
    const b = await s.t.mutation(internal.referralPayouts.claimReward, { referralId: s.referralId });
    expect(a.kind).toBe("go");
    expect(b).toEqual({ kind: "skip", reason: "IN_PROGRESS" });
    // a claim that never completed is retried after an hour
    vi.setSystemTime(T0 + 31 * DAY_MS + 61 * 60 * 1000);
    expect((await s.t.mutation(internal.referralPayouts.claimReward, { referralId: s.referralId })).kind).toBe("go");
  });

  test("refund or dispute during the hold: rejected, nothing paid", async () => {
    const s = await qualified();
    stripe.charges["cus_new"] = [{ amount_refunded: 9700 }];
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect(await referral(s)).toMatchObject({ status: "rejected", rejectionReason: "REFUND_OR_DISPUTE" });
  });

  test("the invited account cancelled: expired, nothing paid", async () => {
    const s = await qualified();
    await s.t.run((ctx) => ctx.db.patch(s.referredId, { planStatus: "suspended" }));
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect(await referral(s)).toMatchObject({ status: "expired", rejectionReason: "REFERRED_CANCELLED" });
  });

  test("inviter stopped paying: waits, pays if back in time, expires after 90 days", async () => {
    const s = await qualified();
    await s.t.run((ctx) => ctx.db.patch(s.referrerId, { planStatus: "past_due" }));
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("qualified");
    await s.t.run((ctx) => ctx.db.patch(s.referrerId, { planStatus: "active" }));
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });

  test("inviter never comes back: expires after the grace period", async () => {
    const s = await qualified();
    await s.t.run((ctx) => ctx.db.patch(s.referrerId, { planStatus: "suspended" }));
    vi.setSystemTime(T0 + (30 + 91) * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect(await referral(s)).toMatchObject({ status: "expired", rejectionReason: "REFERRER_NOT_ELIGIBLE" });
  });

  test("cap: 10 rewards in 12 months, the 11th waits and then expires", async () => {
    const s = await qualified();
    await s.t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) {
        const other = await seedTenantRow(ctx);
        await ctx.db.insert("referrals", { referrerTenantId: s.referrerId, referredTenantId: other, code: "OS-AAAAAA", status: "rewarded", rewardedAt: T0 + 20 * DAY_MS, createdAt: T0 });
      }
    });
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(creditPosts()).toHaveLength(0);
    expect((await referral(s))?.status).toBe("qualified");
    vi.setSystemTime(T0 + (30 + 91) * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect(await referral(s)).toMatchObject({ status: "expired", rejectionReason: "CAP_REACHED" });
  });

  test("rewards older than 12 months do not count towards the cap", async () => {
    const s = await qualified();
    await s.t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) {
        const other = await seedTenantRow(ctx);
        await ctx.db.insert("referrals", { referrerTenantId: s.referrerId, referredTenantId: other, code: "OS-AAAAAA", status: "rewarded", rewardedAt: T0 - 400 * DAY_MS, createdAt: T0 - 500 * DAY_MS });
      }
    });
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });

  test("earned rewards are still paid when the system is switched off", async () => {
    const s = await qualified();
    vi.stubEnv("REFERRALS_ENABLED", "0");
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });

  test("Stripe unreadable: nothing is claimed or lost, it is retried", async () => {
    const s = await qualified();
    vi.setSystemTime(T0 + 31 * DAY_MS);
    stripe.failReads = true;
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("qualified");
    expect((await referral(s))?.rewardClaimedAt).toBeUndefined();
    stripe.failReads = false;
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });
});

describe("clawback", () => {
  async function rewarded() {
    const s = await scenario();
    await qualify(s);
    vi.setSystemTime(T0 + 31 * DAY_MS);
    await s.t.action(internal.referralPayouts.rewardSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
    return s;
  }

  test("a later refund takes back the credit while it is still unused", async () => {
    const s = await rewarded();
    stripe.charges["cus_new"] = [{ amount_refunded: 9700 }];
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await referral(s))?.status).toBe("clawback");
    const reversals = creditPosts().filter((p) => p.body.get("metadata[clawbackOf]"));
    expect(reversals).toHaveLength(1);
    expect(reversals[0].body.get("amount")).toBe("3000"); // positive = takes the credit back
    expect(stripe.balances["cus_ref"]).toBe(0);
    // idempotent: another run changes nothing
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect(creditPosts().filter((p) => p.body.get("metadata[clawbackOf]"))).toHaveLength(1);
  });

  test("credit already used: marked as clawback, nothing reversed automatically", async () => {
    const s = await rewarded();
    stripe.balances["cus_ref"] = -1000; // part of the credit already consumed by an invoice
    stripe.charges["cus_new"] = [{ disputed: true }];
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await referral(s))?.status).toBe("clawback");
    expect(creditPosts().filter((p) => p.body.get("metadata[clawbackOf]"))).toHaveLength(0);
  });

  test("no refund: nothing happens", async () => {
    const s = await rewarded();
    stripe.charges["cus_new"] = [{ amount_refunded: 0, disputed: false }];
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });

  test("outside the 60-day window nothing is checked", async () => {
    const s = await rewarded();
    stripe.charges["cus_new"] = [{ amount_refunded: 9700 }];
    vi.setSystemTime(T0 + 70 * DAY_MS);
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await referral(s))?.status).toBe("rewarded");
  });
});

/** A throwaway tenant row, used only to give the cap test distinct invited accounts. */
async function seedTenantRow(ctx: MutationCtx): Promise<Id<"tenants">> {
  const ownerUserId = await ctx.db.insert("users", { name: "o", email: `o${Math.random()}@x.it` });
  return ctx.db.insert("tenants", {
    name: "x",
    slug: `x-${Math.random()}`,
    ownerUserId,
    plan: "base",
    planStatus: "active",
    createdVia: "open_signup",
  });
}
