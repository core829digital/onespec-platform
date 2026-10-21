import { listPriceCents, SELF_SERVE_PLANS, type BillablePlan, type BillingCycle } from "./billingPlans";

/**
 * Economics of the referral system — the ONLY place the numbers live
 * (docs/PIANO_REFERRAL.md, section 1). Decided by the founder on 2026-10-02:
 *
 *   - the inviter earns 10% of the subscription price, VAT excluded, once per invited
 *     account (paid as credit on the Stripe balance, never cash);
 *   - the invited account gets 10% off its first paid invoice.
 *
 * Both are computed on the LIST price of the plan and billing cycle actually bought
 * (annual = monthly x 10), so the total cost is 20% of one billing period and the
 * invited account's first period still brings in 80% of its price.
 */
export const REFERRER_CREDIT_PERCENT = 10;
export const INVITEE_DISCOUNT_PERCENT = 10;

/** Days between the invited account's first real payment and the reward. */
export const REFERRAL_HOLD_DAYS = 30;
/** Rewards one inviter can collect in any rolling 12 months. */
export const MAX_REWARDS_PER_12_MONTHS = 10;
/** A qualified referral whose inviter stays ineligible this long after the hold is given up. */
export const EXPIRE_AFTER_HOLD_DAYS = 90;
/** After a reward, a refund/dispute within this many days of the qualifying payment triggers a clawback. */
export const CLAWBACK_WINDOW_DAYS = 60;
/** A claimed reward that never completed is retried after this long. */
export const CLAIM_RETRY_MS = 60 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The inviter's credit (cents) for an invited account that bought `plan` on `cycle`, or null
 * when the plan has no list price (Enterprise is handled by hand).
 */
export function referrerCreditCents(plan: string, cycle: BillingCycle = "monthly"): number | null {
  if (!isBillable(plan)) return null;
  const price = listPriceCents(plan, null, cycle);
  return price === null ? null : Math.round((price * REFERRER_CREDIT_PERCENT) / 100);
}

/** Self-serve plans only: Enterprise is sales-led and outside the automatic referral. */
export function isBillable(plan: string): plan is BillablePlan {
  return (SELF_SERVE_PLANS as readonly string[]).includes(plan);
}
