import { stripeRest } from "./stripeRest";

/**
 * The Stripe coupon behind an invited account's discount: a percentage off, valid for one
 * month of the subscription (so it also covers the first PAID invoice when the plan starts
 * with a free trial, and the single annual invoice on yearly billing). One coupon per
 * percentage, created the first time it is needed under a deterministic id, so every later
 * checkout reuses it. Returns null on any problem — the caller then simply proceeds
 * without the discount.
 */
export async function ensureReferralCoupon(percentOff: number): Promise<string | null> {
  if (!Number.isInteger(percentOff) || percentOff <= 0 || percentOff > 100) return null;
  const id = `onespec-ref-pct-${percentOff}`;
  const got = await stripeRest("GET", `/coupons/${id}`);
  if (got.ok) return id;
  if (got.status !== 404) return null;
  const made = await stripeRest(
    "POST",
    "/coupons",
    {
      id,
      name: `Sconto invito OneSpec (${percentOff}%)`,
      percent_off: String(percentOff),
      duration: "repeating",
      duration_in_months: "1",
    },
    `coupon-${id}`,
  );
  if (made.ok) return id;
  // Another checkout may have created it a moment earlier.
  const again = await stripeRest("GET", `/coupons/${id}`);
  return again.ok ? id : null;
}
