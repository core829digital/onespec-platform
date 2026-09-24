/**
 * Founding accounts with full, unlimited platform access — no plan limits,
 * never blocked by planStatus. Single list, used by registration (auto-flag),
 * migrations (backfill), and docs.
 */
export const FULL_ACCESS_EMAILS = ["contact.core829@gmail.com", "office@winex.ro"];

export function isFullAccessEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FULL_ACCESS_EMAILS.includes(email.toLowerCase());
}
