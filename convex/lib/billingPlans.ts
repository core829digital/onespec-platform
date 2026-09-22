/**
 * Billing catalogue — the single source of truth for prices shown and charged.
 *
 * v2 plan ladder (2026-09-22), per the signed SaaS service contracts
 * (Base/Pro/Agency/Enterprise): flat monthly price, same everywhere — the
 * contracts do not vary by country, unlike the earlier region-priced v1
 * ladder this replaces. `REGIONAL_PRICES` is kept as a mechanism (a future
 * market could still get an override) but starts empty.
 *
 *   Base €97   Pro €197 (bestseller)   Agency €397   Enterprise €690
 *
 * Annual billing = monthly × 10 (2 months free), unless an explicit annual
 * Stripe Price says otherwise.
 */

export type BillablePlan = "base" | "pro" | "agency";
export type BillingCycle = "monthly" | "annual";

export interface BillingPlan {
  key: BillablePlan | "enterprise";
  name: string;
  /** Flat monthly price, cents. null => custom / contact sales. */
  priceCents: number | null;
  /** Stripe Price env-key stem, e.g. "BASE" → STRIPE_PRICE_BASE_MONTHLY_IT. */
  stripePriceKey?: "BASE" | "PRO" | "AGENCY";
}

export type PlanKey = BillablePlan | "enterprise";

export const BILLING_PLANS: BillingPlan[] = [
  { key: "base", name: "Base", priceCents: 9700, stripePriceKey: "BASE" },
  { key: "pro", name: "Pro", priceCents: 19700, stripePriceKey: "PRO" },
  { key: "agency", name: "Agency", priceCents: 39700, stripePriceKey: "AGENCY" },
  { key: "enterprise", name: "Enterprise", priceCents: 69000 },
];

/**
 * Per-market price overrides (monthly, cents). Empty for v2 — the signed
 * contracts price flat regardless of country. A region added here would
 * override the base `BILLING_PLANS` figure for that market.
 */
export const REGIONAL_PRICES: Partial<Record<string, Partial<Record<PlanKey, number | null>>>> = {};

export function billingPlan(key: string): BillingPlan | undefined {
  if (key === "business") return BILLING_PLANS.find((p) => p.key === "pro");
  return BILLING_PLANS.find((p) => p.key === key);
}

/**
 * The list monthly price for a plan in a given region. `region` is a RegionCode (e.g. "IT"); undefined => base price.
 */
export function listPriceCents(
  planKey: string,
  region?: string | null,
  cycle: BillingCycle = "monthly",
): number | null {
  const base = billingPlan(planKey);
  if (!base) return null;
  const monthly =
    region && REGIONAL_PRICES[region]?.[planKey as PlanKey] !== undefined
      ? (REGIONAL_PRICES[region]?.[planKey as PlanKey] as number)
      : base.priceCents;
  if (monthly === null || monthly === undefined) return null;
  return cycle === "annual" ? monthly * 10 : monthly;
}

/* -------------------------------------------------------------------------- */
/*  Stripe Price ID resolution (Part D env scheme)                             */
/* -------------------------------------------------------------------------- */

/**
 * Env-var name for a Stripe Price: STRIPE_PRICE_<PLAN>_<CYCLE>_<REGION>,
 * e.g. STRIPE_PRICE_PRO_ANNUAL_IT. Only base/pro/agency are self-serve
 * billable; enterprise is sales-led (ad-hoc Price per deal, or invoiced).
 */
export function stripePriceEnvName(
  plan: BillablePlan,
  cycle: BillingCycle,
  region: string,
): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}_${region}`;
}

/**
 * Resolve a Stripe Price ID with the documented fallback chain:
 * regional → cycle default → legacy single-price env (monthly only).
 */
export function resolveStripePriceId(
  plan: BillablePlan,
  cycle: BillingCycle,
  region: string,
): string | undefined {
  return (
    process.env[stripePriceEnvName(plan, cycle, region)] ??
    process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`] ??
    (cycle === "monthly" && plan === "base" ? process.env.STRIPE_PRICE_BASE : undefined) ??
    (cycle === "monthly" && plan === "pro" ? process.env.STRIPE_PRICE_PRO : undefined)
  );
}

/**
 * Reverse-map a Stripe Price ID back to (plan, cycle, region) by scanning the
 * Part D env matrix. Returns null when the price is unknown (e.g. an ad-hoc
 * sales-led Price) — callers treat that as "keep current plan".
 */
export function planFromStripePriceId(priceId: string): {
  plan: PlanKey;
  cycle: BillingCycle;
  region: string;
} | null {
  const env = process.env as Record<string, string | undefined>;
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("STRIPE_PRICE_") || value !== priceId) continue;
    const m = /^STRIPE_PRICE_(BASE|PRO|AGENCY)(?:_(MONTHLY|ANNUAL)(?:_([A-Z]{2}))?)?$/.exec(name);
    if (!m) continue;
    return {
      plan: m[1].toLowerCase() as PlanKey,
      cycle: (m[2]?.toLowerCase() as BillingCycle | undefined) ?? "monthly",
      region: m[3] ?? "",
    };
  }
  // Legacy single-price envs.
  if (priceId === env.STRIPE_PRICE_BASE) return { plan: "base", cycle: "monthly", region: "" };
  if (priceId === env.STRIPE_PRICE_PRO) return { plan: "pro", cycle: "monthly", region: "" };
  return null;
}
