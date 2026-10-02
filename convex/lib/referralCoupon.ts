import { stripeRest } from "./stripeRest";

/**
 * The Stripe coupon behind an invited account's discount: a fixed amount off, valid for
 * one month of the subscription (so it also covers the first PAID invoice when the plan
 * starts with a free trial). One coupon per amount, created the first time it is needed
 * under a deterministic id, so every later checkout reuses it. Returns null on any
 * problem — the caller then simply proceeds without the discount.
 */
export async function ensureReferralCoupon(amountCents: number): Promise<string | null> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
  const id = `onespec-ref-${amountCents}`;
  const got = await stripeRest("GET", `/coupons/${id}`);
  if (got.ok) return id;
  if (got.status !== 404) return null;
  const made = await stripeRest(
    "POST",
    "/coupons",
    {
      id,
      name: `Sconto invito OneSpec (${(amountCents / 100).toFixed(2)} EUR)`,
      amount_off: String(amountCents),
      currency: "eur",
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
