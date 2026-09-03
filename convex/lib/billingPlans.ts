/**
 * Billing catalogue — the single source of truth for prices shown and charged.
 *
 * `BILLING_PLANS` holds the base (region-agnostic) monthly price. Per Master
 * Plan v2 the platform rolls out country by country with **different prices per
 * country** ("prezzi diversi per nazione"); `REGIONAL_PRICES` overrides the base
 * figure for a market that has been priced. A region with no entry falls back to
 * the base price.
 *
 *   Base        Starter €24   Business €47    Enterprise custom
 *   IT (Fase 21) Starter €44   Business €89    Enterprise €169   [PROVISIONAL]
 *
 * The Alpha price is always derived, never stored: alphaCents = round(price*0.85),
 * so base / regional / Alpha figures can never drift apart.
 *
 * PROVISIONAL regional figures come from the strategy PDF and need founder
 * sign-off before a country goes live — do not treat them as final.
 */

export type BillablePlan = "starter" | "business";

export interface BillingPlan {
  key: BillablePlan | "enterprise";
  name: string;
  priceCents: number | null; // null => custom / contact sales
  /** Stripe Price ID env var name — resolved at runtime, never hard-coded. */
  stripePriceEnv?: string;
}

export const ALPHA_DISCOUNT_PCT = 15;

export type PlanKey = BillablePlan | "enterprise";

export const BILLING_PLANS: BillingPlan[] = [
  { key: "starter", name: "Starter", priceCents: 2400, stripePriceEnv: "STRIPE_PRICE_STARTER" },
  { key: "business", name: "Business", priceCents: 4700, stripePriceEnv: "STRIPE_PRICE_BUSINESS" },
  { key: "enterprise", name: "Enterprise", priceCents: null },
];

/**
 * Per-market price overrides (monthly, cents). PROVISIONAL until founder
 * sign-off. A region absent here uses the base `BILLING_PLANS` figure; a plan
 * absent within a present region likewise falls back to base.
 */
export const REGIONAL_PRICES: Partial<Record<string, Partial<Record<PlanKey, number | null>>>> = {
  // Fase 21 — Italia (strategy PDF p.23). PROVISIONAL.
  IT: { starter: 4400, business: 8900, enterprise: 16900 },
};

export function alphaPriceCents(priceCents: number): number {
  return Math.round((priceCents * (100 - ALPHA_DISCOUNT_PCT)) / 100);
}

export function billingPlan(key: string): BillingPlan | undefined {
  return BILLING_PLANS.find((p) => p.key === key);
}

/**
 * The list (standard) monthly price for a plan in a given region, before any
 * Alpha discount. `region` is a RegionCode (e.g. "IT"); undefined => base price.
 */
export function listPriceCents(planKey: string, region?: string | null): number | null {
  const base = billingPlan(planKey);
  if (!base) return null;
  const override = region ? REGIONAL_PRICES[region]?.[planKey as PlanKey] : undefined;
  return override !== undefined ? override : base.priceCents;
}

/**
 * The price a given tenant would actually pay for a plan: regional list price
 * with the Alpha discount applied when the tenant is on Alpha.
 */
export function effectivePriceCents(
  planKey: string,
  isAlpha: boolean,
  region?: string | null,
): number | null {
  const list = listPriceCents(planKey, region);
  if (list === null) return null;
  return isAlpha ? alphaPriceCents(list) : list;
}
