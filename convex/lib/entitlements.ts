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
 * "starter"/"showroom" are the pre-v2 plan keys, kept resolvable here until
 * `migrations.renamePlansToV2` has run on every deployment (starter→base,
 * showroom→enterprise — see that migration for the mapping rationale).
 */

export type PlanKey = "base" | "pro" | "agency" | "enterprise" | "starter" | "showroom";

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
}

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
};

const PRO: Entitlements = {
  ...BASE,
  maxConfigurators: 3,
  maxQuotesPerMonth: Infinity,
  maxTeamMembers: 5,
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
};

const ENTERPRISE: Entitlements = {
  ...AGENCY,
  maxConfigurators: Infinity,
  maxTeamMembers: Infinity,
  customDomain: true,
  apiAccess: true,
  gaebExport: true,
  crmIntegration: true,
  selfServeCheckout: false,
};

const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  base: BASE,
  pro: PRO,
  agency: AGENCY,
  enterprise: ENTERPRISE,
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
