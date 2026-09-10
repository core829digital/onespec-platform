import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  effectivePriceCents,
  alphaPriceCents,
  BILLING_PLANS,
} from "../../convex/lib/billingPlans";
import { verifyStripeSignature } from "../../convex/billing";
import { newDb, seedTenant } from "./_helpers";

describe("billing plan catalogue", () => {
  test("verified prices match the pricing page", () => {
    expect(BILLING_PLANS.find((p) => p.key === "starter")?.priceCents).toBe(2400);
    expect(BILLING_PLANS.find((p) => p.key === "pro")?.priceCents).toBe(4700);
    expect(BILLING_PLANS.find((p) => p.key === "enterprise")?.priceCents).toBeNull();
    expect(BILLING_PLANS.find((p) => p.key === "showroom")?.priceCents).toBeNull();
  });

  test("Alpha price is a derived 15% discount", () => {
    expect(alphaPriceCents(2400)).toBe(2040);
    expect(alphaPriceCents(4700)).toBe(3995);
    expect(effectivePriceCents("pro", true)).toBe(3995);
    expect(effectivePriceCents("pro", false)).toBe(4700);
    expect(effectivePriceCents("enterprise", true)).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  async function sign(payload: string, secret: string, t: number) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `t=${t},v1=${hex}`;
  }

  test("accepts a fresh valid signature, rejects tampering and stale timestamps", async () => {
    const payload = '{"id":"evt_1"}';
    const now = Math.floor(Date.now() / 1000);
    const header = await sign(payload, "whsec_test", now);

    expect(await verifyStripeSignature(payload, header, "whsec_test")).toBe(true);
    expect(await verifyStripeSignature(payload + "x", header, "whsec_test")).toBe(false);
    expect(await verifyStripeSignature(payload, header, "whsec_wrong")).toBe(false);
    const stale = await sign(payload, "whsec_test", now - 10_000);
    expect(await verifyStripeSignature(payload, stale, "whsec_test")).toBe(false);
    expect(await verifyStripeSignature(payload, null, "whsec_test")).toBe(false);
  });
});

describe("billing.getBillingState + webhook", () => {
  test("getBillingState reports plan, alpha discount and dormant checkout", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "alpha", isAlpha: true });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.checkoutAvailable).toBe(false);
    // No country on the tenant → region resolves to the IT default, so the
    // Pro plan uses the IT regional price (€89) with the 15% Alpha discount.
    expect(s?.region).toBe("IT");
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(8900);
    expect(s?.plans.find((p) => p.key === "pro")?.yourPriceCents).toBe(7565);
  });

  test("a region without a price override falls back to the base plan price", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "starter" });
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { country: "NL" });
    });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.region).toBe("NL");
    // NL has a REGIONAL_PRICES entry → Pro price €129.
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(12900);
  });

  test("FR tenant gets the France regional plan price", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "starter" });
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { country: "FR" });
    });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.region).toBe("FR");
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(9900);
  });

  test("BE tenant gets the Belgium regional plan price", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "starter" });
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { country: "BE" });
    });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.region).toBe("BE");
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(9900);
  });

  test("applyWebhookEvent activates a subscription and is idempotent", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);

    const call = () =>
      t.mutation(internal.billing.applyWebhookEvent, {
        eventId: "evt_123",
        type: "checkout.session.completed",
        data: { object: { client_reference_id: tenantId, customer: "cus_1", subscription: "sub_1" } },
      });

    expect((await call()).duplicate).toBe(false);
    expect((await call()).duplicate).toBe(true);

    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.stripeCustomerId).toBe("cus_1");
    expect(tenant?.stripeSubscriptionId).toBe("sub_1");
    expect(tenant?.planStatus).toBe("active");
  });

  test("checkout.session.completed with trial metadata starts a Pro trial", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);

    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_trial_1",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: tenantId,
          customer: "cus_trial",
          subscription: "sub_trial",
          metadata: { trialPlan: "pro", cycle: "monthly" },
        },
      },
    });

    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.plan).toBe("pro");
    expect(tenant?.trialPlan).toBe("pro");
    expect(tenant?.trialStartedAt).toBeDefined();
    expect(tenant?.billingCycle).toBe("monthly");
  });

  test("subscription.updated trialing records trial end; active clears it", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;

    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_trial_2",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_trial",
          customer: "cus_trial",
          client_reference_id: tenantId,
          status: "trialing",
          trial_end: trialEnd,
          current_period_end: trialEnd,
          items: { data: [] },
        },
      },
    });
    // tenantId resolution needs the customer link first
    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.trialEndsAt).toBe(trialEnd * 1000);
    expect(tenant?.trialPlan).toBe("pro");
  });

  test("trialSweep flips abandoned pre-Stripe trials to past_due, skips active subs", async () => {
    const t = newDb();
    const abandoned = await seedTenant(t);
    const active = await seedTenant(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(abandoned.tenantId, {
        planStatus: "trialing",
        trialEndsAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
      });
      await ctx.db.patch(active.tenantId, {
        planStatus: "trialing",
        stripeSubscriptionId: "sub_live",
        trialEndsAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      });
    });

    const res = await t.mutation(internal.billing.trialSweep, {});
    expect(res.swept).toBe(1);

    const after = await t.run(async (ctx) => ({
      abandoned: await ctx.db.get(abandoned.tenantId),
      active: await ctx.db.get(active.tenantId),
    }));
    expect(after.abandoned?.planStatus).toBe("past_due");
    expect(after.active?.planStatus).toBe("trialing");
  });

  test("price→plan reverse map resolves regional env prices to pro", async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_IT = "price_test_pro_it";
    try {
      const t = newDb();
      const { tenantId } = await seedTenant(t);
      await t.run(async (ctx) => {
        await ctx.db.patch(tenantId, { stripeCustomerId: "cus_map" });
      });
      await t.mutation(internal.billing.applyWebhookEvent, {
        eventId: "evt_map_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_map",
            customer: "cus_map",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            items: { data: [{ price: { id: "price_test_pro_it" } }] },
          },
        },
      });
      const tenant = await t.run((ctx) => ctx.db.get(tenantId));
      expect(tenant?.plan).toBe("pro");
      expect(tenant?.billingCycle).toBe("monthly");
    } finally {
      delete process.env.STRIPE_PRICE_PRO_MONTHLY_IT;
    }
  });
});
