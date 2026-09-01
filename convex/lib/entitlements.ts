import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Single source of truth for what each plan is allowed to do. Server-side only.
 * Never trust a plan / entitlement value coming from the client — always
 * resolve it from the tenant document via `resolveTenantEntitlements`.
 *
 * Numbers reference the verified public pricing page:
 *   Starter  — 1 configurator, 50 requests/month, OneSpec badge required
 *   Business — 3 configurators, 300 requests/month, white-label + advanced
 *   Enterprise — unlimited, custom domain, API/CRM, multi-site import
 *   Alpha    — Business entitlements + locked 15% lifetime discount
 */

export type PlanKey = "starter" | "business" | "enterprise" | "alpha";

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
  analytics: "basic" | "advanced";
  /** Guided CSV/XLSX price-list import. */
  csvImport: boolean;
  /** Bulk multi-site import (Enterprise onboarding). */
  bulkImportMultiSite: boolean;
  customDomain: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  /** Locked lifetime discount percentage (Alpha = 15, else 0). */
  lifetimeDiscountPct: number;
}

const STARTER: Entitlements = {
  maxConfigurators: 1,
  maxQuotesPerMonth: 50,
  maxTeamMembers: 2,
  whiteLabel: false,
  advancedPricingRules: false,
  multiCatalog: false,
  analytics: "basic",
  csvImport: true,
  bulkImportMultiSite: false,
  customDomain: false,
  apiAccess: false,
  prioritySupport: false,
  lifetimeDiscountPct: 0,
};

const BUSINESS: Entitlements = {
  ...STARTER,
  maxConfigurators: 3,
  maxQuotesPerMonth: 300,
  maxTeamMembers: 10,
  whiteLabel: true,
  advancedPricingRules: true,
  multiCatalog: true,
  analytics: "advanced",
  prioritySupport: true,
};

const ENTERPRISE: Entitlements = {
  ...BUSINESS,
  maxConfigurators: Infinity,
  maxQuotesPerMonth: Infinity,
  maxTeamMembers: Infinity,
  bulkImportMultiSite: true,
  customDomain: true,
  apiAccess: true,
};

const ALPHA: Entitlements = {
  ...BUSINESS,
  lifetimeDiscountPct: 15,
};

const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  starter: STARTER,
  business: BUSINESS,
  enterprise: ENTERPRISE,
  alpha: ALPHA,
};

export function entitlementsFor(plan: string): Entitlements {
  return PLAN_ENTITLEMENTS[plan as PlanKey] ?? STARTER;
}

/** Resolve the effective entitlements for a tenant document. */
export function resolveTenantEntitlements(tenant: Doc<"tenants">): Entitlements {
  const base = entitlementsFor(tenant.plan);
  // Alpha members keep white-label + discount even if the stored plan drifts.
  if (tenant.isAlpha) {
    return { ...base, whiteLabel: true, lifetimeDiscountPct: Math.max(base.lifetimeDiscountPct, 15) };
  }
  return base;
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
