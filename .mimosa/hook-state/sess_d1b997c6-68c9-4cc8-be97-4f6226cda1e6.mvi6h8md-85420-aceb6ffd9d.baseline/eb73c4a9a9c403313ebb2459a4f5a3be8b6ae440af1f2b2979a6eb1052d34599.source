import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Single source of truth for what each plan is allowed to do. Server-side only.
 * Never trust a plan / entitlement value coming from the client — always
 * resolve it from the tenant document via `resolveTenantEntitlements`.
 *
 * Plan ladder v2 (2026-09-22, per signed SaaS contracts — Base/Pro/Agency/Enterprise):
 *   Base       — solo installer: field quotes (capped), Rilievo, no public widget
 *   Pro        — "Widget WhiteLabel": public embeddable widget + white-label,
 *                unlimited quotes, e-signature, advances, full fiscal engine + ENEA
 *   Agency     — "MultiBrand": multi-catalog at scale, multi-supplier aggregator,
 *                in-app 3-zone showroom calculator, bulk import
 *   Enterprise — "API": everything + API/CRM, GAEB export, custom domain, dedicated support
 *
 * Display names: Level 1 / Level 2 / Level 3 (keys essentials / essentials_plus / max).
 * Widget-first ladder (2026-09-29, sold before the full platform — see
 * docs/PIANO_ABBONAMENTI_WIDGET.md):
 *   Essentials  (€49,95) — public widget, 40 requests/15 PDF/40 WhatsApp, 1 configurator
 *   Essentials+ (€62,44) — Essentials ×2 + showroom quoter + white-label, 3 configurators
 *   Max         (€79,90) — Essentials ×5 + logistics + white-label, 10 configurators
 * Every platform module outside the widget stays locked on these plans
 * (`module*` flags), and every metered action has its own monthly cap
 * (`max*PerMonth`). For the full-platform plans every `module*` flag is on and
 * every new `max*PerMonth` is Infinity, so their access is unchanged
 * ("Non modificare accessi" — pinned by tests/convex/entitlements-legacy-freeze).
 *
 * "starter"/"showroom" are the pre-v2 plan keys, kept resolvable here until
 * `migrations.renamePlansToV2` has run on every deployment (starter→base,
 * showroom→enterprise — see that migration for the mapping rationale).
 */

export type PlanKey =
  | "base" | "pro" | "agency" | "enterprise"
  | "essentials" | "essentials_plus" | "max"
  | "starter" | "showroom";

export type SupportTier = "email" | "priority" | "dedicated";

export interface Entitlements {
  /** Non-archived configurators. `Infinity` = unlimited. */
  maxConfigurators: number;
  /** Quote requests accepted per calendar month. `Infinity` = unlimited. */
  maxQuotesPerMonth: number;
  /** Active tenant members. `Infinity` = unlimited. */
  maxTeamMembers: number;
  /** Full branding + remove the "Powered by OneSpec" badge from the widget. */
  whiteLabel: boolean;
  /** Priority/effective-date pricing rules in the catalog editor. */
  advancedPricingRules: boolean;
  /** More than one price list per configurator. */
  multiCatalog: boolean;
  analytics: "none" | "basic" | "advanced";
  /** Guided CSV/XLSX price-list import. */
  csvImport: boolean;
  /** Bulk multi-site import (Enterprise onboarding). */
  bulkImportMultiSite: boolean;
  customDomain: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  /**
   * Opt-in transparent widget mode for lead-gen markets (IT/FR/BE/DE/LU): show a
   * real price breakdown + firm-order / measurement request. NL is always
   * transparent by region policy regardless of plan; this flag is the future
   * per-configurator opt-in for the other markets.
   */
  transparentWidget: boolean;
  /** Which field modules the tenant may use. */
  fieldModules: "rilievo_only" | "full";
  /** Fiscal engine depth: basic = single default VAT rate; full = Beni
   * Significativi, reduced rates, ENEA / funding declarations. */
  fiscalEngine: "basic" | "full";
  /** Electronic signature on quotes (tablet). */
  eSignature: boolean;
  /** Advance invoices (acconto / acompte). */
  advanceInvoices: boolean;
  /** Yearly maintenance contracts on passports. */
  maintenanceContracts: boolean;
  /** Multi-supplier aggregator (supplier directory + supplier lines). */
  multiSupplierAggregator: boolean;
  /** In-app 3-zone showroom calculator. */
  showroomCalculator: boolean;
  /** Public embeddable B2C widget (/w/[publicId]). */
  publicWidget: boolean;
  /** GAEB/DATANORM export (DE official renovations). */
  gaebExport: boolean;
  /** CRM / stock API integration. */
  crmIntegration: boolean;
  support: SupportTier;
  /** Annual billing offered (2 months free). Enterprise/Showroom are sales-led. */
  annualBilling: boolean;
  /** Self-serve Stripe checkout available. */
  selfServeCheckout: boolean;
  /** Eligible for the 14-day Pro trial. */
  trialEligible: boolean;
  /** Logistics module: delivery suppliers a tenant may register. `Infinity` = unlimited. */
  maxLogisticsSuppliers: number;
  /** Logistics module: carriers a tenant may register. `Infinity` = unlimited. */
  maxCarriers: number;

