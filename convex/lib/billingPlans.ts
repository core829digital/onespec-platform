/**
 * Verified billing catalogue — the single source of truth for prices shown and
 * charged. Figures match the published pricing page exactly; do not invent
 * additional tiers, limits, or discounts.
 *
 *   Starter    €24 / mese   (Alpha €20,40)   — sconto Alpha 15%
 *   Business   €47 / mese   (Alpha €39,95)   — sconto Alpha 15%
 *   Enterprise  prezzo personalizzato
 *
 * `priceCents` is the standard monthly price. The Alpha price is derived, never
 * stored separately, so the two can never drift: alphaCents = round(price * 0.85).
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

export const BILLING_PLANS: BillingPlan[] = [
  { key: "starter", name: "Starter", priceCents: 2400, stripePriceEnv: "STRIPE_PRICE_STARTER" },
  { key: "business", name: "Business", priceCents: 4700, stripePriceEnv: "STRIPE_PRICE_BUSINESS" },
  { key: "enterprise", name: "Enterprise", priceCents: null },
];

export function alphaPriceCents(priceCents: number): number {
  return Math.round((priceCents * (100 - ALPHA_DISCOUNT_PCT)) / 100);
}

export function billingPlan(key: string): BillingPlan | undefined {
  return BILLING_PLANS.find((p) => p.key === key);
}

/** The price a given tenant would actually pay for a plan, Alpha discount applied. */
export function effectivePriceCents(planKey: string, isAlpha: boolean): number | null {
  const plan = billingPlan(planKey);
  if (!plan || plan.priceCents === null) return null;
  return isAlpha ? alphaPriceCents(plan.priceCents) : plan.priceCents;
}
