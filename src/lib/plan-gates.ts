import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Sections whose whole page is plan-gated. Mirrors the server-side checks
 * (`enforceAnalytics`, `enforceShowroomCalculator`) — the server stays the
 * source of truth; this only decides what the UI shows. Sub-features inside a
 * page (e-signature, white-label…) are gated by their own server checks.
 */
export type GatedFeature = "analytics" | "showroom";

export const ROUTE_GATES: { prefix: string; feature: GatedFeature; requiredPlan: string }[] = [
  { prefix: "/app/analytics", feature: "analytics", requiredPlan: "Pro" },
  { prefix: "/app/showroom", feature: "showroom", requiredPlan: "Agency" },
];

export function gateForPath(pathname: string) {
  return ROUTE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/")) ?? null;
}

type Ent = { analytics: "none" | "basic" | "advanced"; showroomCalculator: boolean };

export function isFeatureUnlocked(feature: GatedFeature, ent: Ent): boolean {
  return feature === "analytics" ? ent.analytics !== "none" : ent.showroomCalculator;
}

/** `undefined` while loading; afterwards the plan name + which features are locked. */
export function usePlanAccess(tenantId: Id<"tenants">) {
  const state = useQuery(api.billing.getBillingState, { tenantId });
  if (state === undefined) return undefined;
  if (state === null) return null;
  return {
    plan: state.plan,
    isLocked: (feature: GatedFeature) => !isFeatureUnlocked(feature, state.entitlements),
  };
}
