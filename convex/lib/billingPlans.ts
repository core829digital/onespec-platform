/**
 * Billing catalogue — the single source of truth for prices shown and charged.
 *
 * `BILLING_PLANS` holds the base (region-agnostic) monthly price. Per Master
 * Plan v2 the platform rolls out country by country with **different prices per
 * country** ("prezzi diversi per nazione"); `REGIONAL_PRICES` overrides the base
 * figure for a market that has been priced. A region with no entry falls back to
 * the base price.
 *
 *   Base        Starter €24   Pro €47       Enterprise custom   Showroom custom
 *   IT          Starter €44   Pro €89       Enterprise €169     Showroom €249
 *   FR/BE       Starter €54   Pro €99       Enterprise €199     Showroom €279
 *   NL          Starter €64   Pro €129      Enterprise €279     Showroom €349
 *   DE/LU       Starter €79   Pro €169      Enterprise €349     Showroom €449
 *
 * Regional figures are mid-range strategy-PDF values and need founder sign-off
 * before a country goes live — do not treat them as final.
 *
 * The Alpha price is always derived, never stored: alphaCents = round(price*0.85),
 * so base / regional / Alpha figures can never drift apart.
 *
 * Annual billing = monthly × 10 (2 months free), unless an explicit annual
 * Stripe Price says otherwise.
 */

export type BillablePlan = "starter" | "pro";
export type BillingCycle = "monthly" | "annual";

export interface BillingPlan {
  key: BillablePlan | "enterprise" | "showroom";
  name: string;
  /** Base monthly price, cents. null => custom / contact sales. */
  priceCents: number | null;
  /** Stripe Price env-key stem, e.g. "STARTER" → STRIPE_PRICE_STARTER_MONTHLY_IT. */
  stripePriceKey?: "STARTER" | "PRO";
}

export const ALPHA_DISCOUNT_PCT = 15;

export type PlanKey = BillablePlan | "enterprise" | "showroom";

export const BILLING_PLANS: BillingPlan[] = [
  { key: "starter", name: "Starter", priceCents: 2400, stripePriceKey: "STARTER" },
  { key: "pro", name: "Pro", priceCents: 4700, stripePriceKey: "PRO" },
  { key: "enterprise", name: "Enterprise", priceCents: null },
  { key: "showroom", name: "Showroom", priceCents: null },
];

/**
 * Per-market price overrides (monthly, cents). A region absent here uses the
 * base `BILLING_PLANS` figure; a plan absent within a present region likewise
 * falls back to base. Enterprise/Showroom figures are display-only anchors
 * for the contact-sales cards.
 */
export const REGIONAL_PRICES: Partial<Record<string, Partial<Record<PlanKey, number | null>>>> = {
  IT: { starter: 4400, pro: 8900, enterprise: 16900, showroom: 24900 },
  FR: { starter: 5400, pro: 9900, enterprise: 19900, showroom: 27900 },
  BE: { starter: 5400, pro: 9900, enterprise: 19900, showroom: 27900 },
  NL: { starter: 6400, pro: 12900, enterprise: 27900, showroom: 34900 },
  DE: { starter: 7900, pro: 16900, enterprise: 34900, showroom: 44900 },
  LU: { starter: 7900, pro: 16900, enterprise: 34900, showroom: 44900 },
};

export function alphaPriceCents(priceCents: number): number {
  return Math.round((priceCents * (100 - ALPHA_DISCOUNT_PCT)) / 100);
}

export function billingPlan(key: string): BillingPlan | undefined {
  if (key === "business") return BILLING_PLANS.find((p) => p.key === "pro");
  return BILLING_PLANS.find((p) => p.key === key);
}

/**
 * The list (standard) monthly price for a plan in a given region, before any
 * Alpha discount. `region` is a RegionCode (e.g. "IT"); undefined => base price.
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

/**
 * The price a given tenant would actually pay for a plan: regional list price
 * with the Alpha discount applied when the tenant is on Alpha.
 */
export function effectivePriceCents(
  planKey: string,
  isAlpha: boolean,
  region?: string | null,
  cycle: BillingCycle = "monthly",
): number | null {
  const list = listPriceCents(planKey, region, cycle);
  if (list === null) return null;
  return isAlpha ? alphaPriceCents(list) : list;
}

/* -------------------------------------------------------------------------- */
/*  Stripe Price ID resolution (Part D env scheme)                             */
/* -------------------------------------------------------------------------- */

/**
 * Env-var name for a Stripe Price: STRIPE_PRICE_<PLAN>_<CYCLE>_<REGION>,
 * e.g. STRIPE_PRICE_PRO_ANNUAL_IT. Only starter/pro are billable;
 * enterprise/showroom are sales-led (ad-hoc Price per deal, or invoiced).
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
    (cycle === "monthly" && plan === "starter" ? process.env.STRIPE_PRICE_STARTER : undefined) ??
    (cycle === "monthly" && plan === "pro" ? process.env.STRIPE_PRICE_BUSINESS : undefined)
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
    const m = /^STRIPE_PRICE_(STARTER|PRO)(?:_(MONTHLY|ANNUAL)(?:_([A-Z]{2}))?)?$/.exec(name);
    if (!m) continue;
    return {
      plan: m[1] === "STARTER" ? "starter" : "pro",
      cycle: (m[2]?.toLowerCase() as BillingCycle | undefined) ?? "monthly",
      region: m[3] ?? "",
    };
  }
  // Legacy single-price envs.
  if (priceId === env.STRIPE_PRICE_STARTER) return { plan: "starter", cycle: "monthly", region: "" };
  if (priceId === env.STRIPE_PRICE_BUSINESS) return { plan: "pro", cycle: "monthly", region: "" };
  return null;
}
