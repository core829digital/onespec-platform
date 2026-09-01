// Back-compat shim. The entitlement source of truth is `./entitlements.ts`.
import { entitlementsFor, resolveTenantEntitlements, checkQuota as checkQ } from "./entitlements";
import type { Doc } from "../_generated/dataModel";

export { entitlementsFor, resolveTenantEntitlements };
export type { Entitlements, PlanKey } from "./entitlements";

/** @deprecated use `resolveTenantEntitlements(tenant).whiteLabel` */
export function hasWhiteLabel(plan: string, isAlpha = false): boolean {
  return isAlpha || entitlementsFor(plan).whiteLabel;
}

/**
 * @deprecated use `assertQuota` from `./entitlements` (hard gate) or
 * `resolveTenantEntitlements` + `checkQuota` (advisory).
 */
export function checkQuota(
  plan: string,
  feature: "quoteRequests" | "activeConfigurators",
  currentUsage: number,
): { allowed: boolean; limit: number; warning?: string } {
  const e = entitlementsFor(plan);
  const limit = feature === "activeConfigurators" ? e.maxConfigurators : e.maxQuotesPerMonth;
  const r = checkQ(currentUsage, limit);
  return { allowed: r.allowed, limit: r.limit, warning: r.warning };
}

export function planQuota(plan: string) {
  const e = entitlementsFor(plan);
  return {
    quoteRequests: e.maxQuotesPerMonth,
    activeConfigurators: e.maxConfigurators,
    whiteLabel: e.whiteLabel,
  };
}

export function tenantWhiteLabel(tenant: Doc<"tenants">): boolean {
  return resolveTenantEntitlements(tenant).whiteLabel;
}
