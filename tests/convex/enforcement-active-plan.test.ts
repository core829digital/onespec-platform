import { afterEach, describe, expect, test } from "vitest";
import { enforceActivePlan } from "../../convex/lib/enforcement";
import { newDb, seedTenant } from "./_helpers";

const ORIGINAL_STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
afterEach(() => {
  if (ORIGINAL_STRIPE_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_KEY;
});

/**
 * registerTenant creates every new signup with planStatus:"trialing" and no
 * Stripe subscription at all — that's fine while Stripe is dormant (today),
 * but once real billing is live a self-registered tenant that never went
 * through checkout must not get to sit in "trialing" (= full Base access)
 * forever. This is the exact "free plan via signup" loophole to close.
 */
describe("enforceActivePlan — no free-forever trial once Stripe is live", () => {
  test("dormant Stripe (no STRIPE_SECRET_KEY): trialing with no subscription is allowed", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const t = newDb();
    const { tenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "trialing" }));

    await t.run((ctx) => enforceActivePlan(ctx, tenantId));
  });

  test("live Stripe: trialing with no stripeSubscriptionId is rejected", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const t = newDb();
    const { tenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "trialing" }));

    await expect(t.run((ctx) => enforceActivePlan(ctx, tenantId))).rejects.toThrow(/SUBSCRIPTION_REQUIRED/);
  });

  test("live Stripe: trialing WITH a real stripeSubscriptionId is allowed", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const t = newDb();
    const { tenantId } = await seedTenant(t, { plan: "pro" });
    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "trialing", stripeSubscriptionId: "sub_123" }));

    await t.run((ctx) => enforceActivePlan(ctx, tenantId));
  });

  test("live Stripe: active/suspended/past_due are unaffected by the new check", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const t = newDb();
    const { tenantId } = await seedTenant(t, { plan: "pro" });

    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "active" }));
    await t.run((ctx) => enforceActivePlan(ctx, tenantId));

    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "suspended" }));
    await expect(t.run((ctx) => enforceActivePlan(ctx, tenantId))).rejects.toThrow(/PLAN_SUSPENDED/);

    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "past_due" }));
    await expect(t.run((ctx) => enforceActivePlan(ctx, tenantId))).rejects.toThrow(/PLAN_PAST_DUE/);
  });
});
