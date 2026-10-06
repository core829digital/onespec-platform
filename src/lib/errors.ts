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
  | "configuratorHasRequests"
  | "priceZoneRequired"
  | "validationRequired"
  | "validationTooShort"
  | "validationTooLong"
  | "validationInvalidChars"
  | "validationVatFormat"
  | "validationVatChecksum"
  | "validationVatPrefix"
  | "validationPostalFormat"
  | "validationPhoneFormat"
  | "validationEmailFormat"
  | "validationUrlFormat"
  | "validationCountryUnsupported"
  | "vatZeroNotAllowed"
  | "vatManualReasonRequired"
  | "viesUnavailable"
  | "onboardingIncomplete"
  | "viesAckRequired"
  | "supplyInvalidAmount"
  | "supplyPartnerRoleRequired"
  | "supplyPartnerNotFound"
  | "supplyPartnerArchived"
  | "supplyPartnerWrongRole"
  | "supplyNotFound"
  | "supplyQuoteNotUsable"
  | "supplyAlreadyExists"
  | "supplyAlreadyDelivered"
  | "supplyCannotRevert"
  | "supplyCannotDelete"
  | "supplyStageTooEarly"
  | "qualityInUse"
  | "profileQualityUnknown"
  | "invalidCombination"
  | "fundingNeedsQuote"
  | "noPublishedVersion"
  | "noItems"
  | "surveyNotCompleted"
  | "surveyAlreadyLinked"
  | "clientMismatch"
  | "signatureEmpty"
  | "supplyDeliveryStockMoved"
  | "supplyDeliveryExists"
  | "cantiereHasLogistics"
  | "teamNotFound"
  | "teamNameInvalid"
  | "teamLimit"
  | "teamNameTaken"
  | "gradeInvalid"
  | "joinNotFound"
  | "joinUsed"
  | "joinExpired"
  | "joinLocked"
  | "joinCodeWrong"
  | "joinPasswordWrong"
  | "joinNameRequired"
  | "joinConsentRequired"
  | "joinOtherCompany"
  | "tenantMismatch"
  | "emailNotVerified"
  | "registrationClosed"
  | "soleOwner"
  | "billingNotConfigured"
  | "signatureInvalid"
  | "imageType"
  | "imageTooLarge"
  | "fileType"
  | "fileTooLarge"
  | "alreadyMember"
  | "alreadyInvited"
  | "alreadyHasTenant"
  | "inviteMismatch"
  | "inviteInvalid"
  | "invalidEmail"
  | "cannotRemoveOwner"
  | "dpaVersion"
  | "companyIncomplete"
  | "offline"
  | "supplierHasDeliveries"
  | "carrierHasDeliveries"
  | "cannotDeleteReceivedDelivery"
  | "deliveryCancelled"
  | "pdfQuotaExceeded"
  | "whatsappQuotaExceeded"
  | "showroomQuotaExceeded"
  | "quoteLocked"
  | "quoteIsDraft"
  | "quoteHasSupply"
  | "alreadySubscribed"
  | "annualNotAvailable"
  | "teamExceedsTargetPlan"
  | "useMarkReceived"
  | "alreadyUndone"
  | "noTenant"
  | "billingUseCheckout"
  | "cannotComputeUw"
  | "fieldRequired"
  | "referralsDisabled"
  | "subscriptionMismatch"
  | "cantiereUpdateFailed"
  | "guestPinCollision"
  | "referralCodeUnavailable"
  | "referralNotEligible"
  | "assigneeNotMember"
  | "tooManyItems"
  | "inventoryNotAvailable"
  | "deliveryNotEditable"
  | "mediaLimit"
  | "checklistIncomplete"
  | "notInTransit"
  | "alreadyDelivered"
  | "cannotDeleteActiveDelivery"
  | "turnstileFailed"
  | "uploadFailed"
  | "noSupplierLines"
  | "quoteCreateFailed";

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
  CONFIGURATOR_HAS_REQUESTS: "configuratorHasRequests",
  PRICE_ZONE_REQUIRED: "priceZoneRequired",
  VALIDATION_REQUIRED: "validationRequired",
  VALIDATION_TOO_SHORT: "validationTooShort",
  VALIDATION_TOO_LONG: "validationTooLong",
  VALIDATION_INVALID_CHARS: "validationInvalidChars",
  VALIDATION_VAT_FORMAT: "validationVatFormat",
  VALIDATION_VAT_CHECKSUM: "validationVatChecksum",
  VALIDATION_VAT_PREFIX: "validationVatPrefix",
  VALIDATION_POSTAL_FORMAT: "validationPostalFormat",
  VALIDATION_PHONE_FORMAT: "validationPhoneFormat",
  VALIDATION_EMAIL_FORMAT: "validationEmailFormat",
  VALIDATION_URL_FORMAT: "validationUrlFormat",
  VALIDATION_COUNTRY_UNSUPPORTED: "validationCountryUnsupported",
  VAT_ZERO_NOT_ALLOWED: "vatZeroNotAllowed",
  VAT_MANUAL_REASON_REQUIRED: "vatManualReasonRequired",
  VIES_UNAVAILABLE: "viesUnavailable",
  ONBOARDING_INCOMPLETE: "onboardingIncomplete",
  VIES_ACK_REQUIRED: "viesAckRequired",
  SUPPLY_INVALID_AMOUNT: "supplyInvalidAmount",
  SUPPLY_PARTNER_ROLE_REQUIRED: "supplyPartnerRoleRequired",
  SUPPLY_PARTNER_NOT_FOUND: "supplyPartnerNotFound",
  SUPPLY_PARTNER_ARCHIVED: "supplyPartnerArchived",
  SUPPLY_PARTNER_WRONG_ROLE: "supplyPartnerWrongRole",
  SUPPLY_NOT_FOUND: "supplyNotFound",
  SUPPLY_QUOTE_NOT_USABLE: "supplyQuoteNotUsable",
  SUPPLY_ALREADY_EXISTS: "supplyAlreadyExists",
  SUPPLY_ALREADY_DELIVERED: "supplyAlreadyDelivered",
  SUPPLY_CANNOT_REVERT: "supplyCannotRevert",
  SUPPLY_CANNOT_DELETE: "supplyCannotDelete",
  SUPPLY_STAGE_TOO_EARLY: "supplyStageTooEarly",
  SUPPLY_DELIVERY_STOCK_MOVED: "supplyDeliveryStockMoved",
  SUPPLY_DELIVERY_EXISTS: "supplyDeliveryExists",
  CANTIERE_HAS_LOGISTICS: "cantiereHasLogistics",
  TEAM_NOT_FOUND: "teamNotFound",
  TEAM_NAME_INVALID: "teamNameInvalid",
  TEAM_LIMIT_REACHED: "teamLimit",
  TEAM_NAME_TAKEN: "teamNameTaken",
  GRADE_INVALID: "gradeInvalid",
  JOIN_NOT_FOUND: "joinNotFound",
  JOIN_USED: "joinUsed",
  JOIN_EXPIRED: "joinExpired",
  JOIN_LOCKED: "joinLocked",
  JOIN_CODE_WRONG: "joinCodeWrong",
  JOIN_PASSWORD_WRONG: "joinPasswordWrong",
  JOIN_NAME_REQUIRED: "joinNameRequired",
  JOIN_CONSENT_REQUIRED: "joinConsentRequired",
  JOIN_OTHER_COMPANY: "joinOtherCompany",
  QUALITY_IN_USE: "qualityInUse",
  PROFILE_QUALITY_UNKNOWN: "profileQualityUnknown",
  INVALID_COMBINATION: "invalidCombination",
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
  SIGNATURE_EMPTY: "signatureEmpty",
  SIGNATURE_TOO_LARGE: "signatureInvalid",
  UNSUPPORTED_IMAGE_TYPE: "imageType",
  IMAGE_TOO_LARGE: "imageTooLarge",
  UNSUPPORTED_FILE_TYPE: "fileType",
  FILE_TOO_LARGE: "fileTooLarge",
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
  SUPPLIER_HAS_DELIVERIES: "supplierHasDeliveries",
  CARRIER_HAS_DELIVERIES: "carrierHasDeliveries",
  CANNOT_DELETE_RECEIVED_DELIVERY: "cannotDeleteReceivedDelivery",
  DELIVERY_CANCELLED: "deliveryCancelled",
  PDF_QUOTA_EXCEEDED: "pdfQuotaExceeded",
  WHATSAPP_QUOTA_EXCEEDED: "whatsappQuotaExceeded",
  SHOWROOM_QUOTE_QUOTA_EXCEEDED: "showroomQuotaExceeded",
  SHOWROOM_PDF_QUOTA_EXCEEDED: "showroomQuotaExceeded",
  SHOWROOM_WHATSAPP_QUOTA_EXCEEDED: "showroomQuotaExceeded",
  QUOTE_LOCKED: "quoteLocked",
  QUOTE_NOT_EDITABLE: "quoteLocked",
  QUOTE_ALREADY_SIGNED: "alreadySigned",
  QUOTE_SIGNED: "cannotDeleteSigned",
  QUOTE_IS_DRAFT: "quoteIsDraft",
  QUOTE_HAS_SUPPLY: "quoteHasSupply",
  ALREADY_SUBSCRIBED: "alreadySubscribed",
  ANNUAL_NOT_AVAILABLE: "annualNotAvailable",
  TEAM_EXCEEDS_TARGET_PLAN: "teamExceedsTargetPlan",
  MEMBER_LIMIT_REACHED: "quotaExceeded",
  USE_MARK_RECEIVED: "useMarkReceived",
  ALREADY_UNDONE: "alreadyUndone",
  NO_TENANT: "noTenant",
  BILLING_LIVE_USE_CHECKOUT: "billingUseCheckout",
  CANNOT_COMPUTE_UW: "cannotComputeUw",
  LABEL_REQUIRED: "fieldRequired",
  MESSAGE_REQUIRED: "fieldRequired",
  NAME_REQUIRED: "nameRequired",
  REFERRALS_DISABLED: "referralsDisabled",
  NO_SUBSCRIPTION_ITEM: "subscriptionMismatch",
  SUBSCRIPTION_MISMATCH: "subscriptionMismatch",
  CANTIERE_UPDATE_FAILED: "cantiereUpdateFailed",
  GUEST_PIN_COLLISION: "guestPinCollision",
  REFERRAL_CODE_UNAVAILABLE: "referralCodeUnavailable",
  REFERRAL_NOT_ELIGIBLE: "referralNotEligible",
  ASSIGNEE_NOT_A_MEMBER: "assigneeNotMember",
  TOO_MANY_ITEMS: "tooManyItems",
  INVENTORY_ITEM_NOT_AVAILABLE: "inventoryNotAvailable",
  SITE_DELIVERY_NOT_EDITABLE: "deliveryNotEditable",
  ITEM_INDEX_OUT_OF_RANGE: "invalidInput",
  UNSUPPORTED_MEDIA_TYPE: "fileType",
  MEDIA_LIMIT_REACHED: "mediaLimit",
  CHECKLIST_INCOMPLETE: "checklistIncomplete",
  NOT_IN_TRANSIT: "notInTransit",
  ALREADY_DELIVERED: "alreadyDelivered",
  CANNOT_DELETE_ACTIVE_DELIVERY: "cannotDeleteActiveDelivery",
  TURNSTILE_FAILED: "turnstileFailed",
  UPLOAD_FAILED: "uploadFailed",
  NO_SUPPLIER_LINES: "noSupplierLines",
  QUOTE_CREATE_FAILED: "quoteCreateFailed",
  INVALID_SIGNATURE_FORMAT: "signatureInvalid",
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

/**
 * Auth actions throw plain Errors; in production Convex hides their text behind
 * "[CONVEX A(auth:signIn)] [Request ID: …] Server Error". Show the message only
 * when it is a real, readable one, otherwise the page's own fallback.
 */
export function authErrorMessage(e: unknown, fallback: string, t?: (key: ErrorKey) => string): string {
  // A deliberate, coded error (bot check failed, rate limit, ...) gets its own message.
  const code = errorCode(e);
  if (code && t) {
    const key = keyForCode(code);
    if (key !== "generic") return t(key);
  }
  const m = e instanceof Error ? e.message : "";
  if (!m || /\[CONVEX|Request ID|Server Error|Uncaught/i.test(m)) return fallback;
  return m;
}
