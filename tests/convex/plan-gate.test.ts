import { afterEach, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * "No plan, no platform": a freshly registered account (planStatus
 * pending_plan) must not be able to use the product until a real payment has
 * activated a plan. Free self-selection is a dev-only opt-in that fails closed.
 */
const KEYS = ["STRIPE_SECRET_KEY", "ONESPEC_ALLOW_FREE_ONBOARDING"] as const;
const ORIGINAL = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
});

async function freshTenant() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "base" });
  await t.run((ctx) =>
    ctx.db.patch(s.tenantId, { planStatus: "pending_plan", onboardingCompletedAt: undefined }),
  );
  return { t, s, as: t.withIdentity({ subject: s.ownerId }) };
}

describe("pending_plan tenant", () => {
  test("cannot create a configurator", async () => {
    const { s, as } = await freshTenant();
    await expect(
      as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Gratis?" }),
    ).rejects.toThrow("PLAN_SELECTION_REQUIRED");
  });

  test("is refused on every permission-checked operation, not just plan-enforced ones", async () => {
    const { t, s, as } = await freshTenant();
    await expect(
      as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "Cliente" }),
    ).rejects.toThrow("PLAN_SELECTION_REQUIRED");
    await expect(
      as.mutation(api.cantieri.createCantiere, {
        tenantId: s.tenantId, name: "C", address: "Via 1", city: "Roma", postalCode: "00100",
      } as never),
    ).rejects.toThrow("PLAN_SELECTION_REQUIRED");
    // Once a payment activates the plan, the same call is allowed.
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "active", stripeSubscriptionId: "sub_test" }));
    await expect(
      as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "Cliente" }),
    ).resolves.toBeTruthy();
  });

  test("cannot finish onboarding, even after forging the post-checkout step", async () => {
    const { as } = await freshTenant();
    // The client moves to "team" when it sees ?status=success — a visitor can type that URL.
    await as.mutation(api.onboarding.advance, { step: "team" });
    await expect(as.mutation(api.onboarding.complete, {})).rejects.toThrow("PLAN_SELECTION_REQUIRED");
  });

  test("can finish onboarding once a payment has activated the plan", async () => {
    const { t, s, as } = await freshTenant();
    await t.run((ctx) =>
      ctx.db.patch(s.tenantId, { plan: "essentials", planStatus: "active", stripeSubscriptionId: "sub_test" }),
    );
    await as.mutation(api.onboarding.complete, {});
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant?.onboardingCompletedAt).toBeTruthy();
  });
});

describe("free plan selection fails closed", () => {
  test("refused when no opt-in flag is set (production default), with or without a Stripe key", async () => {
    const { t, s, as } = await freshTenant();
    delete process.env.ONESPEC_ALLOW_FREE_ONBOARDING;
    delete process.env.STRIPE_SECRET_KEY; // a missing/mistyped key must NOT open the door
    await expect(as.mutation(api.onboarding.selectPlan, { plan: "max" })).rejects.toThrow("BILLING_LIVE_USE_CHECKOUT");
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    await expect(as.mutation(api.onboarding.selectPlan, { plan: "max" })).rejects.toThrow("BILLING_LIVE_USE_CHECKOUT");
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant?.planStatus).toBe("pending_plan");
  });

  test("refused when a Stripe key is set even if the dev flag is left on", async () => {
    const { as } = await freshTenant();
    process.env.ONESPEC_ALLOW_FREE_ONBOARDING = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    await expect(as.mutation(api.onboarding.selectPlan, { plan: "pro" })).rejects.toThrow("BILLING_LIVE_USE_CHECKOUT");
  });

  test("only the explicit dev opt-in (no Stripe key) allows it", async () => {
    const { t, s, as } = await freshTenant();
    process.env.ONESPEC_ALLOW_FREE_ONBOARDING = "1";
    delete process.env.STRIPE_SECRET_KEY;
    await as.mutation(api.onboarding.selectPlan, { plan: "base" });
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant?.planStatus).toBe("active");
  });

  test("a 'trialing' tenant with no Stripe subscription is blocked unless the dev opt-in is on", async () => {
    const { t, s, as } = await freshTenant();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "trialing", stripeSubscriptionId: undefined }));
    delete process.env.ONESPEC_ALLOW_FREE_ONBOARDING;
    delete process.env.STRIPE_SECRET_KEY;
    await expect(
      as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Prova" }),
    ).rejects.toThrow("SUBSCRIPTION_REQUIRED");
  });
});
