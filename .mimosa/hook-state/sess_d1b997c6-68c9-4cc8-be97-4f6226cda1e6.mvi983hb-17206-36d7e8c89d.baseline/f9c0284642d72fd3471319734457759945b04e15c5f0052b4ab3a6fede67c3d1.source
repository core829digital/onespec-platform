import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * A customer whose plan ended comes back and pays again. Covers every way the
 * stored Stripe state can be out of date (deleted customer, test-mode ids kept
 * after going live, a lost webhook, an option Stripe refuses) and the events of
 * the OLD subscription that keep arriving after the new one is live.
 */
const ENV = {
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_PRICE_BASE_MONTHLY: "price_base_m",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
  SITE_URL: "https://platform.example",
} as const;

type Call = { method: string; path: string; body: URLSearchParams };
let calls: Call[] = [];
/** Per-test Stripe behaviour: return a Response, or undefined for the default. */
let route: (c: Call) => Response | undefined = () => undefined;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const notFound = (msg: string, param = "id") => json(404, { error: { type: "invalid_request_error", code: "resource_missing", param, message: msg } });

beforeEach(() => {
  vi.useFakeTimers();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  calls = [];
  route = () => undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const c: Call = { method: init?.method ?? "GET", path: url.replace("https://api.stripe.com/v1", ""), body: new URLSearchParams(init?.body ?? "") };
      calls.push(c);
      const custom = route(c);
      if (custom) return custom;
      if (c.path.startsWith("/checkout/sessions")) return json(200, { id: "cs_1", url: "https://checkout.stripe.test/s" });
      if (c.path.startsWith("/customers/")) return json(200, { id: c.path.split("/")[2], object: "customer", balance: 0 });
      if (c.path.startsWith("/subscriptions/search")) return json(200, { data: [] });
      if (c.path.startsWith("/subscriptions/")) return json(200, { id: c.path.split("/")[2], status: "canceled", customer: "cus_old", metadata: {} });
      return json(200, {});
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** A tenant whose subscription ended (the state the webhook leaves after "deleted"). */
async function returning(extra: Record<string, unknown> = {}) {
  const t = newDb();
  const s = await seedTenant(t, { plan: "base" });
  await t.run((ctx) =>
    ctx.db.patch(s.tenantId, {
      planStatus: "suspended",
      stripeCustomerId: "cus_old",
      stripeSubscriptionId: "sub_old",
      trialStartedAt: Date.now() - 90 * 86_400_000,
      country: "IT",
      ...extra,
    } as never),
  );
  return { t, s, as: t.withIdentity({ subject: s.ownerId }) };
}
const sessionCalls = () => calls.filter((c) => c.method === "POST" && c.path === "/checkout/sessions");
const tenantOf = (t: ReturnType<typeof newDb>, id: unknown) => t.run((ctx) => ctx.db.get(id as never)) as Promise<Record<string, unknown>>;

describe("checkout for a returning customer", () => {
  test("re-uses the existing Stripe customer and lets Stripe update name/address", async () => {
    const { s, as } = await returning();
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
    const body = sessionCalls()[0].body;
    expect(body.get("customer")).toBe("cus_old");
    expect(body.has("customer_email")).toBe(false);
    expect(body.get("customer_update[name]")).toBe("auto");
    expect(body.get("customer_update[address]")).toBe("auto");
    // The one-time Pro trial is never offered twice.
    expect(body.has("subscription_data[trial_period_days]")).toBe(false);
  });

  test("a customer deleted on Stripe: fresh customer, dead id unlinked", async () => {
    const { t, s, as } = await returning();
    route = (c) => (c.path === "/customers/cus_old" ? json(200, { id: "cus_old", object: "customer", deleted: true }) : undefined);
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    const body = sessionCalls()[0].body;
    expect(body.has("customer")).toBe(false);
    expect(body.get("customer_email")).toContain("@example.com");
    expect(body.has("customer_update[name]")).toBe(false);
    const tenant = await tenantOf(t, s.tenantId);
    expect(tenant.stripeCustomerId).toBeUndefined();
    expect(tenant.stripeSubscriptionId).toBeUndefined();
  });

  test("a test-mode customer id kept after going live: fresh customer", async () => {
    const { t, s, as } = await returning();
    route = (c) =>
      c.path === "/customers/cus_old"
        ? notFound("No such customer: 'cus_old'; a similar object exists in test mode, but a live mode key was used to make this request.")
        : undefined;
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(sessionCalls()[0].body.has("customer")).toBe(false);
    expect((await tenantOf(t, s.tenantId)).stripeCustomerId).toBeUndefined();
  });

  test("Stripe refuses an optional option: retried without the extras, sale not lost", async () => {
    const { s, as } = await returning();
    let n = 0;
    route = (c) => {
      if (c.method === "POST" && c.path === "/checkout/sessions" && n++ === 0) {
        return json(400, { error: { type: "invalid_request_error", param: "name_collection[business][enabled]", message: "Not supported for this customer." } });
      }
      return undefined;
    };
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
    const [first, second] = sessionCalls();
    expect(first.body.has("name_collection[business][enabled]")).toBe(true);
    expect(second.body.has("name_collection[business][enabled]")).toBe(false);
    expect(second.body.has("tax_id_collection[enabled]")).toBe(false);
    // What the payment needs is always kept.
    expect(second.body.get("line_items[0][price]")).toBe("price_base_m");
    expect(second.body.get("customer")).toBe("cus_old");
    expect(second.body.get("automatic_tax[enabled]")).toBe("true");
    expect(second.body.get("customer_update[address]")).toBe("auto");
    expect(second.body.get("metadata[tenantId]")).toBe(String(s.tenantId));
  });

  test("the customer vanishes between the check and the session: retried with a fresh customer", async () => {
    const { s, as } = await returning();
    let n = 0;
    route = (c) =>
      c.method === "POST" && c.path === "/checkout/sessions" && n++ === 0 ? notFound("No such customer: 'cus_old'", "customer") : undefined;
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    const second = sessionCalls()[1].body;
    expect(second.has("customer")).toBe(false);
    expect(second.get("customer_email")).toContain("@example.com");
  });

  test("a refusal that survives the retry is a clear, coded error (never a bare Server Error)", async () => {
    const { s, as } = await returning();
    route = (c) =>
      c.method === "POST" && c.path === "/checkout/sessions" ? json(400, { error: { type: "invalid_request_error", message: "Something else" } }) : undefined;
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/BILLING_CHECKOUT_FAILED/);
    expect(sessionCalls()).toHaveLength(2);
  });

  test("Stripe down or unreachable: coded 'try again' error", async () => {
    const { s, as } = await returning();
    route = (c) => (c.method === "POST" && c.path === "/checkout/sessions" ? json(503, { error: { message: "busy" } }) : undefined);
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/BILLING_PROVIDER_UNAVAILABLE/);
    route = (c) => {
      if (c.path.startsWith("/customers/")) throw new TypeError("fetch failed");
      return undefined;
    };
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/BILLING_PROVIDER_UNAVAILABLE/);
  });

  test("local status still 'active' but the subscription ended on Stripe (lost webhook): checkout allowed", async () => {
    const { t, s, as } = await returning({ planStatus: "active" });
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "pro" });
    expect(url).toContain("checkout.stripe.test");
    expect((await tenantOf(t, s.tenantId)).planStatus).toBe("suspended");
  });

  test("a subscription that is really live on Stripe still blocks a second checkout (no double billing)", async () => {
    const { s, as } = await returning({ planStatus: "active" });
    route = (c) => (c.path === "/subscriptions/sub_old" ? json(200, { id: "sub_old", status: "active", customer: "cus_old" }) : undefined);
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "pro" })).rejects.toThrow(/ALREADY_SUBSCRIBED/);
    expect(sessionCalls()).toHaveLength(0);
  });
});

