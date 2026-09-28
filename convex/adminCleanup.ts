import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * One-off pre-launch data wipe. Internal only — never exposed to the client,
 * only callable via `npx convex run` with the deploy key.
 *
 * Explicitly NEVER touches: users, tenants (identity + billing fields:
 * plan/planStatus/billingCycle/stripeCustomerId/stripeSubscriptionId/
 * trialStartedAt/trialEndsAt/unlimitedAccess), memberships, invitations, billingEvents (Stripe
 * webhook idempotency), dpaAcceptances, userConsents, deletionRequests,
 * appSettings, notificationPrefs, and every Convex Auth table (sessions stay
 * valid — no one is signed out).
 *
 * Wipes activity/content data AND catalog/configurator content (materials,
 * pricing, profiles, branding) per explicit instruction — this intentionally
 * breaks any live published widget's pricing until its catalog is rebuilt.
 * `configurators` documents themselves are kept (so publicId/URLs still
 * resolve instead of 404ing) — only their content underneath is cleared.
 */
export const WIPE_TABLES = [
  // Catalog / configurator content
  "catalogMaterials",
  "catalogQualityTiers",
  "catalogProfileSystems",
  "catalogSizeConstraints",
  "catalogGlazingOptions",
  "catalogFinishOptions",
  "catalogFrameTypes",
  "catalogAccessories",
  "catalogProductBase",
  "catalogHardwareOptions",
  "catalogVersions",
  "catalogSuppliers",
  "catalogImports",
  "branding",
  // Activity / transactional data
  "quoteRequests",
  "notifications",
  "alphaFeedback",
  "emailLog",
  "emailDeliveryLog",
  "auditLog",
  "usageCounters",
  "rateLimits",
  "siteSurveys",
  "installationDossiers",
  "inspectionReports",
  "serramentoPassports",
  "passportInterventions",
  "clients",
  "clientActivities",
  "cantieri",
  "cantiereTasks",
] as const;

export const countTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, args): Promise<number> => {
    // .collect() is fine here: this is a one-off admin script run directly
    // via the CLI, not a request path — table sizes here are pre-launch scale.
    const rows = await ctx.db.query(args.table as never).collect();
    return rows.length;
  },
});

/** Deletes up to `limit` documents from `table`. Returns how many were deleted. */
export const deleteBatch = internalMutation({
  args: { table: v.string(), limit: v.number() },
  handler: async (ctx, args): Promise<number> => {
    const rows = await ctx.db.query(args.table as never).take(args.limit);
    for (const row of rows) await ctx.db.delete((row as { _id: never })._id);
    return rows.length;
  },
});

export const countAll = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const table of WIPE_TABLES) {
      out[table] = await ctx.runMutation(internal.adminCleanup.countTable, { table });
    }
    return out;
  },
});

export const wipeAll = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const deleted: Record<string, number> = {};
    for (const table of WIPE_TABLES) {
      let total = 0;
      // Batch of 200 per transaction, looped until the table is empty.
      for (;;) {
        const n: number = await ctx.runMutation(internal.adminCleanup.deleteBatch, {
          table,
          limit: 200,
        });
        total += n;
        if (n < 200) break;
      }
      deleted[table] = total;
    }
    return deleted;
  },
});

/**
 * One-off migration (2026-09-28): the trialing-plan invariant fix
 * (`subscriptionPatch` in billing.ts) forces `plan: "pro"` whenever
 * `planStatus === "trialing"` going forward, but it does not retroactively
 * fix tenants already drifted before the fix shipped. This corrects the one
 * known pre-existing case (a tenant on Agency while trialing — should only
 * ever be possible on Pro) without touching `trialStartedAt`/`trialEndsAt`,
 * so the tenant keeps its original trial clock instead of getting a free
 * reset. Run once via `npx convex run --prod adminCleanup:fixDriftedTrialPlan
 * '{"tenantId":"..."}'`, then leave in place as a record of the fix (never
 * exposed to the client).
 */
export const fixDriftedTrialPlan = internalMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ before: unknown; after: unknown }> => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    if (tenant.planStatus !== "trialing") {
      throw new Error(`Tenant is not trialing (planStatus=${tenant.planStatus}); refusing to touch it`);
    }
    if (tenant.plan === "pro") {
      throw new Error("Tenant is already on Pro; nothing to fix");
    }
    const before = { plan: tenant.plan, planStatus: tenant.planStatus };
    await ctx.db.patch(args.tenantId, { plan: "pro", updatedAt: Date.now() });
    const after = await ctx.db.get(args.tenantId);
    return { before, after: after ? { plan: after.plan, planStatus: after.planStatus } : null };
  },
});
