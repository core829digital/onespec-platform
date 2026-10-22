import { v } from "convex/values";

/** A Convex validator accepting exactly the values of a const list (the list stays the single source). */
export function literalUnion<T extends readonly [string, ...string[]]>(values: T) {
  return v.union(...values.map((x) => v.literal(x as T[number])));
}

export const PLAN_TIERS = ["base", "pro", "agency", "enterprise"] as const;
/** Widget-first ladder, sold before the full-platform tiers above. */
export const WIDGET_PLAN_TIERS = ["essentials", "essentials_plus", "max"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * Pre-migration rows: "business" (deploy #1, resolves to Pro), "starter"/
 * "showroom" (pre-v2 ladder, resolve to Base/Enterprise) — until
 * `migrations.renamePlansToV2` has run everywhere.
 */
export const LEGACY_PLAN_TIERS = ["business", "starter", "showroom"] as const;
export type LegacyPlanTier = (typeof LEGACY_PLAN_TIERS)[number];

export const PLAN_STATUSES = ["active", "trialing", "past_due", "suspended"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "invited", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CONFIGURATOR_STATUSES = ["draft", "published", "archived"] as const;
export type ConfiguratorStatus = (typeof CONFIGURATOR_STATUSES)[number];

export const QUOTE_STATUSES = ["draft", "new", "contacted", "quoted", "won", "lost", "spam"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const quoteStatusValidator = literalUnion(QUOTE_STATUSES);
export function isQuoteStatus(x: unknown): x is QuoteStatus {
  return typeof x === "string" && (QUOTE_STATUSES as readonly string[]).includes(x);
}

export const INVENTORY_STATUSES = ["in_stock", "assigned", "in_transit", "delivered", "installed"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export const inventoryStatusValidator = literalUnion(INVENTORY_STATUSES);

export const SUPPORT_CONTACT_TOPICS = ["login", "billing", "info", "other"] as const;
export type SupportContactTopic = (typeof SUPPORT_CONTACT_TOPICS)[number];
export function isSupportContactTopic(x: unknown): x is SupportContactTopic {
  return typeof x === "string" && (SUPPORT_CONTACT_TOPICS as readonly string[]).includes(x);
}

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
  "tenant.setPlan",
  "plan.migrate",
  "trial.started",
  "trial.expired",
  "configurator.publish",
  "quote.create",
  "quote.price_mismatch",
  "usage.pdf_export",
  "usage.whatsapp_send",
  "usage.showroom_quote",
  "usage.quota_unlock"
] as const;

export const PRODUCT_TYPES = ["window", "balconyDoor"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Every catalogue hardware row kind; schema.hardwareOptions.kind is built from this list. */
export const HARDWARE_KINDS = [
  "hardware", "hardwareColor", "sashType", "screen", "screenColor", "installation", "poseType",
  "ventilationGrille", "voletRoulant", "warmEdge", "profileDepth", "cornerJoint", "ugTier",
  "colorPreset", "inmeetservice", "sunProtection", "securityClass", "montageSystem", "threshold", "misc",
] as const;
export type HardwareKind = (typeof HARDWARE_KINDS)[number];
export const hardwareKindValidator = literalUnion(HARDWARE_KINDS);