describe("after the returning customer pays", () => {
  const sub = (id: string, status: string, customer: string, tenantId: string, created: number) => ({
    id,
    status,
    customer,
    created,
    metadata: { tenantId, plan: "base", cycle: "monthly" },
    items: { data: [{ price: { id: "price_base_m" }, current_period_end: 2_000_000_000 }] },
  });

  test("the OLD subscription's late 'deleted' event never suspends the NEW live plan", async () => {
    const { t, s } = await returning();
    const tid = String(s.tenantId);
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_new",
      type: "customer.subscription.created",
      created: 1000,
      data: { object: sub("sub_new", "active", "cus_old", tid, 1000) },
    });
    let tenant = await tenantOf(t, s.tenantId);
    expect(tenant.planStatus).toBe("active");
    expect(tenant.stripeSubscriptionId).toBe("sub_new");
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_old_deleted",
      type: "customer.subscription.deleted",
      created: 1001,
      data: { object: sub("sub_old", "canceled", "cus_old", tid, 10) },
    });
    tenant = await tenantOf(t, s.tenantId);
    expect(tenant.planStatus).toBe("active");
    expect(tenant.stripeSubscriptionId).toBe("sub_new");
  });

  test("the current subscription's own 'deleted' event still ends access", async () => {
    const { t, s } = await returning({ planStatus: "active", stripeSubscriptionId: "sub_new" });
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_del",
      type: "customer.subscription.deleted",
      created: 2000,
      data: { object: sub("sub_new", "canceled", "cus_old", String(s.tenantId), 1000) },
    });
    expect((await tenantOf(t, s.tenantId)).planStatus).toBe("suspended");
  });

  test("checkout completed on a NEW customer (old one was dead): tenant re-linked and activated", async () => {
    const { t, s } = await returning();
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_cs",
      type: "checkout.session.completed",
      created: 3000,
      data: { object: { customer: "cus_new", subscription: "sub_new", client_reference_id: String(s.tenantId), metadata: { tenantId: String(s.tenantId), plan: "base", cycle: "monthly" } } },
    });
    const tenant = await tenantOf(t, s.tenantId);
    expect(tenant.stripeCustomerId).toBe("cus_new");
    expect(tenant.stripeSubscriptionId).toBe("sub_new");
    expect(tenant.planStatus).toBe("active");
  });

  test("a stray checkout for another customer cannot hijack a tenant that is paying", async () => {
    const { t, s } = await returning({ planStatus: "active", stripeSubscriptionId: "sub_live" });
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_stray",
      type: "checkout.session.completed",
      created: 3000,
      data: { object: { customer: "cus_other", subscription: "sub_x", client_reference_id: String(s.tenantId), metadata: { tenantId: String(s.tenantId), plan: "pro" } } },
    });
    const tenant = await tenantOf(t, s.tenantId);
    expect(tenant.stripeCustomerId).toBe("cus_old");
    expect(tenant.stripeSubscriptionId).toBe("sub_live");
  });

  test("sync right after paying finds the NEW live subscription, not the old ended one", async () => {
    const { t, s, as } = await returning();
    const tid = String(s.tenantId);
    route = (c) =>
      c.path.startsWith("/subscriptions/search")
        ? json(200, { data: [sub("sub_old", "canceled", "cus_old", tid, 10), sub("sub_new", "active", "cus_new", tid, 5000)] })
        : undefined;
    const r = await as.action(api.billing.syncSubscription, { tenantId: s.tenantId });
    expect(r).toMatchObject({ found: true, planStatus: "active", plan: "base" });
    const tenant = await tenantOf(t, s.tenantId);
    expect(tenant.stripeSubscriptionId).toBe("sub_new");
    expect(tenant.stripeCustomerId).toBe("cus_new");
  });

  test("portal with a customer that no longer exists: unlinked, coded error", async () => {
    const { t, s, as } = await returning();
    route = (c) => (c.path === "/billing_portal/sessions" ? notFound("No such customer: 'cus_old'", "customer") : undefined);
    await expect(as.action(api.billing.createPortalSession, { tenantId: s.tenantId })).rejects.toThrow(/NO_SUBSCRIPTION/);
    expect((await tenantOf(t, s.tenantId)).stripeCustomerId).toBeUndefined();
  });
});

