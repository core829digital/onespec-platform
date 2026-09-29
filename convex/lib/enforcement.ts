import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { resolveTenantEntitlements, assertEntitlement, assertQuota, currentPeriod, isWidgetPlan } from "./entitlements";

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

export async function enforceWhiteLabel(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "whiteLabel", "WHITELABEL_NOT_ALLOWED");
}

export async function enforceAdvancedPricingRules(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "advancedPricingRules", "ADVANCED_PRICING_NOT_ALLOWED");
}

export async function enforceMultiCatalog(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "multiCatalog", "MULTI_CATALOG_NOT_ALLOWED");
}

export async function enforceAnalytics(ctx: ReadCtx, tenantId: Id<"tenants">, minLevel: "basic" | "advanced" = "basic"): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const level = resolveTenantEntitlements(tenant).analytics;
  if (level === "none") throw new ConvexError("ANALYTICS_NOT_ALLOWED");
  if (minLevel === "advanced" && level !== "advanced") throw new ConvexError("ADVANCED_ANALYTICS_NOT_ALLOWED");
}

export async function enforceCSVImport(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "csvImport", "CSV_IMPORT_NOT_ALLOWED");
}

export async function enforceBulkImportMultiSite(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "bulkImportMultiSite", "BULK_IMPORT_NOT_ALLOWED");
}

export async function enforceCustomDomain(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "customDomain", "CUSTOM_DOMAIN_NOT_ALLOWED");
}

export async function enforceApiAccess(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "apiAccess", "API_ACCESS_NOT_ALLOWED");
}

export async function enforcePrioritySupport(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "prioritySupport", "PRIORITY_SUPPORT_NOT_ALLOWED");
}

export async function enforceTransparentWidget(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "transparentWidget", "TRANSPARENT_WIDGET_NOT_ALLOWED");
}

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

export async function enforceESignature(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "eSignature", "ESIGNATURE_NOT_ALLOWED");
}

export async function enforceAdvanceInvoices(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "advanceInvoices", "ADVANCE_INVOICES_NOT_ALLOWED");
}

export async function enforceMaintenanceContracts(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "maintenanceContracts", "MAINTENANCE_CONTRACTS_NOT_ALLOWED");
}

export async function enforceMultiSupplierAggregator(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "multiSupplierAggregator", "MULTI_SUPPLIER_NOT_ALLOWED");
}

export async function enforceShowroomCalculator(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "showroomCalculator", "SHOWROOM_CALCULATOR_NOT_ALLOWED");
}

export async function enforcePublicWidget(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "publicWidget", "PUBLIC_WIDGET_NOT_ALLOWED");
}

export async function enforceGAEBExport(ctx: ReadCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "gaebExport", "GAEB_EXPORT_NOT_ALLOWED");
}

export async function enforceCRMIntegration(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  assertEntitlement(tenant, "crmIntegration", "CRM_INTEGRATION_NOT_ALLOWED");
}

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
 * Whether the plan still serves this configurator publicly (widget-first plans
 * only; full-platform plans are unaffected):
 * - a suspended tenant (subscription cancelled / ended) serves nothing;
 * - after a downgrade (e.g. Level 3 → Level 1) only the oldest
 *   `maxConfigurators` published configurators keep serving; the rest show
 *   the lock until the tenant upgrades or unpublishes.
 */
export async function configuratorServedByPlan(
  ctx: ReadCtx,
  tenant: Doc<"tenants">,
  configuratorId: Id<"configurators">,
): Promise<boolean> {
  if (tenant.unlimitedAccess === true || !isWidgetPlan(tenant.plan)) return true;
  if (tenant.planStatus === "suspended") return false;
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
  if (process.env.STRIPE_SECRET_KEY && tenant.planStatus === "trialing" && !tenant.stripeSubscriptionId) {
    throw new ConvexError("SUBSCRIPTION_REQUIRED");
  }
}

/**
 * Composite enforcement for common mutation patterns.
 * Usage: await enforceForCreateConfigurator(ctx, tenantId);
 */
export async function enforceForCreateConfigurator(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceConfiguratorQuota(ctx, tenantId);
}

export async function enforceForCreateQuote(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceQuoteQuota(ctx, tenantId);
}

export async function enforceForAddTeamMember(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceTeamMemberQuota(ctx, tenantId);
}

export async function enforceForFieldSurvey(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceFieldModules(ctx, tenantId, "rilievo_only");
}

export async function enforceForFullFieldModules(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceFieldModules(ctx, tenantId, "full");
}

export async function enforceForFiscalEngine(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceFiscalEngine(ctx, tenantId, "full");
}

export async function enforceForESignature(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceESignature(ctx, tenantId);
}

export async function enforceForMaintenance(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceMaintenanceContracts(ctx, tenantId);
}

export async function enforceForWidget(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforcePublicWidget(ctx, tenantId);
}

export async function enforceForAnalytics(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceAnalytics(ctx, tenantId, "basic");
}

export async function enforceForAdvancedAnalytics(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceAnalytics(ctx, tenantId, "advanced");
}

export async function enforceForAdvanceInvoices(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceAdvanceInvoices(ctx, tenantId);
}

export async function enforceForShowroomCalculator(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceShowroomCalculator(ctx, tenantId);
}

export async function enforceForGAEBExport(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceGAEBExport(ctx, tenantId);
}

export async function enforceForCRMIntegration(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceCRMIntegration(ctx, tenantId);
}

export async function enforceForMultiSupplier(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceMultiSupplierAggregator(ctx, tenantId);
}

export async function enforceForWhiteLabel(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceWhiteLabel(ctx, tenantId);
}

export async function enforceForCustomDomain(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceCustomDomain(ctx, tenantId);
}

export async function enforceForApiAccess(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceApiAccess(ctx, tenantId);
}

export async function enforceForTransparentWidget(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceTransparentWidget(ctx, tenantId);
}

export async function enforceForCSVImport(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceCSVImport(ctx, tenantId);
}

export async function enforceForBulkImport(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceBulkImportMultiSite(ctx, tenantId);
}

export async function enforceForAdvancedPricingRules(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceAdvancedPricingRules(ctx, tenantId);
}

export async function enforceForMultiCatalog(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  await enforceMultiCatalog(ctx, tenantId);
}

/** --- Query-compatible versions (for use in query handlers) --- */

export async function enforceAnalyticsForQuery(ctx: QueryCtx, tenantId: Id<"tenants">, minLevel: "basic" | "advanced" = "basic"): Promise<void> {
  await enforceActivePlan(ctx, tenantId);
  const { tenant } = await getTenantWithEntitlements(ctx, tenantId);
  const level = resolveTenantEntitlements(tenant).analytics;
  if (level === "none") throw new ConvexError("ANALYTICS_NOT_ALLOWED");
  if (minLevel === "advanced" && level !== "advanced") throw new ConvexError("ADVANCED_ANALYTICS_NOT_ALLOWED");
}