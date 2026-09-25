import { ConvexError } from "convex/values";
import * as Sentry from "@sentry/nextjs";

/**
 * Turn anything a Convex call can throw into a user-facing message key.
 *
 * Why this exists: pages used `e instanceof Error ? e.message : "Errore"`, and
 * for a server crash the message is the raw
 *   "[CONVEX M(passports:generateFundingDoc)] [Request ID: …] Server Error"
 * — meaningless to a user and leaks internals. Only errors the backend threw
 * on purpose (ConvexError carrying a stable code) get a specific message;
 * everything else becomes a generic one and is reported to Sentry instead of
 * being shown.
 */
export type ErrorKey =
  | "generic"
  | "unauthenticated"
  | "forbidden"
  | "notFound"
  | "planRequired"
  | "quotaExceeded"
  | "planSuspended"
  | "planPastDue"
  | "subscriptionRequired"
  | "planSelectionRequired"
  | "planUpgradeRequired"
  | "rateLimited"
  | "invalidInput"
  | "nameRequired"
  | "alreadySigned"
  | "reportLocked"
  | "cannotDeleteSigned"
  | "fundingNeedsQuote"
  | "noPublishedVersion"
  | "noItems"
  | "surveyNotCompleted"
  | "surveyAlreadyLinked"
  | "clientMismatch"
  | "tenantMismatch"
  | "emailNotVerified"
  | "registrationClosed"
  | "soleOwner"
  | "billingNotConfigured"
  | "signatureInvalid"
  | "imageType"
  | "imageTooLarge"
  | "alreadyMember"
  | "alreadyInvited"
  | "alreadyHasTenant"
  | "inviteMismatch"
  | "inviteInvalid"
  | "invalidEmail"
  | "cannotRemoveOwner"
  | "dpaVersion"
  | "companyIncomplete"
  | "offline";

const EXACT: Record<string, ErrorKey> = {
  UNAUTHENTICATED: "unauthenticated",
  NOT_A_MEMBER: "forbidden",
  INSUFFICIENT_ROLE: "forbidden",
  OWNER_ONLY: "forbidden",
  NOT_PLATFORM_ADMIN: "forbidden",
  NOT_FOUND: "notFound",
  PLAN_SUSPENDED: "planSuspended",
  PLAN_PAST_DUE: "planPastDue",
  SUBSCRIPTION_REQUIRED: "subscriptionRequired",
  PLAN_SELECTION_REQUIRED: "planSelectionRequired",
  PLAN_UPGRADE_REQUIRED: "planUpgradeRequired",
  RATE_LIMITED: "rateLimited",
  EXPORT_RATE_LIMITED: "rateLimited",
  CUSTOMER_NAME_REQUIRED: "nameRequired",
  INVALID_NAME: "nameRequired",
  SIGNER_NAME_REQUIRED: "nameRequired",
  ALREADY_SIGNED: "alreadySigned",
  REPORT_LOCKED: "reportLocked",
  CANNOT_DELETE_SIGNED: "cannotDeleteSigned",
  FUNDING_NEEDS_QUOTE: "fundingNeedsQuote",
  PASSPORT_NO_QUOTE: "fundingNeedsQuote",
  NO_PUBLISHED_VERSION: "noPublishedVersion",
  NO_CATALOG_VERSION: "noPublishedVersion",
  NO_ITEMS: "noItems",
  SURVEY_NOT_COMPLETED: "surveyNotCompleted",
  SURVEY_ALREADY_LINKED: "surveyAlreadyLinked",
  CANTIERE_CLIENT_MISMATCH: "clientMismatch",
  TENANT_MISMATCH: "tenantMismatch",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  REGISTRATION_CLOSED: "registrationClosed",
  SOLE_OWNER_MUST_TRANSFER_FIRST: "soleOwner",
  BILLING_NOT_CONFIGURED: "billingNotConfigured",
  BILLING_PRICE_NOT_CONFIGURED: "billingNotConfigured",
  NO_SUBSCRIPTION: "billingNotConfigured",
  INVALID_SIGNATURE: "signatureInvalid",
  SIGNATURE_TOO_LARGE: "signatureInvalid",
  UNSUPPORTED_IMAGE_TYPE: "imageType",
  IMAGE_TOO_LARGE: "imageTooLarge",
  ALREADY_MEMBER: "alreadyMember",
  ALREADY_INVITED: "alreadyInvited",
  ALREADY_HAS_TENANT: "alreadyHasTenant",
  INVITATION_EMAIL_MISMATCH: "inviteMismatch",
  INVITATION_EXPIRED: "inviteInvalid",
  INVITATION_USED: "inviteInvalid",
  INVALID_EMAIL: "invalidEmail",
  CANNOT_REMOVE_OWNER: "cannotRemoveOwner",
  DPA_VERSION_MISMATCH: "dpaVersion",
  COMPANY_PROFILE_INCOMPLETE: "companyIncomplete",
};

/** Map a backend error code to a message key (pattern fallbacks for families). */
export function keyForCode(code: string): ErrorKey {
  if (EXACT[code]) return EXACT[code];
  if (/_QUOTA_EXCEEDED$/.test(code)) return "quotaExceeded";
  if (/_NOT_ALLOWED$/.test(code)) return "planRequired";
  if (/_NOT_FOUND$/.test(code)) return "notFound";
  if (/^INVALID_|^UNKNOWN_/.test(code)) return "invalidInput";
  return "generic";
}

/** Pull the deliberate error code out of a thrown value, if there is one. */
export function errorCode(e: unknown): string | null {
  if (e instanceof ConvexError) {
    const d = e.data as unknown;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "code" in d && typeof (d as { code: unknown }).code === "string") {
      return (d as { code: string }).code;
    }
  }
  return null;
}

export function errorKey(e: unknown): ErrorKey {
  const code = errorCode(e);
  if (code) return keyForCode(code);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "generic";
}

/**
 * Message for the user + side effects: an error the backend did NOT throw on
 * purpose (a crash, a network failure) is reported to Sentry so it is fixed
 * rather than shown.
 */
export function friendlyError(e: unknown, t: (key: ErrorKey) => string): string {
  const key = errorKey(e);
  if (!errorCode(e)) {
    try {
      Sentry.captureException(e);
    } catch {
      /* reporting must never break the UI */
    }
    console.error(e);
  }
  return t(key);
}

const MASKED_SERVER_ERROR = /\[CONVEX|Request ID|Server Error|Uncaught/i;

/**
 * True for the opaque "[CONVEX ...] [Request ID: …] Server Error" text Convex
 * substitutes for a real message in production. A wrong email or password
 * throws through this same generic error, so it looks exactly like a crash —
 * and the request ID is unique per attempt, so reporting it to error tracking
 * as-is opens a brand-new issue for every mistyped password instead of
 * grouping them.
 */
export function isMaskedServerError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return m !== "" && MASKED_SERVER_ERROR.test(m);
}

/**
 * Auth actions throw plain Errors; in production Convex hides their text behind
 * "[CONVEX A(auth:signIn)] [Request ID: …] Server Error". Show the message only
 * when it is a real, readable one, otherwise the page's own fallback.
 */
export function authErrorMessage(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (!m || isMaskedServerError(e)) return fallback;
  return m;
}