describe("two checkouts from two tabs or devices (issue #36)", () => {
  test("a new checkout expires the session opened before, so only one can ever be paid", async () => {
    const { t, s, as } = await returning();
    let n = 0;
    route = (c) => {
      if (c.method === "POST" && c.path === "/checkout/sessions") return json(200, { id: `cs_${++n}`, url: "https://checkout.stripe.test/s" });
      if (c.method === "GET" && c.path === "/checkout/sessions/cs_1") return json(200, { id: "cs_1", status: "open" });
      return undefined;
    };
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect((await tenantOf(t, s.tenantId)).stripeCheckoutSessionId).toBe("cs_1");
    await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(calls.some((c) => c.method === "POST" && c.path === "/checkout/sessions/cs_1/expire")).toBe(true);
    const tenant = await tenantOf(t, s.tenantId);
    expect(tenant.stripeCheckoutSessionId).toBe("cs_2");
    expect(tenant.stripeCheckoutClaimedAt).toBeUndefined();
  });

  test("the earlier session was already paid and its subscription is live: no second checkout", async () => {
    const { t, s, as } = await returning();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { stripeCheckoutSessionId: "cs_paid" } as never));
    route = (c) => {
      if (c.path === "/checkout/sessions/cs_paid") return json(200, { id: "cs_paid", status: "complete", subscription: "sub_a" });
      if (c.path === "/subscriptions/sub_a") return json(200, { id: "sub_a", status: "active" });
      return undefined;
    };
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/ALREADY_SUBSCRIBED/);
    expect(sessionCalls()).toHaveLength(0);
    expect((await tenantOf(t, s.tenantId)).stripeCheckoutClaimedAt).toBeUndefined(); // the refusal frees the claim
  });

  test("an old paid session whose subscription has since ended does not lock a returning customer out", async () => {
    const { t, s, as } = await returning();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { stripeCheckoutSessionId: "cs_old" } as never));
    route = (c) => (c.path === "/checkout/sessions/cs_old" ? json(200, { id: "cs_old", status: "complete", subscription: "sub_old" }) : undefined);
    const { url } = await as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" });
    expect(url).toContain("checkout.stripe.test");
  });

  test("a checkout already being opened elsewhere refuses the second request instead of opening two", async () => {
    const { t, s, as } = await returning();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { stripeCheckoutClaimedAt: Date.now() } as never));
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).rejects.toThrow(/CHECKOUT_IN_PROGRESS/);
    expect(sessionCalls()).toHaveLength(0);
    vi.advanceTimersByTime(61_000); // a claim left by a crashed request expires on its own
    await expect(as.action(api.billing.createCheckoutSession, { tenantId: s.tenantId, plan: "base" })).resolves.toBeDefined();
  });

  test("a second paid checkout while another subscription is live alerts an operator instead of silently replacing it", async () => {
    const { t, s } = await returning({ planStatus: "active", stripeSubscriptionId: "sub_a" });
    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_b",
      type: "checkout.session.completed",
      created: 2000,
      data: { object: { id: "cs_b", customer: "cus_old", subscription: "sub_b", client_reference_id: String(s.tenantId), metadata: {} } },
    });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.some((f) => f.name.includes("ops") && JSON.stringify(f.args).includes("sub_a"))).toBe(true);
    expect((await tenantOf(t, s.tenantId)).stripeSubscriptionId).toBe("sub_b");
  });
});
