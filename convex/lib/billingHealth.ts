/**
 * Payments readiness check for the platform admin ("Controllo pagamenti").
 *
 * Reads the deployment environment and a handful of read-only Stripe endpoints and turns them into a list of
 * plain checks (ok / warn / error / info). It never returns a secret: a key is reported only as present/missing,
 * its mode (live/test) or its length. The UI translates each `check` code; `params` carry only non-secret details
 * (plan names, amounts, countries, host names).
 */
import { BILLING_PLANS, SELF_SERVE_PLANS, listPriceCents, resolveStripePriceId, type BillablePlan, type BillingCycle } from "./billingPlans";
import { entitlementsFor } from "./entitlements";

export type HealthStatus = "ok" | "warn" | "error" | "info";
export interface HealthItem {
  id: string;
  check: string;
  status: HealthStatus;
  params: Record<string, string>;
}
export interface HealthSection {
  key: "keys" | "account" | "prices" | "webhook" | "tax" | "portal" | "secrets";
  items: HealthItem[];
}
export interface HealthReport {
  checkedAt: number;
  mode: "live" | "test" | "missing";
  overall: "ok" | "warn" | "error";
  sections: HealthSection[];
}

export type StripeGet = (path: string) => Promise<{ ok: boolean; status: number; json: Record<string, unknown> }>;
type Env = Record<string, string | undefined>;

/** Events the webhook handler applies (convex/http.ts). The live endpoint must send all of them. */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.updated",
];

const PRICE_REGIONS = ["IT", "FR", "BE", "NL", "DE", "LU"] as const;

const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const planName = (plan: BillablePlan) => BILLING_PLANS.find((p) => p.key === plan)?.name ?? plan;

function keyMode(key: string | undefined): HealthReport["mode"] {
  if (!key) return "missing";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "test";
}

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** The plan/cycle pairs a customer can actually buy (annual only where the plan offers it). */
export function sellablePlanCycles(): Array<{ plan: BillablePlan; cycle: BillingCycle }> {
  const out: Array<{ plan: BillablePlan; cycle: BillingCycle }> = [];
  for (const plan of SELF_SERVE_PLANS) {
    out.push({ plan, cycle: "monthly" });
    if (entitlementsFor(plan).annualBilling) out.push({ plan, cycle: "annual" });
  }
  return out;
}

function item(id: string, check: string, status: HealthStatus, params: Record<string, string> = {}): HealthItem {
  return { id, check, status, params };
}

function keysSection(env: Env, mode: HealthReport["mode"]): HealthSection {
  const items: HealthItem[] = [];
  items.push(
    mode === "missing"
      ? item("secretKey", "secretKeyMissing", "error")
      : mode === "live"
        ? item("secretKey", "secretKeyLive", "ok")
        : item("secretKey", "secretKeyTest", "warn"),
  );
  const whsec = env.STRIPE_WEBHOOK_SECRET ?? "";
  items.push(
    !whsec
      ? item("webhookSecret", "webhookSecretMissing", "error")
      : whsec.startsWith("whsec_")
        ? item("webhookSecret", "webhookSecretOk", "ok")
        : item("webhookSecret", "webhookSecretMalformed", "error"),
  );
  items.push(
    /^[A-Za-z0-9_-]{24,128}$/.test(env.STRIPE_WEBHOOK_PATH_TOKEN ?? "")
      ? item("webhookPath", "webhookPathOk", "ok")
      : item("webhookPath", "webhookPathMissing", "error"),
  );
  const site = hostOf(env.SITE_URL);
  items.push(site ? item("siteUrl", "siteUrlOk", "ok", { host: site }) : item("siteUrl", "siteUrlMissing", "error"));
  return { key: "keys", items };
}

function secretsSection(env: Env): HealthSection {
  const long = (name: string) => (env[name] ?? "").length >= 32;
  const set = (name: string) => Boolean((env[name] ?? "").trim());
  const items: HealthItem[] = [
    long("SUPPORT_SIGNING_SECRET")
      ? item("supportSigning", "supportSigningOk", "ok")
      : item("supportSigning", "supportSigningMissing", "error"),
    long("MFA_ENCRYPTION_KEY") ? item("mfaKey", "mfaKeyOk", "ok") : item("mfaKey", "mfaKeyMissing", "error"),
    set("DAILY_IP_SALT") ? item("ipSalt", "ipSaltOk", "ok") : item("ipSalt", "ipSaltMissing", "warn"),
    set("AUTH_RESEND_KEY") && set("RESEND_FROM")
      ? item("email", "emailOk", "ok")
      : item("email", "emailMissing", "error"),
    set("RESEND_FROM_PURCHASES") ? item("purchaseEmail", "purchaseEmailOk", "ok") : item("purchaseEmail", "purchaseEmailMissing", "warn"),
    set("TURNSTILE_SECRET") ? item("turnstile", "turnstileOk", "ok") : item("turnstile", "turnstileMissing", "warn"),
    set("OPS_ALERT_EMAIL") ? item("alerts", "alertsOk", "ok") : item("alerts", "alertsMissing", "warn"),
  ];
  return { key: "secrets", items };
}

