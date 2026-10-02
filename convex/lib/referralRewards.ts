import type { BillablePlan } from "./billingPlans";

/**
 * Economics of the referral system — the ONLY place the numbers live
 * (docs/PIANO_REFERRAL.md, section 1). Proposed defaults, to be confirmed by the
 * founder: change them here and nowhere else. Amounts are euro cents.
 *
 *   referrerCreditCents  credit on the inviter's Stripe balance (never cash)
 *   inviteeDiscountCents  discount on the invited account's first paid invoice
 *
 * Rule of thumb that keeps the cost bounded: credit + discount stays below one month
 * of the new customer's plan.
 */
export const REFERRAL_REWARDS: Record<BillablePlan, { referrerCreditCents: number; inviteeDiscountCents: number }> = {
  essentials: { referrerCreditCents: 1500, inviteeDiscountCents: 1000 },
  essentials_plus: { referrerCreditCents: 2000, inviteeDiscountCents: 1250 },
  max: { referrerCreditCents: 2500, inviteeDiscountCents: 1600 },
  base: { referrerCreditCents: 3000, inviteeDiscountCents: 1940 },
  pro: { referrerCreditCents: 6000, inviteeDiscountCents: 3940 },
  agency: { referrerCreditCents: 10000, inviteeDiscountCents: 7940 },
};

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

export function rewardFor(plan: string): { referrerCreditCents: number; inviteeDiscountCents: number } | null {
  return Object.prototype.hasOwnProperty.call(REFERRAL_REWARDS, plan) ? REFERRAL_REWARDS[plan as BillablePlan] : null;
}
