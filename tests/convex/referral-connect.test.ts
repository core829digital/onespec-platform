import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";
import { DAY_MS } from "../../convex/lib/referralRewards";

const T0 = new Date("2026-10-01T00:00:00Z").getTime();
type Db = ReturnType<typeof newDb>;

/* ----------------------- a small fake Stripe (Connect) ----------------------- */
interface Fake {
  accounts: Record<string, { transfers: string }>;
  transfers: Array<{ id: string; amount: number; destination: string; metadata: Record<string, string> }>;
  charges: Record<string, unknown[]>;
  posts: Array<{ path: string; body: URLSearchParams; key: string | null }>;
  idem: Map<string, unknown>;
  failTransfer: string | null;
  failReversal: boolean;
  n: number;
}
let st: Fake;

function install(): Fake {
  const f: Fake = { accounts: {}, transfers: [], charges: {}, posts: [], idem: new Map(), failTransfer: null, failReversal: false, n: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/v1/, "");
      const method = init?.method ?? "GET";
      const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json });
      if (method === "GET") {
        let m = path.match(/^\/accounts\/([^/]+)$/);
        if (m) return f.accounts[m[1]] ? reply(200, { id: m[1], capabilities: { transfers: f.accounts[m[1]].transfers } }) : reply(404, { error: { message: "No such account" } });
        if (path === "/transfers") return reply(200, { data: f.transfers.filter((t) => t.destination === u.searchParams.get("destination")) });
        if (path === "/charges") return reply(200, { data: f.charges[u.searchParams.get("customer") ?? ""] ?? [] });
        m = path.match(/^\/customers\//);
        if (m) return reply(200, { data: [], balance: 0 });
        return reply(200, { data: [] });
      }
      const body = new URLSearchParams(init?.body ?? "");
      const key = init?.headers?.["Idempotency-Key"] ?? null;
      f.posts.push({ path, body, key });
      if (key && f.idem.has(key)) return reply(200, f.idem.get(key));
      const done = (json: unknown) => {
        if (key) f.idem.set(key, json);
        return reply(200, json);
      };
      if (path === "/accounts") {
        const id = `acct_${++f.n}`;
        f.accounts[id] = { transfers: "inactive" };
        return done({ id });
      }
      if (/^\/customers\/[^/]+\/balance_transactions$/.test(path)) return done({ id: `cbtxn_${++f.n}` });
      if (path === "/account_links") return done({ url: `https://connect.stripe.test/onboard/${body.get("account")}` });
      if (path === "/transfers") {
        if (f.failTransfer) return reply(400, { error: { message: f.failTransfer, code: "balance_insufficient" } });
        const t = { id: `tr_${++f.n}`, amount: Number(body.get("amount")), destination: body.get("destination") as string, metadata: { referralId: body.get("metadata[referralId]") ?? "" } };
        f.transfers.push(t);
        return done(t);
      }
      if (/^\/transfers\/[^/]+\/reversals$/.test(path)) {
        if (f.failReversal) return reply(400, { error: { message: "insufficient funds on the connected account" } });
        return done({ id: `trr_${++f.n}` });
      }
      return reply(404, { error: { message: `unhandled ${method} ${path}` } });
    }),
  );
  return f;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubEnv("REFERRALS_ENABLED", "1");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("SITE_URL", "https://platform.example");
  st = install();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* -------------------------------- onboarding -------------------------------- */
async function account(t: Db) {
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { stripeCustomerId: "cus_ref", country: "IT" }));
  return s;
}
const settings = (t: Db, subject: Id<"users">, tenantId: Id<"tenants">) => t.withIdentity({ subject }).query(api.referralPayoutAccount.getPayoutSettings, { tenantId });

