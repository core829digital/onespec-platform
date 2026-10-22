import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { resolveTenantEntitlements, assertEntitlement, assertQuota, currentPeriod, isWidgetPlan, type BooleanEntitlementKey } from "./entitlements";

/**
 * Entitlement enforcement helpers for mutations/queries.
 * Each helper resolves the tenant, checks the entitlement, and throws a
 * ConvexError with a stable code when the gate is closed.
 * Codes are consumed by the client to show specific upgrade prompts.
 */

export type ReadCtx = QueryCtx | MutationCtx;

/**
 * Load the tenant and its effective entitlements in one call.
 * Throws if the tenant doesn't exist or the caller isn't a member.
 */
export async function getTenantWithEntitlements(
  ctx: ReadCtx,
  tenantId: Id<"tenants">
): Promise<{ tenant: Doc<"tenants">; ent: ReturnType<typeof resolveTenantEntitlements> }> {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  return { tenant, ent: resolveTenantEntitlements(tenant) };
}

/** --- Boolean entitlement gates --- */

/**
 * Boolean entitlement → the error code its gate throws. One row per gate: adding an entitlement is one line here
 * plus, if needed, a named alias below (issue #62). The client maps each code to its upgrade prompt.
 */
export const ENTITLEMENT_GATES = {
  whiteLabel: "WHITELABEL_NOT_ALLOWED",
  advancedPricingRules: "ADVANCED_PRICING_NOT_ALLOWED",
  multiCatalog: "MULTI_CATALOG_NOT_ALLOWED",
  csvImport: "CSV_IMPORT_NOT_ALLOWED",
  bulkImportMultiSite: "BULK_IMPORT_NOT_ALLOWED",
  customDomain: "CUSTOM_DOMAIN_NOT_ALLOWED",
  apiAccess: "API_ACCESS_NOT_ALLOWED",
  prioritySupport: "PRIORITY_SUPPORT_NOT_ALLOWED",
  transparentWidget: "TRANSPARENT_WIDGET_NOT_ALLOWED",
  eSignature: "ESIGNATURE_NOT_ALLOWED",
  advanceInvoices: "ADVANCE_INVOICES_NOT_ALLOWED",
  maintenanceContracts: "MAINTENANCE_CONTRACTS_NOT_ALLOWED",
  multiSupplierAggregator: "MULTI_SUPPLIER_NOT_ALLOWED",
  showroomCalculator: "SHOWROOM_CALCULATOR_NOT_ALLOWED",
  publicWidget: "PUBLIC_WIDGET_NOT_ALLOWED",
  gaebExport: "GAEB_EXPORT_NOT_ALLOWED",
  crmIntegration: "CRM_INTEGRATION_NOT_ALLOWED",
} as const satisfies Partial<Record<BooleanEntitlementKey, string>>;

/** Throws the entitlement's code when the tenant's plan does not include it. */
export async function enforceEntitlement(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
  key: keyof typeof ENTITLEMENT_GATES,
): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, key, ENTITLEMENT_GATES[key]);
}

export const enforceWhiteLabel = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "whiteLabel");
export const enforceAdvancedPricingRules = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "advancedPricingRules");
export const enforceMultiCatalog = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "multiCatalog");

export async function enforceAnalytics(ctx: ReadCtx, tenantId: Id<"tenants">, minLevel: "basic" | "advanced" = "basic"): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const level = resolveTenantEntitlements(tenant).analytics;
  if (level === "none") throw new ConvexError("ANALYTICS_NOT_ALLOWED");
  if (minLevel === "advanced" && level !== "advanced") throw new ConvexError("ADVANCED_ANALYTICS_NOT_ALLOWED");
}

export const enforceCSVImport = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "csvImport");
export const enforceBulkImportMultiSite = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "bulkImportMultiSite");
export const enforceCustomDomain = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "customDomain");
export const enforceApiAccess = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "apiAccess");
export const enforcePrioritySupport = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "prioritySupport");
export const enforceTransparentWidget = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "transparentWidget");

export async function enforceFieldModules(ctx: ReadCtx, tenantId: Id<"tenants">, required: "rilievo_only" | "full" = "full"): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const allowed = resolveTenantEntitlements(tenant).fieldModules;
  if (required === "full" && allowed !== "full") throw new ConvexError("FIELD_MODULES_NOT_ALLOWED");
}

export async function enforceFiscalEngine(ctx: ReadCtx, tenantId: Id<"tenants">, required: "basic" | "full" = "full"): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const allowed = resolveTenantEntitlements(tenant).fiscalEngine;
  if (required === "full" && allowed !== "full") throw new ConvexError("FISCAL_ENGINE_NOT_ALLOWED");
}

