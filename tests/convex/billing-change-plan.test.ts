import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * changePlan / previewPlanChange against a stubbed Stripe: asserts the exact
 * requests the platform sends for upgrade, downgrade and cycle changes, and
 * the guards around them.
 */
const ENV = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_PRICE_BASE_MONTHLY: "price_base_m",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
  STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
  STRIPE_PRICE_AGENCY_MONTHLY: "price_agency_m",
  STRIPE_PRICE_ESSENTIALS_MONTHLY: "price_l1_m",
} as const;
const saved: Record<string, string | undefined> = {};
let posts: Array<{ url: string; body: URLSearchParams }> = [];

beforeEach(() => {
  vi.useFakeTimers();
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push({ url, body: new URLSearchParams(init.body ?? "") });
        return new Response(JSON.stringify({ id: "sub_1", total: 1000, amount_due: 1000, url: "https://checkout.stripe.test/s" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "sub_1", items: { data: [{ id: "si_1" }] } }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const k of Object.keys(ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function subscribed(plan: "base" | "pro" | "agency" | "essentials", planStatus = "active") {
  const t = newDb();
  const s = await seedTenant(t, { plan });
  await t.run((ctx) =>
    ctx.db.patch(s.tenantId, {
      planStatus: planStatus as "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      country: "IT",
    }),
  );
  return { t, s, as: t.withIdentity({ subject: s.ownerId }) };
}

describe("changePlan", () => {
  test("upgrade Base → Pro swaps the price item, prorates, and lifts a pending cancellation", async () => {
    const { s, as } = await subscribed("base");
    await as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "pro" });
    const call = posts.find((p) => p.url.endsWith("/subscriptions/sub_1"))!;
    expect(call.body.get("items[0][id]")).toBe("si_1");
    expect(call.body.get("items[0][price]")).toBe("price_pro_m");
    expect(call.body.get("proration_behavior")).toBe("always_invoice");
    expect(call.body.get("cancel_at_period_end")).toBe("false");
    expect(call.body.get("metadata[plan]")).toBe("pro");
    expect(call.body.has("trial_end")).toBe(false);
  });

  test("downgrade Agency → Base uses the same proration path (credit lands on the balance)", async () => {
    const { s, as } = await subscribed("agency");
    await as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "base" });
    const call = posts.find((p) => p.url.endsWith("/subscriptions/sub_1"))!;
    expect(call.body.get("items[0][price]")).toBe("price_base_m");
    expect(call.body.get("proration_behavior")).toBe("always_invoice");
  });

  test("monthly → annual on the same plan switches to the annual price", async () => {
    const { s, as } = await subscribed("pro");
    await as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "pro", cycle: "annual" });
    const call = posts.find((p) => p.url.endsWith("/subscriptions/sub_1"))!;
    expect(call.body.get("items[0][price]")).toBe("price_pro_a");
    expect(call.body.get("metadata[cycle]")).toBe("annual");
  });

  test("switching during the trial ends the trial now (it is charged, never extended)", async () => {
    const { s, as } = await subscribed("pro", "trialing");
    await as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "agency" });
    const call = posts.find((p) => p.url.endsWith("/subscriptions/sub_1"))!;
    expect(call.body.get("trial_end")).toBe("now");
  });

  test("widget plan family: Pro → Level 1 is refused when the team is larger than its seats", async () => {
    const { s, as } = await subscribed("pro"); // seeded with owner + admin + member
    await expect(
      as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "essentials" }),
    ).rejects.toThrow(/TEAM_EXCEEDS_TARGET_PLAN/);
    expect(posts).toHaveLength(0);
  });

  test("annual is refused for monthly-only plans; nothing is sent to Stripe", async () => {
    const { s, as } = await subscribed("pro");
    await expect(
      as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "agency", cycle: "annual" }),
    ).rejects.toThrow(/ANNUAL_NOT_AVAILABLE/);
    expect(posts).toHaveLength(0);
  });

  test("an ended (suspended) subscription cannot be 'changed' — it must go through Checkout", async () => {
    const { s, as } = await subscribed("pro", "suspended");
    await expect(as.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/NO_SUBSCRIPTION/);
    await expect(as.action(api.billing.previewPlanChange, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/NO_SUBSCRIPTION/);
    expect(posts).toHaveLength(0);
  });

  test("only the owner can change the plan", async () => {
    const { t, s } = await subscribed("base");
    const asAdmin = t.withIdentity({ subject: s.adminId });
    await expect(asAdmin.action(api.billing.changePlan, { tenantId: s.tenantId, plan: "pro" })).rejects.toThrow(/OWNER_ONLY/);
    expect(posts).toHaveLength(0);
  });
});

describe("createCheckoutSession", () => {
  test("an existing Stripe customer may be updated (name/address) — required by tax-ID collection", async () => {
    const { s, as } = await subscribed("pro", "suspended"); // ended subscription → re-subscribe
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
    const call = posts.find((p) => p.url.endsWith("/checkout/sessions"))!;
    expect(call.body.get("customer")).toBe("cus_1");
    expect(call.body.get("customer_update[name]")).toBe("auto");
    expect(call.body.get("customer_update[address]")).toBe("auto");
    expect(call.body.get("tax_id_collection[enabled]")).toBe("true");
  });

  test("a brand-new customer is identified by email and gets no customer_update", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "pending_plan", country: "IT" }));
    await t.withIdentity({ subject: s.ownerId }).action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    const call = posts.find((p) => p.url.endsWith("/checkout/sessions"))!;
    expect(call.body.has("customer")).toBe(false);
    expect(call.body.has("customer_update[name]")).toBe(false);
    expect(call.body.get("customer_email")).toBeTruthy();
  });
});