describe("choosing and connecting", () => {
  test("default is credit; only the owner can choose; admins can read it", async () => {
    const t = newDb();
    const s = await account(t);
    expect(await settings(t, s.adminId, s.tenantId)).toMatchObject({ method: "credit", hasAccount: false, ready: false, canEdit: false });
    expect(await settings(t, s.ownerId, s.tenantId)).toMatchObject({ canEdit: true });
    await expect(t.withIdentity({ subject: s.adminId }).mutation(api.referralPayoutAccount.setPayoutMethod, { tenantId: s.tenantId, method: "stripe" })).rejects.toThrow();
    await expect(t.withIdentity({ subject: s.memberId }).query(api.referralPayoutAccount.getPayoutSettings, { tenantId: s.tenantId })).rejects.toThrow();
    await t.withIdentity({ subject: s.ownerId }).mutation(api.referralPayoutAccount.setPayoutMethod, { tenantId: s.tenantId, method: "stripe" });
    expect((await settings(t, s.adminId, s.tenantId)).method).toBe("stripe");
    await t.withIdentity({ subject: s.ownerId }).mutation(api.referralPayoutAccount.setPayoutMethod, { tenantId: s.tenantId, method: "credit" });
    expect((await settings(t, s.ownerId, s.tenantId)).method).toBe("credit");
    const audit = await t.run((ctx) => ctx.db.query("auditLog").withIndex("by_action", (q) => q.eq("action", "referral.payout_method_set")).collect());
    expect(audit).toHaveLength(2);
  });

  test("switched off: the method cannot be changed or the account connected", async () => {
    vi.stubEnv("REFERRALS_ENABLED", "0");
    const t = newDb();
    const s = await account(t);
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.referralPayoutAccount.setPayoutMethod, { tenantId: s.tenantId, method: "stripe" })).rejects.toThrow();
    await expect(as.action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId })).rejects.toThrow();
  });

  test("onboarding creates one Express account (transfers capability) and returns Stripe's link", async () => {
    const t = newDb();
    const s = await account(t);
    const as = t.withIdentity({ subject: s.ownerId });
    const { url } = await as.action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId, origin: "https://platform.example" });
    expect(url).toMatch(/^https:\/\/connect\.stripe\.test\/onboard\/acct_/);
    const created = st.posts.filter((p) => p.path === "/accounts");
    expect(created).toHaveLength(1);
    expect(created[0].body.get("type")).toBe("express");
    expect(created[0].body.get("capabilities[transfers][requested]")).toBe("true");
    expect(created[0].body.get("country")).toBe("IT");
    expect(created[0].body.get("metadata[tenantId]")).toBe(String(s.tenantId));
    const link = st.posts.find((p) => p.path === "/account_links")!;
    expect(link.body.get("type")).toBe("account_onboarding");
    expect(link.body.get("return_url")).toBe("https://platform.example/app/account/referral?payout=return");
    expect(link.body.get("refresh_url")).toBe("https://platform.example/app/account/referral?payout=refresh");
    // coming back later reuses the same account
    await as.action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId });
    expect(st.posts.filter((p) => p.path === "/accounts")).toHaveLength(1);
    expect(await settings(t, s.ownerId, s.tenantId)).toMatchObject({ hasAccount: true, ready: false });
  });

  test("an untrusted origin cannot redirect the owner elsewhere", async () => {
    const t = newDb();
    const s = await account(t);
    await t.withIdentity({ subject: s.ownerId }).action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId, origin: "https://evil.example" });
    const link = st.posts.find((p) => p.path === "/account_links")!;
    expect(link.body.get("return_url")).toBe("https://platform.example/app/account/referral?payout=return");
  });

  test("admins and members cannot start the onboarding", async () => {
    const t = newDb();
    const s = await account(t);
    await expect(t.withIdentity({ subject: s.adminId }).action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId })).rejects.toThrow();
    await expect(t.withIdentity({ subject: s.memberId }).action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId })).rejects.toThrow();
    expect(st.posts).toHaveLength(0);
  });

  test("another account's owner cannot touch this account", async () => {
    const t = newDb();
    const a = await account(t);
    const b = await account(t);
    await expect(t.withIdentity({ subject: b.ownerId }).action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: a.tenantId })).rejects.toThrow();
  });

  test("status refresh reads the capability from Stripe", async () => {
    const t = newDb();
    const s = await account(t);
    const as = t.withIdentity({ subject: s.ownerId });
    expect(await as.action(api.referralPayoutAccount.refreshPayoutStatus, { tenantId: s.tenantId })).toEqual({ ready: false, hasAccount: false });
    await as.action(api.referralPayoutAccount.startPayoutOnboarding, { tenantId: s.tenantId });
    expect((await as.action(api.referralPayoutAccount.refreshPayoutStatus, { tenantId: s.tenantId })).ready).toBe(false);
    st.accounts["acct_1"].transfers = "active";
    expect(await as.action(api.referralPayoutAccount.refreshPayoutStatus, { tenantId: s.tenantId })).toEqual({ ready: true, hasAccount: true });
    expect((await settings(t, s.ownerId, s.tenantId)).ready).toBe(true);
  });
});

