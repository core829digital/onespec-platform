import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/** createCheckoutSession for an invited account, against a stubbed Stripe. */
let posts: Array<{ url: string; body: URLSearchParams }> = [];
let couponExists = false;
let failCoupons = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_PRICE_BASE_MONTHLY", "price_base_m");
  vi.stubEnv("SITE_URL", "https://platform.example");
  vi.stubEnv("REFERRALS_ENABLED", "1");
  posts = [];
  couponExists = false;
  failCoupons = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const ok = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });
      if (url.includes("/coupons")) {
        if (failCoupons) return new Response(JSON.stringify({ error: { message: "down" } }), { status: 500 });
        if (init?.method === "POST") {
          posts.push({ url, body: new URLSearchParams(init.body ?? "") });
          couponExists = true;
          return ok({ id: "onespec-ref-pct-10" });
        }
        return couponExists ? ok({ id: "onespec-ref-pct-10" }) : new Response(JSON.stringify({ error: { message: "No such coupon" } }), { status: 404 });
      }
      if (init?.method === "POST") {
        posts.push({ url, body: new URLSearchParams(init.body ?? "") });
        return ok({ url: "https://checkout.stripe.test/s" });
      }
      return ok({});
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function invited(status: "pending" | "qualified" = "pending") {
  const t = newDb();
  const ref = await seedTenant(t, { plan: "pro" });
  const s = await seedTenant(t, { plan: "base" });
  await t.run(async (ctx) => {
    await ctx.db.patch(s.tenantId, { planStatus: "pending_plan", country: "IT" });
    const referralId = await ctx.db.insert("referrals", {
      referrerTenantId: ref.tenantId,
      referredTenantId: s.tenantId,
      code: "OS-AAAAAA",
      status,
      createdAt: Date.now(),
    });
    await ctx.db.patch(s.tenantId, { referredBy: referralId });
  });
  return { t, s, as: t.withIdentity({ subject: s.ownerId }) };
}

const checkoutCall = () => posts.find((p) => p.url.endsWith("/checkout/sessions"))!;

describe("checkout for an invited account", () => {
  test("gets the one-off 10% discount and no promotion-code box", async () => {
    const { s, as } = await invited();
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
    expect(checkoutCall().body.get("discounts[0][coupon]")).toBe("onespec-ref-pct-10");
    expect(checkoutCall().body.has("allow_promotion_codes")).toBe(false);
    expect(posts.filter((p) => p.url.endsWith("/coupons"))).toHaveLength(1);
  });

  test("a second checkout reuses the coupon", async () => {
    const { s, as } = await invited();
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(posts.filter((p) => p.url.endsWith("/coupons"))).toHaveLength(1);
  });

  test("Stripe coupon trouble never breaks the checkout: normal session, promotion codes allowed", async () => {
    failCoupons = true;
    const { s, as } = await invited();
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
    expect(checkoutCall().body.has("discounts[0][coupon]")).toBe(false);
    expect(checkoutCall().body.get("allow_promotion_codes")).toBe("true");
  });

  test("an account that already paid once (qualified) gets no discount", async () => {
    const { s, as } = await invited("qualified");
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(checkoutCall().body.has("discounts[0][coupon]")).toBe(false);
    expect(checkoutCall().body.get("allow_promotion_codes")).toBe("true");
  });

  test("system switched off: untouched checkout", async () => {
    vi.stubEnv("REFERRALS_ENABLED", "0");
    const { s, as } = await invited();
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(checkoutCall().body.has("discounts[0][coupon]")).toBe(false);
    expect(checkoutCall().body.get("allow_promotion_codes")).toBe("true");
  });

  test("an account that was not invited is untouched", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "pending_plan", country: "IT" }));
    await t.withIdentity({ subject: s.ownerId }).action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(checkoutCall().body.has("discounts[0][coupon]")).toBe(false);
    expect(checkoutCall().body.get("allow_promotion_codes")).toBe("true");
    expect(posts.filter((p) => p.url.endsWith("/coupons"))).toHaveLength(0);
  });
});
