/**
 * Accounts with full, unlimited platform access — no plan limits, never blocked by planStatus, no checkout.
 * Two groups, deliberately separate:
 *  - FOUNDER_EMAILS: the founders. Full access AND platform admin (see migrations:grantFullAccessToFounders).
 *  - PARTNER_FULL_ACCESS_EMAILS: full access exactly like the founders, but NEVER platform admin
 *    (no admin pages, no cross-company data). Granted at registration and by migrations:grantFullAccessToPartners.
 * The address must still be verified with the e-mail code before registration completes, so nobody else can claim it.
 */
export const FOUNDER_EMAILS = ["contact.core829@gmail.com", "office@winex.ro"];

export const PARTNER_FULL_ACCESS_EMAILS = ["eswindoors@gmail.com", "lujoe.solizioneinfissi@gmail.com"];

/** Every address that gets unlimited access (founders + partners). */
export const FULL_ACCESS_EMAILS = [...FOUNDER_EMAILS, ...PARTNER_FULL_ACCESS_EMAILS];

const norm = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

export function isFullAccessEmail(email: string | null | undefined): boolean {
  return FULL_ACCESS_EMAILS.includes(norm(email));
}

export function isFounderEmail(email: string | null | undefined): boolean {
  return FOUNDER_EMAILS.includes(norm(email));
}
