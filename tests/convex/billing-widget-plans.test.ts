import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BILLING_PLANS, listPriceCents, planFromStripePriceId } from "../../convex/lib/billingPlans";
import { subscriptionPatch, verifyStripeSignature } from "../../convex/billing";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

/**
 * Stripe for the two plan families: Widget (essentials / essentials_plus /
 * max) and Platform (base / pro / agency / enterprise).
 */
const PRICES = {
  STRIPE_PRICE_ESSENTIALS_MONTHLY: "price_ess_m",
  STRIPE_PRICE_ESSENTIALS_PLUS_MONTHLY: "price_essp_m",
  STRIPE_PRICE_MAX_MONTHLY: "price_max_m",
  STRIPE_PRICE_MAX_MONTHLY_IT: "price_max_m_it",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
  Object.assign(process.env, PRICES);
});
afterEach(() => {
  vi.useRealTimers();
  for (const k of Object.keys(PRICES)) delete process.env[k];
  delete process.env.STRIPE_SECRET_KEY;
});

type T = ReturnType<typeof newDb>;

function subEvent(t: T, eventId: string, customer: string, price: string, status = "active", metadata: Record<string, string> = {}) {
  return t.mutation(internal.billing.applyWebhookEvent, {
    eventId,
    type: "customer.subscription.updated",
    data: { object: { id: "sub_x", customer, status, metadata, items: { data: [{ price: { id: price } }] } } },
  });
}

async function linkCustomer(t: T, tenantId: Id<"tenants">, customer: string, plan: "essentials" | "essentials_plus" | "max" | "pro") {
  await t.run((ctx) => ctx.db.patch(tenantId, { stripeCustomerId: customer, stripeSubscriptionId: "sub_x", plan }));
}

describe("catalogue", () => {
  test("widget plans are listed first with the financial-plan prices; monthly only", () => {
    expect(BILLING_PLANS.map((p) => [p.key, p.family, p.priceCents])).toEqual([
      ["essentials", "widget", 4995],
      ["essentials_plus", "widget", 6244],
      ["max", "widget", 7990],
      ["base", "platform", 9700],
      ["pro", "platform", 19700],
      ["agency", "platform", 39700],
      ["enterprise", "platform", 69000],
    ]);
    expect(listPriceCents("essentials_plus", "IT")).toBe(6244);
    // Display names only (founder's update); the keys are unchanged.
    expect(BILLING_PLANS.slice(0, 3).map((p) => p.name)).toEqual(["Level 1", "Level 2", "Level 3"]);
  });

  test("price ids map back to the widget plans (incl. regional)", () => {
    expect(planFromStripePriceId("price_ess_m")).toEqual({ plan: "essentials", cycle: "monthly", region: "" });
    expect(planFromStripePriceId("price_essp_m")).toEqual({ plan: "essentials_plus", cycle: "monthly", region: "" });
    expect(planFromStripePriceId("price_max_m_it")).toEqual({ plan: "max", cycle: "monthly", region: "IT" });
    expect(planFromStripePriceId("price_unknown")).toBeNull();
  });

  test("subscriptionPatch: widget price → widget plan; unknown price falls back to our metadata", () => {
    const p = subscriptionPatch({ id: "sub", status: "active", items: { data: [{ price: { id: "price_essp_m" } }] } }, null);
    expect(p).toMatchObject({ plan: "essentials_plus", billingCycle: "monthly", planStatus: "active" });
    const m = subscriptionPatch({ id: "sub", status: "active", metadata: { plan: "max", cycle: "monthly" }, items: { data: [{ price: { id: "price_x" } }] } }, null);
    expect(m.plan).toBe("max");
    const junk = subscriptionPatch({ id: "sub", status: "active", metadata: { plan: "enterprise" }, items: { data: [] } }, null);
    expect(junk.plan).toBeUndefined(); // sales-led / unknown keys are never self-applied
  });
});

