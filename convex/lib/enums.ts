export const PLAN_TIERS = ["starter", "business", "enterprise", "alpha"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_STATUSES = ["active", "trialing", "past_due", "suspended"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "invited", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CONFIGURATOR_STATUSES = ["draft", "published", "archived"] as const;
export type ConfiguratorStatus = (typeof CONFIGURATOR_STATUSES)[number];

export const QUOTE_STATUSES = ["new", "contacted", "quoted", "won", "lost", "spam"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "quote_request_new",
  "quote_status_changed",
  "member_joined",
  "configurator_published",
  "system"
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const EMAIL_TEMPLATES = [
  "verify",
  "reset",
  "welcome_alpha",
  "welcome",
  "new_quote_request",
  "admin_resend"
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export const AUDIT_ACTIONS = [
  "seat.claim",
  "registration.toggle",
  "seatCap.raise",
  "tenant.suspend",
  "configurator.publish",
  "quote.create",
  "quote.price_mismatch"
] as const;

export const PRODUCT_TYPES = ["window", "balconyDoor"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const HARDWARE_KINDS = [
  "hardware",
  "hardwareColor",
  "sashType",
  "screen",
  "threshold",
  "misc"
] as const;