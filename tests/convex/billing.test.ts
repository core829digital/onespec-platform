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
    expect(BILLING_PLANS.find((p) => p.key === "business")?.priceCents).toBe(4700);
    expect(BILLING_PLANS.find((p) => p.key === "enterprise")?.priceCents).toBeNull();
  });

  test("Alpha price is a derived 15% discount", () => {
    expect(alphaPriceCents(2400)).toBe(2040);
    expect(alphaPriceCents(4700)).toBe(3995);
    expect(effectivePriceCents("business", true)).toBe(3995);
    expect(effectivePriceCents("business", false)).toBe(4700);
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
    // Business plan uses the IT regional price (€89) with the 15% Alpha discount.
    expect(s?.region).toBe("IT");
    expect(s?.plans.find((p) => p.key === "business")?.priceCents).toBe(8900);
    expect(s?.plans.find((p) => p.key === "business")?.yourPriceCents).toBe(7565);
  });

  test("a region without a price override falls back to the base plan price", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "starter" });
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { country: "BE" });
    });
    const s = await t
      .withIdentity({ subject: ownerId })
      .query(api.billing.getBillingState, { tenantId });
    expect(s?.region).toBe("BE");
    // BE has no REGIONAL_PRICES entry yet → base Business price €47.
    expect(s?.plans.find((p) => p.key === "business")?.priceCents).toBe(4700);
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
    expect(s?.plans.find((p) => p.key === "business")?.priceCents).toBe(10400);
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
});