  /* --- Widget-first ladder. Legacy plans: every module on, every cap Infinity. --- */

  /** Preventivi B2B: field quotes created by the installer + e-signature flow. */
  moduleFieldQuotes: boolean;
  /** Clienti + Trattative (CRM). */
  moduleCrm: boolean;
  /** Cantieri (job sites). */
  moduleCantieri: boolean;
  /** Rilievi, Posa, Collaudi, Fascicoli QR. */
  moduleFieldOps: boolean;
  /** Logistica (delivery suppliers, carriers, shipments). */
  moduleLogistics: boolean;
  /** Widget-request PDFs the installer may download per month. */
  maxPdfExportsPerMonth: number;
  /** Widget requests the installer may send to the customer on WhatsApp per month. */
  maxWhatsappSendsPerMonth: number;
  /** Showroom quotes registered per month. */
  maxShowroomQuotesPerMonth: number;
  /** Showroom-quote PDFs per month. */
  maxShowroomPdfPerMonth: number;
  /** Showroom quotes sent on WhatsApp per month. */
  maxShowroomWhatsappPerMonth: number;
}

/** Every module on, every widget-ladder cap unlimited — mixed into the legacy plans. */
const LEGACY_MODULES = {
  moduleFieldQuotes: true,
  moduleCrm: true,
  moduleCantieri: true,
  moduleFieldOps: true,
  moduleLogistics: true,
  maxPdfExportsPerMonth: Infinity,
  maxWhatsappSendsPerMonth: Infinity,
  maxShowroomQuotesPerMonth: Infinity,
  maxShowroomPdfPerMonth: Infinity,
  maxShowroomWhatsappPerMonth: Infinity,
} satisfies Partial<Entitlements>;

const BASE: Entitlements = {
  maxConfigurators: 1,
  maxQuotesPerMonth: 20,
  maxTeamMembers: 2,
  whiteLabel: false,
  advancedPricingRules: false,
  multiCatalog: false,
  analytics: "none",
  csvImport: true,
  bulkImportMultiSite: false,
  customDomain: false,
  apiAccess: false,
  prioritySupport: false,
  transparentWidget: false,
  fieldModules: "rilievo_only",
  fiscalEngine: "basic",
  eSignature: false,
  advanceInvoices: false,
  maintenanceContracts: false,
  multiSupplierAggregator: false,
  showroomCalculator: false,
  publicWidget: false,
  gaebExport: false,
  crmIntegration: false,
  support: "email",
  annualBilling: true,
  selfServeCheckout: true,
  trialEligible: false,
  maxLogisticsSuppliers: 1,
  maxCarriers: 1,
  ...LEGACY_MODULES,
};

const PRO: Entitlements = {
  ...BASE,
  maxConfigurators: 3,
  maxQuotesPerMonth: Infinity,
  maxTeamMembers: 5,
  maxLogisticsSuppliers: 3,
  maxCarriers: 3,
  whiteLabel: true,
  advancedPricingRules: true,
  multiCatalog: true,
  analytics: "basic",
  prioritySupport: true,
  transparentWidget: true,
  fieldModules: "full",
  fiscalEngine: "full",
  eSignature: true,
  advanceInvoices: true,
  maintenanceContracts: true,
  support: "priority",
  trialEligible: true,
  // "Widget WhiteLabel" contract tier: public embeddable widget unlocks here.
  publicWidget: true,
};

