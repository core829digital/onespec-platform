import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { listPriceCents, BILLING_PLANS } from "../../convex/lib/billingPlans";
import { appOrigin, verifyStripeSignature } from "../../convex/billing";
import { newDb, seedTenant } from "./_helpers";

describe("billing plan catalogue", () => {
  test("verified prices match the signed SaaS contracts (flat, no regional variance)", () => {
    expect(BILLING_PLANS.find((p) => p.key === "base")?.priceCents).toBe(9700);
    expect(BILLING_PLANS.find((p) => p.key === "pro")?.priceCents).toBe(19700);
    expect(BILLING_PLANS.find((p) => p.key === "agency")?.priceCents).toBe(39700);
    expect(BILLING_PLANS.find((p) => p.key === "enterprise")?.priceCents).toBe(69000);
  });

  test("list prices: flat everywhere, annual = monthly x10", () => {
    expect(listPriceCents("pro")).toBe(19700);
    expect(listPriceCents("pro", "IT")).toBe(19700);
    expect(listPriceCents("pro", "IT", "annual")).toBe(197000);
    expect(listPriceCents("enterprise")).toBe(69000);
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

  test("accepts any valid v1 during secret rotation; rejects malformed headers", async () => {
    const payload = '{"id":"evt_2"}';
    const now = Math.floor(Date.now() / 1000);
    const good = await sign(payload, "whsec_new", now); // t=..,v1=<good>
    const oldSecretSig = (await sign(payload, "whsec_old", now)).split(",")[1];

    // valid signature listed FIRST, a stale-secret one after it
    expect(await verifyStripeSignature(payload, `${good},${oldSecretSig}`, "whsec_new")).toBe(true);
    // ...and listed LAST
    const [t, goodV1] = good.split(",");
    expect(await verifyStripeSignature(payload, `${t},${oldSecretSig},${goodV1}`, "whsec_new")).toBe(true);

    expect(await verifyStripeSignature(payload, "garbage", "whsec_new")).toBe(false);
    expect(await verifyStripeSignature(payload, `${t},v1=deadbeef`, "whsec_new")).toBe(false);
    expect(await verifyStripeSignature(payload, `v1=${goodV1.slice(3)}`, "whsec_new")).toBe(false); // no t=
    expect(await verifyStripeSignature(payload, "x".repeat(2000), "whsec_new")).toBe(false);
    expect(await verifyStripeSignature(payload, good, "")).toBe(false);
  });
});

describe("billing.getBillingState + webhook", () => {
  test("getBillingState reports plan, regional price and dormant checkout", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.checkoutAvailable).toBe(false);
    expect(s?.region).toBe("IT");
    // v2 prices are flat everywhere — no regional override.
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(19700);
  });

  test("price is flat regardless of tenant country (no v1 regional override)", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "base" });
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { country: "NL" });
    });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.region).toBe("NL");
    expect(s?.plans.find((p) => p.key === "pro")?.priceCents).toBe(19700);
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

  // test("trialSweep flips abandoned pre-Stripe trials to past_due, skips active subs", async () => {
  //   const t = newDb();
  //   const abandoned = await seedTenant(t);
  //   const active = await seedTenant(t);
  //   await t.run(async (ctx) => {
  //     await ctx.db.patch(abandoned.tenantId, {
  //       planStatus: "trialing",
  //       trialEndsAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  //     });
  //     await ctx.db.patch(active.tenantId, {
  //       planStatus: "trialing",
  //       stripeSubscriptionId: "sub_live",
  //       trialEndsAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
  //     });
  //   });
  //
  //   const res = await t.mutation(internal.billing.trialSweep, {});
  //   expect(res.swept).toBe(1);
  //
  //   const after = await t.run(async (ctx) => ({
  //     abandoned: await ctx.db.get(abandoned.tenantId),
  //     active: await ctx.db.get(active.tenantId),
  //   }));
  //   expect(after.abandoned?.planStatus).toBe("past_due");
  //   expect(after.active?.planStatus).toBe("trialing");
  // });
  // TODO: Fix scheduler mock in convex-test to avoid "Write outside of transaction" error

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

describe("appOrigin (checkout return-URL allowlist)", () => {
  test("honours only allowlisted origins; anything else falls back to SITE_URL", () => {
    process.env.SITE_URL = "https://app.example.com/";
    process.env.ALLOWED_APP_ORIGINS = "https://www.example.com, https://example.com/";
    expect(appOrigin(undefined)).toBe("https://app.example.com");
    expect(appOrigin("https://app.example.com")).toBe("https://app.example.com");
    expect(appOrigin("https://www.example.com/")).toBe("https://www.example.com");
    expect(appOrigin("https://example.com")).toBe("https://example.com");
    expect(appOrigin("https://evil.com")).toBe("https://app.example.com");
    expect(appOrigin("https://app.example.com.evil.com")).toBe("https://app.example.com");
    expect(appOrigin("javascript:alert(1)")).toBe("https://app.example.com");
    delete process.env.ALLOWED_APP_ORIGINS;
    expect(appOrigin("https://www.example.com")).toBe("https://app.example.com");
  });
});