export const enforceESignature = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "eSignature");
export const enforceAdvanceInvoices = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "advanceInvoices");
export const enforceMaintenanceContracts = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "maintenanceContracts");
export const enforceMultiSupplierAggregator = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "multiSupplierAggregator");
export const enforceShowroomCalculator = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "showroomCalculator");
export const enforcePublicWidget = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "publicWidget");
export const enforceGAEBExport = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "gaebExport");
export const enforceCRMIntegration = (ctx: ReadCtx, tenantId: Id<"tenants">) => enforceEntitlement(ctx, tenantId, "crmIntegration");

/** --- Quota gates (configurators, quotes, team members) --- */

export async function enforceConfiguratorQuota(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { ent } = await getTenantWithEntitlements(ctx, tenantId);
  if (!Number.isFinite(ent.maxConfigurators)) return;
  // `maxConfigurators` caps the configurators that EXIST (draft + published),
  // not the ones created this month: the old per-period counter reset every
  // month, so a tenant could add another N configurators each month.
  const used = await countLiveConfigurators(ctx, tenantId, ent.maxConfigurators);
  assertQuota(used, ent.maxConfigurators, "CONFIGURATOR_QUOTA_EXCEEDED");
}

/** Draft + published configurators, counted up to `cap` (bounded reads). */
export async function countLiveConfigurators(ctx: ReadCtx, tenantId: Id<"tenants">, cap: number): Promise<number> {
  const take = Math.max(0, Math.min(cap, 1000));
  const [drafts, published] = await Promise.all([
    ctx.db.query("configurators").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "draft")).take(take),
    ctx.db.query("configurators").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "published")).take(take),
  ]);
  return drafts.length + published.length;
}

/**
 * Whether the plan still serves this configurator publicly:
 * - a suspended tenant (subscription cancelled / ended) serves nothing — on
 *   EVERY plan (founder's decision 2026-09-29: no free leads after cancelling);
 * - after a downgrade (e.g. Level 3 → Level 1) only the oldest
 *   `maxConfigurators` published configurators keep serving; the rest show
 *   the lock until the tenant upgrades or unpublishes.
 */
export async function configuratorServedByPlan(
  ctx: ReadCtx,
  tenant: Doc<"tenants">,
  configuratorId: Id<"configurators">,
): Promise<boolean> {
  if (tenant.unlimitedAccess === true) return true;
  if (tenant.planStatus === "suspended") return false;
  if (!isWidgetPlan(tenant.plan)) return true;
  const cap = resolveTenantEntitlements(tenant).maxConfigurators;
  if (!Number.isFinite(cap)) return true;
  const serving = await ctx.db
    .query("configurators")
    .withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "published"))
    .take(cap);
  return serving.some((c) => c._id === configuratorId);
}

export async function enforceQuoteQuota(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { ent } = await getTenantWithEntitlements(ctx, tenantId);
  if (!Number.isFinite(ent.maxQuotesPerMonth)) return;
  const period = currentPeriod();
  const counter = await ctx.db
    .query("usageCounters")
    .withIndex("by_tenant_period", (q) => q.eq("tenantId", tenantId).eq("period", period))
    .first();
  const used = counter?.quoteRequestsCount ?? 0;
  assertQuota(used, ent.maxQuotesPerMonth, "QUOTE_QUOTA_EXCEEDED");
}

export async function enforceTeamMemberQuota(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { ent } = await getTenantWithEntitlements(ctx, tenantId);
  if (!Number.isFinite(ent.maxTeamMembers)) return;
  const count = await ctx.db
    .query("memberships")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect()
    .then((arr) => arr.length);
  assertQuota(count, ent.maxTeamMembers, "TEAM_QUOTA_EXCEEDED");
}

export async function enforceLogisticsSupplierQuota(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { ent } = await getTenantWithEntitlements(ctx, tenantId);
  if (!Number.isFinite(ent.maxLogisticsSuppliers)) return;
  const count = await ctx.db
    .query("logisticsSuppliers")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect()
    .then((arr) => arr.length);
  assertQuota(count, ent.maxLogisticsSuppliers, "LOGISTICS_SUPPLIER_QUOTA_EXCEEDED");
}

export async function enforceCarrierQuota(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { ent } = await getTenantWithEntitlements(ctx, tenantId);
  if (!Number.isFinite(ent.maxCarriers)) return;
  const count = await ctx.db
    .query("carriers")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .collect()
    .then((arr) => arr.length);
  assertQuota(count, ent.maxCarriers, "CARRIER_QUOTA_EXCEEDED");
}

/** --- Suspended / plan status gate --- */

/**
 * Free self-service onboarding (a plan "picked" with no payment) is a DEV/TEST
 * convenience only. It fails CLOSED: it needs the explicit opt-in flag below AND
 * no Stripe key. Production never sets the flag, so a missing or mistyped
 * STRIPE_SECRET_KEY can no longer open the platform for free.
 */