/* ---------------------------------- payouts ---------------------------------- */
interface Scn {
  t: Db;
  referrerId: Id<"tenants">;
  referredId: Id<"tenants">;
  referralId: Id<"referrals">;
  ownerId: Id<"users">;
}

async function payoutScenario(opts: { method?: "credit" | "stripe"; accountReady?: boolean; account?: boolean } = {}): Promise<Scn> {
  const t = newDb();
  const ref = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(ref.tenantId, { stripeCustomerId: "cus_ref", stripeSubscriptionId: "sub_ref", country: "IT" }));
  const referred = await seedTenant(t, { plan: "base" });
  await t.run((ctx) => ctx.db.patch(referred.tenantId, { stripeCustomerId: "cus_new", stripeSubscriptionId: "sub_new" }));
  const referralId = await t.run((ctx) =>
    ctx.db.insert("referrals", {
      referrerTenantId: ref.tenantId,
      referredTenantId: referred.tenantId,
      code: "OS-AAAAAA",
      status: "qualified",
      createdAt: T0 - 40 * DAY_MS,
      qualifiedAt: T0 - 31 * DAY_MS,
      holdUntil: T0 - DAY_MS,
      firstInvoiceId: "in_1",
      firstInvoicePaidCents: 9700,
      rewardCents: 970,
    }),
  );
  if (opts.method) {
    await t.run((ctx) =>
      ctx.db.insert("referralPayoutAccounts", {
        tenantId: ref.tenantId,
        method: opts.method as "credit" | "stripe",
        stripeAccountId: opts.account === false ? undefined : "acct_ref",
        transfersActive: opts.accountReady ?? true,
        createdAt: T0,
      }),
    );
  }
  st.accounts["acct_ref"] = { transfers: "active" };
  return { t, referrerId: ref.tenantId, referredId: referred.tenantId, referralId, ownerId: ref.ownerId };
}
const get = (s: Scn) => s.t.run((ctx) => ctx.db.get(s.referralId));
const sweep = (s: Scn) => s.t.action(internal.referralPayouts.rewardSweep, {});
const transfersPosted = () => st.posts.filter((p) => p.path === "/transfers");
const creditsPosted = () => st.posts.filter((p) => /balance_transactions$/.test(p.path));

