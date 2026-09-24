/**
 * Single source of truth for transactional-email sender addresses.
 * Resend's `onboarding@resend.dev` test domain only delivers to the Resend
 * account owner's own inbox — it must NEVER be the sender for real users.
 * Everything goes through the verified onespec.eu domain instead.
 */
export function noreplyFromAddress(): string {
  return process.env.RESEND_FROM_NOREPLY ?? "noreply@onespec.eu";
}

export function purchasesFromAddress(): string {
  return process.env.RESEND_FROM_PURCHASES ?? "purchases@onespec.eu";
}

/** Legacy single-address override (kept for compat, prefer the two above). */
export function legacyFromAddress(): string {
  return process.env.RESEND_FROM ?? noreplyFromAddress();
}
