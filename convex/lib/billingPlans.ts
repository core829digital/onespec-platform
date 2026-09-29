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
 * Widget-first ladder (2026-09-29), sold BEFORE the full platform and listed
 * first — monthly only, no trial, prices VAT excluded:
 *
 *   Essentials €49,95   Essentials+ €62,44   Max €79,90
 *
 * Annual billing = monthly × 10 (2 months free), unless an explicit annual
 * Stripe Price says otherwise.
 */

export type BillablePlan = "essentials" | "essentials_plus" | "max" | "base" | "pro" | "agency";

/** Widget = widget-exclusive plans; platform = the whole platform. */
export type PlanFamily = "widget" | "platform";
export type BillingCycle = "monthly" | "annual";

export interface BillingPlan {
  key: BillablePlan | "enterprise";
  name: string;
  family: PlanFamily;
  /** Flat monthly price, cents. null => custom / contact sales. */
  priceCents: number | null;
  /** Stripe Price env-key stem, e.g. "BASE" → STRIPE_PRICE_BASE_MONTHLY_IT. */
  stripePriceKey?: "ESSENTIALS" | "ESSENTIALS_PLUS" | "MAX" | "BASE" | "PRO" | "AGENCY";
}

export type PlanKey = BillablePlan | "enterprise";

/** Display order = selling order: the widget ladder first, the full platform under it. */
export const BILLING_PLANS: BillingPlan[] = [
  { key: "essentials", name: "Essentials", family: "widget", priceCents: 4995, stripePriceKey: "ESSENTIALS" },
  { key: "essentials_plus", name: "Essentials+", family: "widget", priceCents: 6244, stripePriceKey: "ESSENTIALS_PLUS" },
  { key: "max", name: "Max", family: "widget", priceCents: 7990, stripePriceKey: "MAX" },
  { key: "base", name: "Base", family: "platform", priceCents: 9700, stripePriceKey: "BASE" },
  { key: "pro", name: "Pro", family: "platform", priceCents: 19700, stripePriceKey: "PRO" },
  { key: "agency", name: "Agency", family: "platform", priceCents: 39700, stripePriceKey: "AGENCY" },
  { key: "enterprise", name: "Enterprise", family: "platform", priceCents: 69000 },
];

/** Every self-serve plan key — the validator source for checkout / plan change / onboarding. */
export const SELF_SERVE_PLANS = ["essentials", "essentials_plus", "max", "base", "pro", "agency"] as const satisfies readonly BillablePlan[];

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

const PRICE_REGIONS = ["IT", "FR", "BE", "NL", "DE", "LU"] as const;

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
  // Look each env name up explicitly instead of enumerating process.env:
  // enumeration is not reliable in the Convex runtime, and a silent miss here
  // leaves a paying tenant on the wrong plan.
  const env = process.env as Record<string, string | undefined>;
  const plans = SELF_SERVE_PLANS;
  const cycles = ["monthly", "annual"] as const;
  for (const plan of plans) {
    for (const cycle of cycles) {
      for (const region of ["", ...PRICE_REGIONS]) {
        const name = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}${region ? "_" + region : ""}`;
        if (env[name] === priceId) return { plan, cycle, region };
      }
    }
  }
  // Legacy single-price envs.
  if (priceId === env.STRIPE_PRICE_BASE) return { plan: "base", cycle: "monthly", region: "" };
  if (priceId === env.STRIPE_PRICE_PRO) return { plan: "pro", cycle: "monthly", region: "" };
  return null;
}