describe("webhook", () => {
  test("checkout.session.completed applies the plan that was paid for (not the signup default)", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "pending_plan" }));
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_co_1",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: s.tenantId, customer: "cus_e", subscription: "sub_e", metadata: { plan: "essentials", cycle: "monthly" } } },
    });
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant).toMatchObject({ plan: "essentials", planStatus: "active", stripeCustomerId: "cus_e" });
  });

  test("a signed widget-plan event verifies; tampering with the plan breaks the signature", async () => {
    const secret = "whsec_widget";
    const payload = JSON.stringify({ id: "evt_s", type: "customer.subscription.updated", data: { object: { items: { data: [{ price: { id: "price_ess_m" } }] } } } });
    const ts = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`));
    const header = `t=${ts},v1=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    expect(await verifyStripeSignature(payload, header, secret)).toBe(true);
    expect(await verifyStripeSignature(payload.replace("price_ess_m", "price_max_m"), header, secret)).toBe(false);
  });

  test("a forged event can't move another tenant's plan (customer id wins over the claimed tenant)", async () => {
    const t = newDb();
    const a = await seedTenant(t, { plan: "essentials" });
    const b = await seedTenant(t, { plan: "essentials" });
    await linkCustomer(t, a.tenantId, "cus_a", "essentials");
    await linkCustomer(t, b.tenantId, "cus_b", "essentials");
    await subEvent(t, "evt_forge", "cus_a", "price_max_m", "active", { tenantId: b.tenantId });
    const [ta, tb] = await t.run(async (ctx) => [await ctx.db.get(a.tenantId), await ctx.db.get(b.tenantId)]);
    expect(ta?.plan).toBe("max");
    expect(tb?.plan).toBe("essentials");
  });

  test("replaying an event is a no-op (idempotency)", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await linkCustomer(t, s.tenantId, "cus_r", "essentials");
    expect((await subEvent(t, "evt_r", "cus_r", "price_max_m")).duplicate).toBe(false);
    await t.run((ctx) => ctx.db.patch(s.tenantId, { plan: "essentials" }));
    expect((await subEvent(t, "evt_r", "cus_r", "price_max_m")).duplicate).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(s.tenantId)))?.plan).toBe("essentials");
  });
});

describe("upgrade / downgrade across and within families", () => {
  async function lockedRequest(t: T, tenantId: Id<"tenants">, publicId: string) {
    const cfg = await seedPublishedConfigurator(t, tenantId, publicId);
    await t.run((ctx) => ctx.db.insert("usageCounters", { tenantId, period: "2026-10", quoteRequestsCount: 999, activeConfiguratorsCount: 0 }));
    const id = await t.mutation(internal.widget.insertQuote, {
      publicId, configuratorId: cfg, catalogVersion: 1, items: [sampleItem], leadName: "L", leadEmail: "l@example.com", leadLocale: "it",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBe(true);
    return id;
  }

  test("widget → widget upgrade (Essentials → Max) unlocks locked requests", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await linkCustomer(t, s.tenantId, "cus_u", "essentials");
    const id = await lockedRequest(t, s.tenantId, "UPW0000001");
    await subEvent(t, "evt_up", "cus_u", "price_max_m");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBeUndefined();
  });

  test("widget → platform (Essentials → Pro) unlocks requests AND the platform modules", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await linkCustomer(t, s.tenantId, "cus_p", "essentials");
    const id = await lockedRequest(t, s.tenantId, "UPP0000001");
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.query(api.clients.listClients, { tenantId: s.tenantId })).rejects.toThrow("PLAN_UPGRADE_REQUIRED");

    await subEvent(t, "evt_pro", "cus_p", "price_pro_m");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBeUndefined();
    await expect(as.query(api.clients.listClients, { tenantId: s.tenantId })).resolves.toBeDefined();
  });

  test("platform → widget (Pro → Essentials): modules lock, data is kept, nothing re-locks", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    await linkCustomer(t, s.tenantId, "cus_d", "pro");
    const as = t.withIdentity({ subject: s.ownerId });
    const clientId = await as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "Cliente Storico" });

    await subEvent(t, "evt_down", "cus_d", "price_ess_m");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant?.plan).toBe("essentials");
    await expect(as.query(api.clients.listClients, { tenantId: s.tenantId })).rejects.toThrow("PLAN_UPGRADE_REQUIRED");
    // Locked, not deleted: an upgrade brings everything back.
    expect(await t.run((ctx) => ctx.db.get(clientId))).not.toBeNull();
  });

  test("widget downgrade (Max → Essentials) never re-locks an already visible request", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "max" });
    await linkCustomer(t, s.tenantId, "cus_m", "max");
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "DWW0000001");
    const id = await t.mutation(internal.widget.insertQuote, {
      publicId: "DWW0000001", configuratorId: cfg, catalogVersion: 1, items: [sampleItem], leadName: "V", leadEmail: "v@example.com", leadLocale: "it",
    });
    await subEvent(t, "evt_mdown", "cus_m", "price_ess_m");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBeUndefined();
  });

  test("a trialing status can never grant a widget plan's tenant a free trial of anything but Pro", () => {
    const p = subscriptionPatch({ id: "sub", status: "trialing", items: { data: [{ price: { id: "price_ess_m" } }] } }, null);
    expect(p.plan).toBe("pro"); // pre-existing invariant, kept: trials are Pro-only
  });
});