async function accountSection(get: StripeGet): Promise<HealthSection> {
  const r = await get("/account");
  if (!r.ok) return { key: "account", items: [item("account", r.status === 401 ? "stripeKeyRejected" : "stripeUnreachable", "error")] };
  const a = r.json as {
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    country?: string;
    settings?: { dashboard?: { display_name?: string } };
    business_profile?: { name?: string };
    requirements?: { currently_due?: unknown[]; disabled_reason?: string | null };
  };
  const name = a.business_profile?.name || a.settings?.dashboard?.display_name || "";
  const due = Array.isArray(a.requirements?.currently_due) ? a.requirements.currently_due.length : 0;
  return {
    key: "account",
    items: [
      item("accountName", "accountName", name ? "info" : "warn", { name: name || "—", country: a.country ?? "—" }),
      a.charges_enabled ? item("charges", "chargesEnabled", "ok") : item("charges", "chargesDisabled", "error"),
      a.payouts_enabled ? item("payouts", "payoutsEnabled", "ok") : item("payouts", "payoutsDisabled", "warn"),
      due === 0 ? item("requirements", "requirementsNone", "ok") : item("requirements", "requirementsDue", "warn", { count: String(due) }),
    ],
  };
}

async function pricesSection(get: StripeGet, mode: HealthReport["mode"]): Promise<HealthSection> {
  const items: HealthItem[] = [];
  for (const { plan, cycle } of sellablePlanCycles()) {
    const label = { plan: planName(plan), cycle };
    // Every market resolves its own Price (regional override → cycle default → legacy); check each distinct one once.
    const byPrice = new Map<string, string[]>();
    const unresolved: string[] = [];
    for (const region of PRICE_REGIONS) {
      const id = resolveStripePriceId(plan, cycle, region);
      if (!id) unresolved.push(region);
      else byPrice.set(id, [...(byPrice.get(id) ?? []), region]);
    }
    if (byPrice.size === 0) {
      items.push(item(`${plan}_${cycle}`, "priceMissing", "error", { ...label, envName: `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}` }));
      continue;
    }
    if (unresolved.length) items.push(item(`${plan}_${cycle}_regions`, "priceMissingRegions", "error", { ...label, regions: unresolved.join(", ") }));
    for (const [priceId, regions] of byPrice) {
      const id = `${plan}_${cycle}_${regions.join("")}`;
      const where = byPrice.size > 1 || unresolved.length ? { regions: regions.join(", ") } : { regions: "" };
      const r = await get(`/prices/${encodeURIComponent(priceId)}`);
      if (!r.ok) {
        items.push(item(id, r.status === 404 ? "priceNotFound" : "stripeUnreachable", "error", { ...label, ...where }));
        continue;
      }
      const p = r.json as {
        active?: boolean;
        livemode?: boolean;
        currency?: string;
        unit_amount?: number | null;
        tax_behavior?: string;
        recurring?: { interval?: string; interval_count?: number } | null;
      };
      const expected = listPriceCents(plan, regions[0], cycle);
      const problems: HealthItem[] = [];
      if (p.active === false) problems.push(item(id, "priceInactive", "error", { ...label, ...where }));
      if (mode !== "missing" && typeof p.livemode === "boolean" && p.livemode !== (mode === "live"))
        problems.push(item(id, "priceWrongMode", "error", { ...label, ...where }));
      if ((p.currency ?? "").toLowerCase() !== "eur") problems.push(item(id, "priceWrongCurrency", "error", { ...label, ...where, currency: (p.currency ?? "—").toUpperCase() }));
      const interval = cycle === "annual" ? "year" : "month";
      if (!p.recurring || p.recurring.interval !== interval || (p.recurring.interval_count ?? 1) !== 1)
        problems.push(item(id, "priceWrongInterval", "error", { ...label, ...where }));
      if (expected !== null && typeof p.unit_amount === "number" && p.unit_amount !== expected) {
        // Monthly: what the price page shows must be what is charged. Annual: an explicit annual Price may differ by design.
        problems.push(
          item(id, "priceAmountMismatch", cycle === "monthly" ? "error" : "warn", {
            ...label,
            ...where,
            charged: euros(p.unit_amount),
            shown: euros(expected),
          }),
        );
      }
      if (p.tax_behavior !== "exclusive") problems.push(item(id, "priceTaxBehavior", "warn", { ...label, ...where }));
      items.push(
        ...(problems.length
          ? problems
          : [item(id, "priceOk", "ok", { ...label, ...where, amount: typeof p.unit_amount === "number" ? euros(p.unit_amount) : "—" })]),
      );
    }
  }
  return { key: "prices", items };
}