describe("paying the reward as money", () => {
  test("a ready Connect account receives the transfer, once, with an idempotency key", async () => {
    const s = await payoutScenario({ method: "stripe" });
    await sweep(s);
    expect(transfersPosted()).toHaveLength(1);
    const p = transfersPosted()[0];
    expect(p.body.get("amount")).toBe("970"); // positive: money out to the connected account
    expect(p.body.get("currency")).toBe("eur");
    expect(p.body.get("destination")).toBe("acct_ref");
    expect(p.body.get("metadata[referralId]")).toBe(String(s.referralId));
    expect(p.key).toBe(`referral-transfer-${s.referralId}`);
    expect(creditsPosted()).toHaveLength(0); // no subscription credit on top
    expect(await get(s)).toMatchObject({ status: "rewarded", payoutMethod: "stripe", stripeTransferId: "tr_1" });
    // running again pays nothing more
    await sweep(s);
    expect(transfersPosted()).toHaveLength(1);
  });

  test("the inviter is told, with the money wording", async () => {
    const s = await payoutScenario({ method: "stripe" });
    await sweep(s);
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    const mails = (await s.t.run((ctx) => ctx.db.query("emailLog").collect())).filter((m) => m.template === "referral_rewarded");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain("inviato");
    expect(mails[0].subject).toContain("9,70");
  });

  test("credit stays the default and is untouched by the new option", async () => {
    const s = await payoutScenario();
    await sweep(s);
    expect(transfersPosted()).toHaveLength(0);
    expect(creditsPosted()).toHaveLength(1);
    expect(await get(s)).toMatchObject({ status: "rewarded", payoutMethod: "credit" });
  });

  test("money chosen but no account yet: waits, then expires after the grace period", async () => {
    const s = await payoutScenario({ method: "stripe", account: false, accountReady: false });
    await sweep(s);
    expect(transfersPosted()).toHaveLength(0);
    expect((await get(s))?.status).toBe("qualified");
    vi.setSystemTime(T0 + 91 * DAY_MS);
    await sweep(s);
    expect(await get(s)).toMatchObject({ status: "expired", rejectionReason: "PAYOUT_ACCOUNT_NOT_READY" });
  });

  test("account set up in time: the waiting reward is paid", async () => {
    const s = await payoutScenario({ method: "stripe", accountReady: false });
    await sweep(s);
    expect((await get(s))?.status).toBe("qualified");
    await s.t.run(async (ctx) => {
      const row = await ctx.db.query("referralPayoutAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", s.referrerId)).first();
      await ctx.db.patch(row!._id, { transfersActive: true });
    });
    await sweep(s);
    expect((await get(s))?.status).toBe("rewarded");
  });

  test("database says ready but Stripe says not active: nothing sent, flag corrected, claim released", async () => {
    const s = await payoutScenario({ method: "stripe" });
    st.accounts["acct_ref"].transfers = "inactive";
    await sweep(s);
    expect(transfersPosted()).toHaveLength(0);
    const r = await get(s);
    expect(r?.status).toBe("qualified");
    expect(r?.rewardClaimedAt).toBeUndefined();
    expect((await settings(s.t, s.ownerId, s.referrerId)).ready).toBe(false);
  });

  test("a transfer that already reached Stripe is found, not duplicated", async () => {
    const s = await payoutScenario({ method: "stripe" });
    st.transfers.push({ id: "tr_old", amount: 970, destination: "acct_ref", metadata: { referralId: String(s.referralId) } });
    await sweep(s);
    expect(transfersPosted()).toHaveLength(0);
    expect(await get(s)).toMatchObject({ status: "rewarded", stripeTransferId: "tr_old", payoutMethod: "stripe" });
  });

  test("not enough balance on the platform: stays qualified, retried an hour later", async () => {
    const s = await payoutScenario({ method: "stripe" });
    st.failTransfer = "Insufficient funds in Stripe account";
    await sweep(s);
    expect((await get(s))?.status).toBe("qualified");
    expect(transfersPosted()).toHaveLength(1); // the attempt that failed
    // funds arrive, but within the hour the claim blocks another attempt
    st.failTransfer = null;
    await sweep(s);
    expect(transfersPosted()).toHaveLength(1);
    expect((await get(s))?.status).toBe("qualified");
    vi.setSystemTime(T0 + 61 * 60 * 1000);
    await sweep(s);
    expect(await get(s)).toMatchObject({ status: "rewarded", payoutMethod: "stripe" });
    expect(st.transfers).toHaveLength(1); // exactly one real transfer
  });

  test("the cap and the refund checks apply to money exactly as to credit", async () => {
    const s = await payoutScenario({ method: "stripe" });
    st.charges["cus_new"] = [{ amount_refunded: 9700 }];
    await sweep(s);
    expect(transfersPosted()).toHaveLength(0);
    expect(await get(s)).toMatchObject({ status: "rejected", rejectionReason: "REFUND_OR_DISPUTE" });
  });
});

describe("clawback of a money reward", () => {
  async function paid() {
    const s = await payoutScenario({ method: "stripe" });
    await sweep(s);
    expect((await get(s))?.status).toBe("rewarded");
    return s;
  }

  test("a refund reverses the transfer, once", async () => {
    const s = await paid();
    st.charges["cus_new"] = [{ amount_refunded: 9700 }];
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await get(s))?.status).toBe("clawback");
    const rev = st.posts.filter((p) => /\/transfers\/tr_1\/reversals$/.test(p.path));
    expect(rev).toHaveLength(1);
    expect(rev[0].body.get("amount")).toBe("970");
    expect(rev[0].key).toBe(`referral-reversal-${s.referralId}`);
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect(st.posts.filter((p) => /reversals$/.test(p.path))).toHaveLength(1);
  });

  test("reversal refused by Stripe: still marked as clawback, never throws", async () => {
    const s = await paid();
    st.charges["cus_new"] = [{ disputed: true }];
    st.failReversal = true;
    await s.t.action(internal.referralPayouts.clawbackSweep, {});
    expect((await get(s))?.status).toBe("clawback");
  });
});
