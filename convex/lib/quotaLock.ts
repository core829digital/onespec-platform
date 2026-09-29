import type { Doc } from "../_generated/dataModel";

/**
 * "Accetta ma blocca" (widget-first plans). A request that arrives over the
 * monthly cap is saved — the prospect is never lost — but its contact details
 * stay hidden from the tenant until it upgrades or the next month starts
 * (`usage.unlockTenantLockedRequests` / the monthly sweep clear the flag).
 * A request received while the subscription was SUSPENDED is locked with
 * `suspendedLocked` instead and unlocks only on reactivation.
 *
 * Redaction happens here, server-side, on every path that hands a request to
 * a tenant user: lists, detail, print/PDF, CSV export, related records and
 * notifications. The stored document keeps the real data, so unlocking is
 * lossless. Items and price stay visible: the tenant can see what it is
 * missing without being able to contact the prospect.
 */

export const LOCKED_LEAD_NAME = "Richiesta bloccata";

/** Keys that identify or reach the prospect. */
const PII_KEYS = [
  "leadEmail",
  "leadPhone",
  "leadCompany",
  "leadMessage",
  "customerAddress",
  "customerCity",
  "customerPostalCode",
  "signatureDataUrl",
  "signedByName",
  "sourceIpHash",
  "sourceOrigin",
  "userAgent",
] as const;

/** Locked for either reason: over the monthly cap, or received while suspended. */
export function isQuotaLocked(quote: Pick<Doc<"quoteRequests">, "quotaLocked" | "suspendedLocked">): boolean {
  return quote.quotaLocked === true || quote.suspendedLocked === true;
}

/** Display name for notifications / triggers that only carry the lead name. */
export function lockedSafeLeadName(quote: Pick<Doc<"quoteRequests">, "quotaLocked" | "suspendedLocked" | "leadName">): string {
  return isQuotaLocked(quote) ? LOCKED_LEAD_NAME : quote.leadName;
}

/** Returns the request as the tenant may see it — unchanged unless quota-locked. */
export function redactQuoteRequest<T extends Doc<"quoteRequests">>(quote: T): T {
  if (!isQuotaLocked(quote)) return quote;
  const out: Record<string, unknown> = { ...quote, leadName: LOCKED_LEAD_NAME, leadEmail: "" };
  for (const key of PII_KEYS) {
    if (key !== "leadEmail") delete out[key];
  }
  return out as T;
}