describe("server guards", () => {
  test("widget plans are monthly only; a live subscription can't open a second Checkout", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "essentials", cycle: "annual" }))
      .rejects.toThrow("ANNUAL_NOT_AVAILABLE");
    await t.run((ctx) => ctx.db.patch(s.tenantId, { stripeSubscriptionId: "sub_live", planStatus: "active" }));
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "max" }))
      .rejects.toThrow("ALREADY_SUBSCRIBED");
    // Seats: moving a 3-member team into Level 1 (1 seat) is refused.
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "suspended" }));
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "essentials" }))
      .rejects.toThrow("TEAM_EXCEEDS_TARGET_PLAN");
    // Only the owner manages billing.
    await expect(t.withIdentity({ subject: s.adminId }).action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "max" }))
      .rejects.toThrow("OWNER_ONLY");
  });

  test("dormant billing: onboarding can pick a widget plan (active, never trialing)", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "pending_plan" }));
    const as = t.withIdentity({ subject: s.ownerId });
    // seedTenant has 3 active members; Level 2 has 2 seats → refused until one is removed.
    await expect(as.mutation(api.onboarding.selectPlan, { plan: "essentials_plus" })).rejects.toThrow("TEAM_EXCEEDS_TARGET_PLAN");
    await t.run(async (ctx) => {
      const m = await ctx.db.query("memberships").withIndex("by_tenant_user", (q) => q.eq("tenantId", s.tenantId).eq("userId", s.memberId)).first();
      await ctx.db.patch(m!._id, { status: "removed" });
    });
    await as.mutation(api.onboarding.selectPlan, { plan: "essentials_plus" });
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant).toMatchObject({ plan: "essentials_plus", planStatus: "active" });
  });

  test("getBillingState lists widget plans first, each with its family", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const state = await t.withIdentity({ subject: s.ownerId }).query(api.billing.getBillingState, { tenantId: s.tenantId });
    expect(state?.plans.slice(0, 3).map((p) => [p.key, p.family])).toEqual([["essentials", "widget"], ["essentials_plus", "widget"], ["max", "widget"]]);
    expect(state?.entitlements.moduleCrm).toBe(false);
  });
});

describe("event ordering", () => {
  test("a late, older subscription event can't revert a newer plan", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await linkCustomer(t, s.tenantId, "cus_o", "essentials");
    const ev = (id: string, price: string, created: number) =>
      t.mutation(internal.billing.applyWebhookEvent, {
        eventId: id, type: "customer.subscription.updated", created,
        data: { object: { id: "sub_x", customer: "cus_o", status: "active", items: { data: [{ price: { id: price } }] } } },
      });
    await ev("evt_new", "price_max_m", 2_000); // upgrade to Level 3 (newer)
    await ev("evt_old", "price_ess_m", 1_000); // stale Level 1 state delivered late
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant?.plan).toBe("max");
    expect(tenant?.stripeLastEventCreated).toBe(2_000);
    // The stale event is still recorded (idempotency), just not applied.
    expect(await t.run((ctx) => ctx.db.query("billingEvents").collect())).toHaveLength(2);
  });
});
