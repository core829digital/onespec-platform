/**
 * Referral helpers — pure functions (no database), so every rule is unit-testable.
 * See docs/PIANO_REFERRAL.md.
 */

/** 31 symbols: digits 2-9 and letters without I, L, O (no 0/1/I/L/O look-alikes). */
export const REFERRAL_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERRAL_PREFIX = "OS-";
export const REFERRAL_CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^${REFERRAL_PREFIX}[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/** A fresh code from the CSPRNG, rejection-sampled so every symbol is equally likely. */
export function generateReferralCode(): string {
  const limit = Math.floor(256 / REFERRAL_ALPHABET.length) * REFERRAL_ALPHABET.length;
  let out = "";
  const buf = new Uint8Array(1);
  while (out.length < REFERRAL_CODE_LENGTH) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) out += REFERRAL_ALPHABET[buf[0] % REFERRAL_ALPHABET.length];
  }
  return REFERRAL_PREFIX + out;
}

/**
 * Canonical form of a code typed or pasted by a person (case, spaces, a missing
 * prefix, dashes are forgiven). Returns null when it cannot be a valid code.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toUpperCase().replace(/[\s_]+/g, "");
  if (s.length > 20) return null;
  if (s.startsWith(REFERRAL_PREFIX)) {
    // already in canonical shape
  } else if (/^OS[A-Z0-9]{6}$/.test(s)) {
    s = REFERRAL_PREFIX + s.slice(2); // dash forgotten
  } else {
    s = REFERRAL_PREFIX + s; // bare six symbols
  }
  return CODE_RE.test(s) ? s : null;
}

/** Mailbox providers shared by millions of people: the domain proves nothing about the company. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com",
  "yahoo.it", "yahoo.fr", "yahoo.de", "icloud.com", "me.com", "libero.it", "virgilio.it", "tiscali.it",
  "alice.it", "tin.it", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "gmx.net",
  "web.de", "t-online.de", "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr", "yahoo.ro",
  "ymail.com", "mail.com", "zoho.com", "pec.it",
]);

/** Throwaway mailbox providers: an account made with one cannot invite or be invited. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org",
  "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "throwawaymail.com", "dispostable.com",
  "maildrop.cc", "fakeinbox.com", "moakt.com", "mintemail.com",
]);

function split(email: string): { local: string; domain: string } | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return null;
  return { local: e.slice(0, at), domain: e.slice(at + 1) };
}

/**
 * The mailbox behind an address: lower-case, `+tag` removed, and for Gmail the dots
 * in the local part ignored. Two addresses with the same canonical form are the same person.
 */
export function canonicalEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = split(email);
  if (!parts) return null;
  let { local } = parts;
  let { domain } = parts;
  local = local.replace(/\+.*$/, "");
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string | null | undefined): boolean {
  const parts = email ? split(email) : null;
  return parts ? DISPOSABLE_EMAIL_DOMAINS.has(parts.domain) : false;
}

export type ReferralRejection =
  | "SELF_REFERRAL"
  | "SAME_ORGANIZATION"
  | "DISPOSABLE_EMAIL"
  | "MISSING_EMAIL";

/**
 * Can this pair of owners be considered two independent customers? Returns the
 * reason when not. Same person or same company (same non-free email domain) is
 * refused, as is a throwaway mailbox on either side.
 */
export function referralPairProblem(
  referrerEmail: string | null | undefined,
  referredEmail: string | null | undefined,
): ReferralRejection | null {
  const a = canonicalEmail(referrerEmail);
  const b = canonicalEmail(referredEmail);
  if (!a || !b) return "MISSING_EMAIL";
  if (isDisposableEmail(referrerEmail) || isDisposableEmail(referredEmail)) return "DISPOSABLE_EMAIL";
  if (a === b) return "SELF_REFERRAL";
  const da = a.slice(a.lastIndexOf("@") + 1);
  const db = b.slice(b.lastIndexOf("@") + 1);
  if (da === db && !FREE_EMAIL_DOMAINS.has(da)) return "SAME_ORGANIZATION";
  return null;
}