const AGENCY: Entitlements = {
  ...PRO,
  maxConfigurators: 10,
  maxTeamMembers: 15,
  maxQuotesPerMonth: 1000,
  analytics: "advanced",
  bulkImportMultiSite: true,
  multiSupplierAggregator: true,
  showroomCalculator: true,
  support: "dedicated",
  annualBilling: false,
  maxLogisticsSuppliers: 10,
  maxCarriers: 10,
};

const ENTERPRISE: Entitlements = {
  ...AGENCY,
  maxConfigurators: Infinity,
  maxQuotesPerMonth: Infinity,
  maxTeamMembers: Infinity,
  maxLogisticsSuppliers: Infinity,
  maxCarriers: Infinity,
  customDomain: true,
  apiAccess: true,
  gaebExport: true,
  crmIntegration: true,
  selfServeCheckout: false,
};

/** Founding/full-access: everything on, every numeric limit Infinity. */
const FULL_ACCESS: Entitlements = {
  ...ENTERPRISE,
  maxConfigurators: Infinity,
  maxQuotesPerMonth: Infinity,
  maxTeamMembers: Infinity,
  whiteLabel: true,
  advancedPricingRules: true,
  multiCatalog: true,
  analytics: "advanced",
  csvImport: true,
  bulkImportMultiSite: true,
  customDomain: true,
  apiAccess: true,
  prioritySupport: true,
  transparentWidget: true,
  fieldModules: "full",
  fiscalEngine: "full",
  eSignature: true,
  advanceInvoices: true,
  maintenanceContracts: true,
  multiSupplierAggregator: true,
  showroomCalculator: true,
  publicWidget: true,
  gaebExport: true,
  crmIntegration: true,
  support: "dedicated",
  annualBilling: true,
  selfServeCheckout: true,
  trialEligible: false,
  maxLogisticsSuppliers: Infinity,
  maxCarriers: Infinity,
  ...LEGACY_MODULES,
};

/**
 * Widget-first ladder. Essentials+ and Max are "Essentials × N" on every
 * metered cap (the configurator count is set per plan, not multiplied).
 */
export const WIDGET_PLAN_MULTIPLIER = { essentials: 1, essentials_plus: 2, max: 5 } as const;

const ESSENTIALS_CAPS = {
  maxQuotesPerMonth: 40,
  maxPdfExportsPerMonth: 15,
  maxWhatsappSendsPerMonth: 40,
} as const;

function widgetCaps(multiplier: number, showroom: boolean) {
  return {
    maxQuotesPerMonth: ESSENTIALS_CAPS.maxQuotesPerMonth * multiplier,
    maxPdfExportsPerMonth: ESSENTIALS_CAPS.maxPdfExportsPerMonth * multiplier,
    maxWhatsappSendsPerMonth: ESSENTIALS_CAPS.maxWhatsappSendsPerMonth * multiplier,
    // The showroom quoter carries the same caps as the widget ("stessi limiti").
    maxShowroomQuotesPerMonth: showroom ? ESSENTIALS_CAPS.maxQuotesPerMonth * multiplier : 0,
    maxShowroomPdfPerMonth: showroom ? ESSENTIALS_CAPS.maxPdfExportsPerMonth * multiplier : 0,
    maxShowroomWhatsappPerMonth: showroom ? ESSENTIALS_CAPS.maxWhatsappSendsPerMonth * multiplier : 0,
  };
}

const ESSENTIALS: Entitlements = {
  ...BASE,
  ...widgetCaps(WIDGET_PLAN_MULTIPLIER.essentials, false),
  maxConfigurators: 1,
  maxTeamMembers: 1,
  publicWidget: true,
  // "Powered by OneSpec" stays visible on Essentials; Essentials+ and Max are white-label.
  whiteLabel: false,
  analytics: "none",
  annualBilling: false,
  trialEligible: false,
  showroomCalculator: false,
  moduleFieldQuotes: false,
  moduleCrm: false,
  moduleCantieri: false,
  moduleFieldOps: false,
  moduleLogistics: false,
  maxLogisticsSuppliers: 0,
  maxCarriers: 0,
};