async function webhookSection(env: Env, get: StripeGet): Promise<HealthSection> {
  const token = env.STRIPE_WEBHOOK_PATH_TOKEN ?? "";
  if (!token) return { key: "webhook", items: [item("endpoint", "webhookPathMissing", "error")] };
  const r = await get("/webhook_endpoints?limit=100");
  if (!r.ok) return { key: "webhook", items: [item("endpoint", "stripeUnreachable", "error")] };
  const list = (Array.isArray(r.json.data) ? r.json.data : []) as Array<{ url?: string; status?: string; enabled_events?: string[] }>;
  const ours = list.find((e) => typeof e.url === "string" && e.url.includes(`/ev/${token}`));
  if (!ours) return { key: "webhook", items: [item("endpoint", "webhookNotRegistered", "error", { count: String(list.length) })] };
  const host = hostOf(ours.url);
  const items: HealthItem[] = [];
  const expectedHost = hostOf(env.CONVEX_SITE_URL);
  items.push(
    expectedHost && host !== expectedHost
      ? item("endpointHost", "webhookWrongHost", "error", { host, expected: expectedHost })
      : item("endpointHost", "webhookRegistered", "ok", { host }),
  );
  items.push(ours.status === "enabled" ? item("endpointStatus", "webhookEnabled", "ok") : item("endpointStatus", "webhookDisabled", "error"));
  const events = ours.enabled_events ?? [];
  const missing = events.includes("*") ? [] : WEBHOOK_EVENTS.filter((e) => !events.includes(e));
  items.push(missing.length ? item("events", "webhookMissingEvents", "error", { events: missing.join(", ") }) : item("events", "webhookEventsOk", "ok"));
  items.push(item("secretMatch", "webhookSecretUnverifiable", "info"));
  return { key: "webhook", items };
}

async function taxSection(get: StripeGet): Promise<HealthSection> {
  const r = await get("/tax/settings");
  if (!r.ok) return { key: "tax", items: [item("tax", r.status === 404 ? "taxNotSetUp" : "stripeUnreachable", "error")] };
  const s = r.json as { status?: string; head_office?: { address?: { country?: string } } | null };
  const items: HealthItem[] = [
    s.status === "active"
      ? item("taxStatus", "taxActive", "ok", { country: s.head_office?.address?.country ?? "—" })
      : item("taxStatus", "taxPending", "error"),
  ];
  const reg = await get("/tax/registrations?status=active&limit=100");
  if (reg.ok) {
    const countries = ((Array.isArray(reg.json.data) ? reg.json.data : []) as Array<{ country?: string }>)
      .map((x) => x.country)
      .filter((c): c is string => Boolean(c));
    items.push(
      countries.length
        ? item("taxRegistrations", "taxRegistrations", "info", { countries: countries.join(", ") })
        : item("taxRegistrations", "taxNoRegistrations", "warn"),
    );
  }
  return { key: "tax", items };
}

async function portalSection(get: StripeGet): Promise<HealthSection> {
  const r = await get("/billing_portal/configurations?is_default=true&limit=1");
  if (!r.ok) return { key: "portal", items: [item("portal", "stripeUnreachable", "warn")] };
  const conf = (Array.isArray(r.json.data) ? r.json.data[0] : undefined) as
    | { features?: { subscription_update?: { enabled?: boolean }; invoice_history?: { enabled?: boolean } } }
    | undefined;
  if (!conf) return { key: "portal", items: [item("portal", "portalNotConfigured", "warn")] };
  return {
    key: "portal",
    items: [
      conf.features?.subscription_update?.enabled
        ? item("planSwitch", "portalPlanSwitchOn", "warn")
        : item("planSwitch", "portalPlanSwitchOff", "ok"),
      conf.features?.invoice_history?.enabled === false
        ? item("invoices", "portalInvoicesOff", "warn")
        : item("invoices", "portalInvoicesOn", "ok"),
    ],
  };
}

export async function runBillingHealth(env: Env, get: StripeGet, now: number): Promise<HealthReport> {
  const mode = keyMode(env.STRIPE_SECRET_KEY);
  const sections: HealthSection[] = [keysSection(env, mode)];
  if (mode !== "missing") {
    const account = await accountSection(get);
    sections.push(account);
    // A rejected key or an unreachable Stripe would turn every following check red for the same reason: report it once.
    const blocked = account.items.some((i) => i.check === "stripeKeyRejected" || i.check === "stripeUnreachable");
    if (!blocked) {
      sections.push(await pricesSection(get, mode));
      sections.push(await webhookSection(env, get));
      sections.push(await taxSection(get));
      sections.push(await portalSection(get));
    }
  }
  sections.push(secretsSection(env));
  const all = sections.flatMap((s) => s.items);
  const overall = all.some((i) => i.status === "error") ? "error" : all.some((i) => i.status === "warn") ? "warn" : "ok";
  return { checkedAt: now, mode, overall, sections };
}