export function freeOnboardingAllowed(): boolean {
  return !process.env.STRIPE_SECRET_KEY && process.env.ONESPEC_ALLOW_FREE_ONBOARDING === "1";
}

export async function enforceActivePlan(ctx: MutationCtx | QueryCtx, tenantId: Id<"tenants">): Promise<void> {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  // Founding/full-access tenants are never blocked by plan status.
  if (tenant.unlimitedAccess === true) return;
  if (tenant.planStatus === "suspended") throw new ConvexError("PLAN_SUSPENDED");
  if (tenant.planStatus === "past_due") throw new ConvexError("PLAN_PAST_DUE");
  // Every tenant goes through the plan-recommendation wizard before touching
  // the rest of the platform now — enforced regardless of whether Stripe is
  // live, so the wizard itself can be tested end to end before billing is on.
  if (tenant.planStatus === "pending_plan") throw new ConvexError("PLAN_SELECTION_REQUIRED");
  // Once real billing is live, "trialing" only counts if Stripe actually
  // started that trial (a real stripeSubscriptionId on file, card verified
  // at checkout) — registerTenant sets planStatus:"trialing" for every new
  // signup regardless of payment, so without this check a tenant could stay
  // on a free Base plan forever just by registering, never touching Stripe.
  // Dormant Stripe (no STRIPE_SECRET_KEY — today, pre-launch) keeps the
  // permissive behavior so local dev/testing isn't blocked before billing
  // is actually turned on.
  if (!freeOnboardingAllowed() && tenant.planStatus === "trialing" && !tenant.stripeSubscriptionId) {
    throw new ConvexError("SUBSCRIPTION_REQUIRED");
  }
}

/**
 * Composite enforcement for common mutation patterns.
 * Usage: await enforceForCreateConfigurator(ctx, tenantId);
 */
/** A gate that first requires an active subscription (not suspended), then runs `gate`. */
function withActivePlan(gate: (ctx: MutationCtx, tenantId: Id<"tenants">) => Promise<void>) {
  return async (ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> => {
    await enforceActivePlan(ctx, tenantId);
    await gate(ctx, tenantId);
  };
}

export const enforceForCreateConfigurator = withActivePlan(enforceConfiguratorQuota);
export const enforceForCreateQuote = withActivePlan(enforceQuoteQuota);
export const enforceForAddTeamMember = withActivePlan(enforceTeamMemberQuota);
export const enforceForFieldSurvey = withActivePlan((ctx, tenantId) => enforceFieldModules(ctx, tenantId, "rilievo_only"));
export const enforceForFullFieldModules = withActivePlan((ctx, tenantId) => enforceFieldModules(ctx, tenantId, "full"));
export const enforceForFiscalEngine = withActivePlan((ctx, tenantId) => enforceFiscalEngine(ctx, tenantId, "full"));
export const enforceForESignature = withActivePlan(enforceESignature);
export const enforceForMaintenance = withActivePlan(enforceMaintenanceContracts);
export const enforceForWidget = withActivePlan(enforcePublicWidget);
export const enforceForAnalytics = withActivePlan((ctx, tenantId) => enforceAnalytics(ctx, tenantId, "basic"));
export const enforceForAdvancedAnalytics = withActivePlan((ctx, tenantId) => enforceAnalytics(ctx, tenantId, "advanced"));
export const enforceForAdvanceInvoices = withActivePlan(enforceAdvanceInvoices);
export const enforceForShowroomCalculator = withActivePlan(enforceShowroomCalculator);
export const enforceForGAEBExport = withActivePlan(enforceGAEBExport);
export const enforceForCRMIntegration = withActivePlan(enforceCRMIntegration);
export const enforceForMultiSupplier = withActivePlan(enforceMultiSupplierAggregator);
export const enforceForWhiteLabel = withActivePlan(enforceWhiteLabel);
export const enforceForCustomDomain = withActivePlan(enforceCustomDomain);
export const enforceForApiAccess = withActivePlan(enforceApiAccess);
export const enforceForTransparentWidget = withActivePlan(enforceTransparentWidget);
export const enforceForCSVImport = withActivePlan(enforceCSVImport);
export const enforceForBulkImport = withActivePlan(enforceBulkImportMultiSite);
export const enforceForAdvancedPricingRules = withActivePlan(enforceAdvancedPricingRules);
export const enforceForMultiCatalog = withActivePlan(enforceMultiCatalog);

/** --- Query-compatible versions (for use in query handlers) --- */

export async function enforceAnalyticsForQuery(ctx: QueryCtx, tenantId: Id<"tenants">, minLevel: "basic" | "advanced" = "basic"): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const level = resolveTenantEntitlements(tenant).analytics;
  if (level === "none") throw new ConvexError("ANALYTICS_NOT_ALLOWED");
  if (minLevel === "advanced" && level !== "advanced") throw new ConvexError("ADVANCED_ANALYTICS_NOT_ALLOWED");
}