const ESSENTIALS_PLUS: Entitlements = {
  ...ESSENTIALS,
  ...widgetCaps(WIDGET_PLAN_MULTIPLIER.essentials_plus, true),
  maxConfigurators: 3,
  maxTeamMembers: 2,
  showroomCalculator: true,
  // White-label (own branding, no "Powered by OneSpec") from Essentials+ up.
  whiteLabel: true,
};

const MAX: Entitlements = {
  ...ESSENTIALS_PLUS,
  ...widgetCaps(WIDGET_PLAN_MULTIPLIER.max, true),
  maxConfigurators: 10,
  maxTeamMembers: 3,
  moduleLogistics: true,
  maxLogisticsSuppliers: 3,
  maxCarriers: 3,
};

/** Plans of the widget-first ladder (sold first, platform plans listed after). */
export const WIDGET_PLANS = ["essentials", "essentials_plus", "max"] as const;
export type WidgetPlan = (typeof WIDGET_PLANS)[number];
export function isWidgetPlan(plan: string): plan is WidgetPlan {
  return (WIDGET_PLANS as readonly string[]).includes(plan);
}

const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  base: BASE,
  pro: PRO,
  agency: AGENCY,
  enterprise: ENTERPRISE,
  essentials: ESSENTIALS,
  essentials_plus: ESSENTIALS_PLUS,
  max: MAX,
  // Pre-v2 keys, resolvable until `migrations.renamePlansToV2` runs everywhere.
  starter: BASE,
  showroom: ENTERPRISE,
};

export function entitlementsFor(plan: string): Entitlements {
  // "business" is the pre-migration plan key (deploy #1 transition) — it
  // resolves to Pro so not-yet-migrated rows keep working.
  if (plan === "business") return PRO;
  return PLAN_ENTITLEMENTS[plan as PlanKey] ?? BASE;
}

/** Resolve the effective entitlements for a tenant document. */
export function resolveTenantEntitlements(tenant: Doc<"tenants">): Entitlements {
  // Founding/full-access tenants bypass every plan limit.
  if (tenant.unlimitedAccess === true) return { ...FULL_ACCESS };
  const base = entitlementsFor(tenant.plan);
  // Grandfathering: existing Base (ex-Starter) tenants keep 50 quotes/month instead of 20.
  const ent = { ...base };
  if ((tenant.plan === "base" || tenant.plan === "starter") && typeof tenant.quotaOverrideQuotesPerMonth === "number") {
    ent.maxQuotesPerMonth = tenant.quotaOverrideQuotesPerMonth;
  }
  return ent;
}

export type BooleanEntitlementKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/** Hard gate on a boolean entitlement — throws `ConvexError(code)` when off. */
export function assertEntitlement(
  tenant: Doc<"tenants">,
  key: BooleanEntitlementKey,
  code: string,
): void {
  if (resolveTenantEntitlements(tenant)[key] !== true) {
    throw new ConvexError(code);
  }
}

/** Hard gate on a valued entitlement — throws `ConvexError(code)` when the
 * tenant's value is not in the allowed list. */
export function assertEntitlementValue<K extends keyof Entitlements>(
  tenant: Doc<"tenants">,
  key: K,
  allowed: Entitlements[K][],
  code: string,
): void {
  if (!allowed.includes(resolveTenantEntitlements(tenant)[key])) {
    throw new ConvexError(code);
  }
}

export interface QuotaResult {
  allowed: boolean;
  limit: number;
  used: number;
  /** Set once usage crosses 80% of the limit. */
  warning?: string;
}

/**
 * Advisory quota check — returns the numbers, does not throw. Use `assertQuota`
 * when the limit must be a hard boundary (e.g. creating a configurator).
 */
export function checkQuota(used: number, limit: number): QuotaResult {
  if (!Number.isFinite(limit)) return { allowed: true, limit: Infinity, used };
  const allowed = used < limit;
  return {
    allowed,
    limit,
    used,
    warning: used >= limit * 0.8 ? `usage ${used}/${limit}` : undefined,
  };
}

/** Hard quota gate — throws `ConvexError(code)` when `used >= limit`. */
export function assertQuota(used: number, limit: number, code: string): void {
  if (Number.isFinite(limit) && used >= limit) {
    throw new ConvexError(code);
  }
}

/** The calendar-month key (`YYYY-MM`) used for usage counters. */
export function currentPeriod(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}
