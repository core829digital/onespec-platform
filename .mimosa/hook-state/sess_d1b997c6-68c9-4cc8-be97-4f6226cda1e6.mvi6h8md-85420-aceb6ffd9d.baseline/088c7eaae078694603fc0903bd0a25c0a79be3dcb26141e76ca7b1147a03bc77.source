import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { sellablePlanCycles, WEBHOOK_EVENTS } from "../../convex/lib/billingHealth";
import { listPriceCents } from "../../convex/lib/billingPlans";
import { newDb, seedTenant } from "./_helpers";

/**
 * "Controllo pagamenti": admin-only, read-only towards Stripe, never returns a secret, and turns a wrong
 * configuration (missing price, wrong amount, webhook not registered, Stripe Tax off…) into a red/amber row.
 */
const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz012345";
const SECRETS = {
  STRIPE_SECRET_KEY: "sk_live_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_SUPERSECRETVALUE",
  STRIPE_WEBHOOK_PATH_TOKEN: TOKEN,
  SUPPORT_SIGNING_SECRET: "s".repeat(64),
  MFA_ENCRYPTION_KEY: "m".repeat(64),
  DAILY_IP_SALT: "saltsaltsaltsalt",
  AUTH_RESEND_KEY: "re_SUPERSECRETVALUE",
};
const ENV: Record<string, string> = {
  ...SECRETS,
  SITE_URL: "https://app.onespec.eu",
  CONVEX_SITE_URL: "https://happy-otter-1.convex.site",
  RESEND_MODE: "live",
  TURNSTILE_SECRET: "0x4AAA",
  OPS_ALERT_EMAIL: "ops@onespec.eu",
};
// One Price per sellable plan/cycle, priced exactly like the catalogue.
const PRICES: Record<string, { plan: string; cycle: string }> = {};
for (const { plan, cycle } of sellablePlanCycles()) {
  const id = `price_${plan}_${cycle}`;
  ENV[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`] = id;
  PRICES[id] = { plan, cycle };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
let paths: Array<{ method: string; path: string }> = [];
let override: (path: string) => Response | undefined = () => undefined;
let resendDomains: () => Response = () => json(200, { data: [{ name: "onespec.eu", status: "verified" }] });

function stripeDefault(path: string): Response {
  if (path === "/account")
    return json(200, { charges_enabled: true, payouts_enabled: true, country: "RO", business_profile: { name: "CORE829 SRL" }, requirements: { currently_due: [] } });
  if (path.startsWith("/prices/")) {
    const id = decodeURIComponent(path.slice("/prices/".length));
    const p = PRICES[id];
    if (!p) return json(404, { error: { message: "No such price" } });
    return json(200, {
      id,
      active: true,
      livemode: true,
      currency: "eur",
      unit_amount: listPriceCents(p.plan, null, p.cycle as "monthly" | "annual"),
      tax_behavior: "exclusive",
      recurring: { interval: p.cycle === "annual" ? "year" : "month", interval_count: 1 },
    });
  }
  if (path.startsWith("/webhook_endpoints"))
    return json(200, { data: [{ url: `https://happy-otter-1.convex.site/ev/${TOKEN}`, status: "enabled", enabled_events: [...WEBHOOK_EVENTS] }] });
  if (path === "/tax/settings") return json(200, { status: "active", head_office: { address: { country: "RO" } } });
  if (path.startsWith("/tax/registrations")) return json(200, { data: [{ country: "RO" }] });
  if (path.startsWith("/billing_portal/configurations"))
    return json(200, { data: [{ features: { subscription_update: { enabled: false }, invoice_history: { enabled: true } } }] });
  return json(404, {});
}

beforeEach(() => {
  for (const [k, val] of Object.entries(ENV)) vi.stubEnv(k, val);
  paths = [];
  override = () => undefined;
  resendDomains = () => json(200, { data: [{ name: "onespec.eu", status: "verified" }] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.startsWith("https://api.resend.com")) {
        paths.push({ method: init?.method ?? "GET", path: url });
        return url === "https://api.resend.com/domains" ? resendDomains() : json(404, {});
      }
      const path = url.replace("https://api.stripe.com/v1", "");
      paths.push({ method: init?.method ?? "GET", path });
      return override(path) ?? stripeDefault(path);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function world(admin = true) {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  if (admin) await t.run((ctx) => ctx.db.patch(s.ownerId, { isPlatformAdmin: true }));
  return t.withIdentity({ subject: s.ownerId });
}
const items = (r: { sections: Array<{ key: string; items: Array<{ id: string; check: string; status: string; params: Record<string, string> }> }> }, key?: string) =>
  r.sections.filter((s) => !key || s.key === key).flatMap((s) => s.items);

describe("Controllo pagamenti", () => {
  test("refuses anyone who is not a platform admin", async () => {
    const as = await world(false);
    await expect(as.action(api.billingHealth.check, {})).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
    expect(paths).toHaveLength(0);
  });

  test("a complete live setup is all green, with one Stripe check per sellable plan and cycle", async () => {
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(r.mode).toBe("live");
    expect(r.overall).toBe("ok");
    const prices = items(r, "prices");
    expect(prices.filter((i) => i.check === "priceOk")).toHaveLength(sellablePlanCycles().length);
    expect(items(r).filter((i) => i.status === "error" || i.status === "warn")).toEqual([]);
  });

  test("only reads from Stripe and never returns a secret value", async () => {
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(paths.every((p) => p.method === "GET")).toBe(true);
    const out = JSON.stringify(r);
    for (const secret of Object.values(SECRETS)) expect(out).not.toContain(secret);
    expect(out).not.toContain(TOKEN);
  });

  test("missing secret key: says so and does not call Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(r.mode).toBe("missing");
    expect(r.overall).toBe("error");
    expect(items(r, "keys").find((i) => i.check === "secretKeyMissing")?.status).toBe("error");
    expect(paths.filter((p) => !p.path.startsWith("https://api.resend.com"))).toHaveLength(0);
  });

  test("a test-mode key is amber and test Prices are flagged against a live key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(r.mode).toBe("test");
    expect(items(r, "keys").find((i) => i.id === "secretKey")?.check).toBe("secretKeyTest");
    expect(items(r, "prices").some((i) => i.check === "priceWrongMode")).toBe(true);
  });

  test("a missing Price env var is red and names the variable to add", async () => {
    vi.stubEnv("STRIPE_PRICE_ESSENTIALS_MONTHLY", "");
    const r = await (await world()).action(api.billingHealth.check, {});
    const row = items(r, "prices").find((i) => i.check === "priceMissing");
    expect(row?.status).toBe("error");
    expect(row?.params.envName).toBe("STRIPE_PRICE_ESSENTIALS_MONTHLY");
    expect(r.overall).toBe("error");
  });

  test("a monthly Price charging a different amount than the price page is red", async () => {
    override = (p) => (p === "/prices/price_pro_monthly" ? json(200, { active: true, livemode: true, currency: "eur", unit_amount: 9900, tax_behavior: "exclusive", recurring: { interval: "month" } }) : undefined);
    const r = await (await world()).action(api.billingHealth.check, {});
    const row = items(r, "prices").find((i) => i.check === "priceAmountMismatch");
    expect(row).toMatchObject({ status: "error", params: { charged: "99,00", shown: "197,00" } });
  });

  test("a Price id that does not exist in Stripe is red", async () => {
    vi.stubEnv("STRIPE_PRICE_BASE_MONTHLY", "price_typo");
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "prices").find((i) => i.check === "priceNotFound")?.status).toBe("error");
  });

  test("webhook not registered, or missing events, is red", async () => {
    override = (p) => (p.startsWith("/webhook_endpoints") ? json(200, { data: [{ url: "https://elsewhere.example/hook", status: "enabled", enabled_events: ["*"] }] }) : undefined);
    let r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "webhook").find((i) => i.check === "webhookNotRegistered")?.status).toBe("error");

    override = (p) =>
      p.startsWith("/webhook_endpoints")
        ? json(200, { data: [{ url: `https://happy-otter-1.convex.site/ev/${TOKEN}`, status: "enabled", enabled_events: ["checkout.session.completed"] }] })
        : undefined;
    r = await (await world()).action(api.billingHealth.check, {});
    const row = items(r, "webhook").find((i) => i.check === "webhookMissingEvents");
    expect(row?.status).toBe("error");
    expect(row?.params.events).toContain("customer.subscription.deleted");
  });

  test("Stripe Tax not active is red (checkout asks Stripe to compute VAT)", async () => {
    override = (p) => (p === "/tax/settings" ? json(200, { status: "pending" }) : undefined);
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "tax").find((i) => i.check === "taxPending")?.status).toBe("error");
  });

  test("account that cannot charge yet is red; plan switch left on in the portal is amber", async () => {
    override = (p) =>
      p === "/account"
        ? json(200, { charges_enabled: false, payouts_enabled: false, requirements: { currently_due: ["individual.id_number"] } })
        : p.startsWith("/billing_portal")
          ? json(200, { data: [{ features: { subscription_update: { enabled: true } } }] })
          : undefined;
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "account").find((i) => i.check === "chargesDisabled")?.status).toBe("error");
    expect(items(r, "account").find((i) => i.check === "requirementsDue")?.params.count).toBe("1");
    expect(items(r, "portal").find((i) => i.check === "portalPlanSwitchOn")?.status).toBe("warn");
  });

  test("a network failure towards Stripe becomes a red row, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNRESET");
    }));
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "account")[0]).toMatchObject({ check: "stripeUnreachable", status: "error" });
    expect(r.sections.map((sec) => sec.key)).toEqual(["keys", "account", "email", "secrets"]);
  });

  test("a key Stripe rejects is reported once, without a red row for every price", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { message: "Invalid API Key provided" } })));
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "account")).toEqual([expect.objectContaining({ check: "stripeKeyRejected", status: "error" })]);
    expect(r.sections.some((sec) => sec.key === "prices")).toBe(false);
  });

  test("email: with key and RESEND_MODE=live and a verified domain it is green, with the real sender shown", async () => {
    const r = await (await world()).action(api.billingHealth.check, {});
    const email = items(r, "email");
    expect(email.find((i) => i.check === "emailOk")).toMatchObject({ status: "ok", params: { address: "noreply@onespec.eu" } });
    expect(email.find((i) => i.check === "purchaseEmailDefault")?.params.address).toBe("purchases@onespec.eu");
    expect(email.find((i) => i.check === "resendDomainVerified")?.params.domain).toBe("onespec.eu");
  });

  test("email: RESEND_MODE not live is red (codes would only reach the logs); legacy RESEND_FROM is not required", async () => {
    vi.stubEnv("RESEND_MODE", "");
    const r = await (await world()).action(api.billingHealth.check, {});
    const email = items(r, "email");
    expect(email.find((i) => i.check === "emailModeNotLive")?.status).toBe("error");
    expect(email.some((i) => i.check === "emailOk")).toBe(false);
    expect(JSON.stringify(r)).not.toContain("RESEND_FROM\"");
  });

  test("email: missing key is red and Resend is not called", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "email").find((i) => i.check === "emailKeyMissing")?.status).toBe("error");
    expect(paths.some((p) => p.path.startsWith("https://api.resend.com"))).toBe(false);
  });

  test("email: unverified or missing domain is red; a sending-only key is just informational", async () => {
    resendDomains = () => json(200, { data: [{ name: "onespec.eu", status: "pending" }] });
    let r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "email").find((i) => i.check === "resendDomainNotVerified")).toMatchObject({ status: "error", params: { status: "pending" } });

    resendDomains = () => json(200, { data: [{ name: "other.com", status: "verified" }] });
    r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "email").find((i) => i.check === "resendDomainMissing")?.status).toBe("error");

    resendDomains = () => json(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" });
    r = await (await world()).action(api.billingHealth.check, {});
    expect(items(r, "email").find((i) => i.check === "resendDomainUncheckable")?.status).toBe("info");
  });

  test("short or missing platform secrets are reported", async () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", "short");
    vi.stubEnv("SUPPORT_SIGNING_SECRET", "");
    const r = await (await world()).action(api.billingHealth.check, {});
    const secrets = items(r, "secrets");
    expect(secrets.find((i) => i.check === "mfaKeyMissing")?.status).toBe("error");
    expect(secrets.find((i) => i.check === "supportSigningMissing")?.status).toBe("error");
  });
});

describe("Controllo pagamenti — texts", () => {
  test("every text is valid ICU in all six languages (no stray braces or <tags>)", async () => {
    const { IntlMessageFormat } = await import("intl-messageformat");
    const values = Object.fromEntries(
      ["ok", "warn", "error", "time", "regions", "host", "name", "country", "count", "plan", "cycle", "envName", "currency", "charged", "shown", "amount", "events", "expected", "countries", "address", "domain", "status"].map((k) => [k, "x"]),
    );
    for (const locale of ["it", "en", "fr", "de", "nl", "ro"]) {
      const messages = (await import(`../../messages/${locale}.json`)).default.billingHealth as Record<string, unknown>;
      const walk = (node: Record<string, unknown>, path: string) => {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string") expect(() => new IntlMessageFormat(v, locale).format(values), `${locale}:${path}${k}`).not.toThrow();
          else walk(v as Record<string, unknown>, `${path}${k}.`);
        }
      };
      walk(messages, "");
    }
  });
});
