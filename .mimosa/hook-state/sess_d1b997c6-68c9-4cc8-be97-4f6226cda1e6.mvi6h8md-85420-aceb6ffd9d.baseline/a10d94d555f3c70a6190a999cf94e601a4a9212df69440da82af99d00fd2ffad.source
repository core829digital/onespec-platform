import { useConvexAuth } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Sections whose whole page is plan-gated. Mirrors the server-side checks
 * (`enforceAnalytics`, `enforceShowroomCalculator`, the module* entitlements
 * attached to RBAC permissions) — the server stays the source of truth; this
 * only decides what the UI shows. Sub-features inside a page (e-signature,
 * white-label…) are gated by their own server checks.
 */
export type GatedFeature =
  | "analytics"
  | "showroom"
  | "fieldQuotes"
  | "crm"
  | "cantieri"
  | "fieldOps"
  | "logistics";

/** Plan families: the widget-first ladder is sold first, the full platform after it. */
export const WIDGET_PLAN_KEYS = ["essentials", "essentials_plus", "max"] as const;
export function isWidgetPlanKey(plan: string): boolean {
  return (WIDGET_PLAN_KEYS as readonly string[]).includes(plan);
}

const PLAN_DISPLAY: Record<string, string> = {
  // Display names (2026-09-29): the plan keys stay essentials / essentials_plus / max.
  essentials: "Level 1",
  essentials_plus: "Level 2",
  max: "Level 3",
  base: "Base",
  pro: "Pro",
  agency: "Agency",
  enterprise: "Enterprise",
  starter: "Base",
  showroom: "Enterprise",
  business: "Pro",
};
export function planDisplayName(plan: string): string {
  return PLAN_DISPLAY[plan] ?? plan;
}

interface RouteGate {
  prefix: string;
  feature: GatedFeature;
  /** Lowest full-platform plan that unlocks it. */
  requiredPlan: string;
  /** Lowest widget-first plan that unlocks it; absent = full platform only. */
  requiredWidgetPlan?: string;
}

export const ROUTE_GATES: RouteGate[] = [
  { prefix: "/app/analytics", feature: "analytics", requiredPlan: "Pro" },
  { prefix: "/app/showroom", feature: "showroom", requiredPlan: "Agency", requiredWidgetPlan: "Level 2" },
  { prefix: "/app/quotes", feature: "fieldQuotes", requiredPlan: "Base" },
  { prefix: "/app/pipeline", feature: "crm", requiredPlan: "Base" },
  { prefix: "/app/clients", feature: "crm", requiredPlan: "Base" },
  { prefix: "/app/cantieri", feature: "cantieri", requiredPlan: "Base" },
  { prefix: "/app/surveys", feature: "fieldOps", requiredPlan: "Base" },
  { prefix: "/app/installations", feature: "fieldOps", requiredPlan: "Base" },
  { prefix: "/app/inspections", feature: "fieldOps", requiredPlan: "Base" },
  { prefix: "/app/passports", feature: "fieldOps", requiredPlan: "Base" },
  { prefix: "/app/logistics", feature: "logistics", requiredPlan: "Base", requiredWidgetPlan: "Level 3" },
];

/**
 * The print page of a request stays reachable from Richieste on every plan
 * (its own server gate meters the PDF), so it is carved out of /app/quotes.
 */
const UNGATED = [/^\/app\/quotes\/[^/]+\/print\/?$/];

export function gateForPath(pathname: string) {
  if (UNGATED.some((re) => re.test(pathname))) return null;
  return ROUTE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/")) ?? null;
}

/** The plan to name in the lock copy: stay in the tenant's own family when possible. */
export function requiredPlanFor(gate: RouteGate, currentPlan: string): string {
  return isWidgetPlanKey(currentPlan) && gate.requiredWidgetPlan ? gate.requiredWidgetPlan : gate.requiredPlan;
}

type Ent = {
  analytics: "none" | "basic" | "advanced";
  showroomCalculator: boolean;
  moduleFieldQuotes?: boolean;
  moduleCrm?: boolean;
  moduleCantieri?: boolean;
  moduleFieldOps?: boolean;
  moduleLogistics?: boolean;
};

export function isFeatureUnlocked(feature: GatedFeature, ent: Ent): boolean {
  switch (feature) {
    case "analytics":
      return ent.analytics !== "none";
    case "showroom":
      return ent.showroomCalculator;
    // Module flags are absent only on a server that predates them: fail open (server still enforces).
    case "fieldQuotes":
      return ent.moduleFieldQuotes !== false;
    case "crm":
      return ent.moduleCrm !== false;
    case "cantieri":
      return ent.moduleCantieri !== false;
    case "fieldOps":
      return ent.moduleFieldOps !== false;
    case "logistics":
      return ent.moduleLogistics !== false;
  }
}

/** `undefined` while loading; afterwards the plan name + which features are locked. */
export function usePlanAccess(tenantId: Id<"tenants"> | undefined) {
  // Never subscribe before the auth token is confirmed: the query would run
  // anonymously and throw UNAUTHENTICATED (token refresh, sign-out, fresh signup).
  const { isAuthenticated } = useConvexAuth();
  const state = useQuery(api.billing.getBillingState, tenantId && isAuthenticated ? { tenantId } : "skip");
  if (state === undefined) return undefined;
  if (state === null) return null;
  return {
    plan: state.plan,
    widgetPlan: isWidgetPlanKey(state.plan),
    /** Embeddable widget on the dealer's own site (the hosted /c link is on every plan). */
    publicWidget: (state.entitlements as { publicWidget?: boolean }).publicWidget !== false,
    isLocked: (feature: GatedFeature) => !isFeatureUnlocked(feature, state.entitlements),
  };
}

/**
 * True once the subscription is over (cancelled trial/plan, deleted in
 * Stripe): the tenant is "suspended" and the platform is locked until it
 * subscribes again. Reactive, so every shell component flips together.
 */
export function useSubscriptionEnded(initial?: { planStatus?: string; unlimitedAccess?: boolean }): boolean {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(api.tenants.getMyTenant, isAuthenticated ? {} : "skip");
  const t = live ?? initial;
  return t?.planStatus === "suspended" && t.unlimitedAccess !== true;
}
