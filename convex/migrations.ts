import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { seedExtras } from "./lib/catalogExtras";
import type { TableNames } from "./_generated/dataModel";

/**
 * One-shot data migrations for the plan-ladder rename (business → pro).
 *
 * Run AFTER deploy #1 (transitional schema union) and BEFORE deploy #2
 * (which drops the "business" literal):
 *
 *   npx convex run migrations:renameBusinessToPro
 *   npx convex run migrations:backfillTrialEndsAt
 *
 * Both are idempotent — safe to re-run.
 */

export const renameBusinessToPro = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let migrated = 0;
    for (const t of page.page) {
      if ((t.plan as string) !== "business") continue;
      await ctx.db.patch(t._id, { plan: "pro", updatedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "plan.migrate",
        targetTable: "tenants",
        targetId: t._id,
        meta: { from: "business", to: "pro" },
        createdAt: Date.now(),
      });
      migrated++;
    }
    return {
      migrated,
      done: page.isDone,
      cursor: page.continueCursor,
    };
  },
});

/**
 * v2 plan-ladder rename (2026-09-22, per signed SaaS contracts):
 *   starter  → base       (same entitlements, renamed)
 *   showroom → enterprise (Enterprise now includes what Showroom used to add
 *                          on top — unlimited configurators, showroom
 *                          calculator, public widget — no capability lost)
 *   pro/enterprise (as literal strings) are unchanged; only their
 *   entitlements/price moved, not the DB value.
 *
 * Run AFTER the transitional schema deploy (plan union keeps starter/showroom
 * as valid literals) and BEFORE the deploy that drops those two literals:
 *
 *   npx convex run migrations:renamePlansToV2
 *
 * Idempotent — safe to re-run.
 */
export const renamePlansToV2 = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let migrated = 0;
    for (const t of page.page) {
      const from = t.plan as string;
      const to = from === "starter" ? "base" : from === "showroom" ? "enterprise" : null;
      if (!to) continue;
      await ctx.db.patch(t._id, { plan: to as "base" | "enterprise", updatedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "plan.migrate",
        targetTable: "tenants",
        targetId: t._id,
        meta: { from, to },
        createdAt: Date.now(),
      });
      migrated++;
    }
    return {
      migrated,
      done: page.isDone,
      cursor: page.continueCursor,
    };
  },
});

export const backfillTrialEndsAt = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .withIndex("by_planStatus", (q) => q.eq("planStatus", "trialing"))
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let backfilled = 0;
    for (const t of page.page) {
      // Stripe-managed trials refill trialEndsAt via webhook; only patch
      // pre-Stripe rows that have no subscription and no trial end.
      if (t.stripeSubscriptionId || t.trialEndsAt) continue;
      await ctx.db.patch(t._id, {
        trialPlan: "pro",
        trialEndsAt: (t.createdAt ?? Date.now()) + 14 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "trial.expired",
        targetTable: "tenants",
        targetId: t._id,
        meta: { reason: "backfill" },
        createdAt: Date.now(),
      });
      backfilled++;
    }
    return { backfilled, done: page.isDone, cursor: page.continueCursor };
  },
});

export const backfillStarterQuotaOverride = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .withIndex("by_plan", (q) => q.eq("plan", "starter"))
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 100 });
    let backfilled = 0;
    for (const t of page.page) {
      // Only patch tenants that don't already have the override set.
      if (typeof t.quotaOverrideQuotesPerMonth === "number") continue;
      await ctx.db.patch(t._id, {
        quotaOverrideQuotesPerMonth: 50,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "quota.override",
        targetTable: "tenants",
        targetId: t._id,
        meta: { field: "quotaOverrideQuotesPerMonth", value: 50, reason: "grandfather Starter 50 quotes/month" },
        createdAt: Date.now(),
      });
      backfilled++;
    }
    return { backfilled, done: page.isDone, cursor: page.continueCursor };
  },
});

/**
 * Add the B2B/showroom catalogue sections (telaio types, accessories, new hardware
 * / profile / glazing / finish rows) to every existing configurator:
 *
 *   npx convex run migrations:seedCatalogExtras
 *
 * Idempotent — only inserts rows that are missing, never overwrites tenant edits.
 * Already-published versions are untouched; the next publish picks the new rows up.
 */
export const seedCatalogExtras = internalMutation({
  args: {},
  handler: async (ctx) => {
    let configurators = 0;
    let inserted = 0;
    for (const c of await ctx.db.query("configurators").collect()) {
      const r = await seedExtras(ctx, { tenantId: c.tenantId, configuratorId: c._id });
      configurators++;
      inserted += r.inserted;
    }
    return { configurators, inserted };
  },
});

/**
 * FUTURE USE ONLY — NOT invoked by any code path, cron, or migration runner.
 * A platform-wide data reset for a pre-launch cleanup: wipes every row of
 * business/generated data across ALL tenants while keeping every account
 * (no `users`/`tenants`/`memberships`/`invitations` row is touched, no
 * account is deleted — only the data *inside* accounts).
 *
 * Kept tables (identity/billing/consent — never touched):
 *   users, tenants, memberships, invitations, billingEvents, dpaAcceptances,
 *   appSettings, userConsents.
 *
 * Erased tables (everything else — configurators, catalog, quotes, field
 * modules, clients/cantieri, logs):
 *   see `ERASABLE_TABLES` below.
 *
 * Deliberately requires the literal string "ERASE ALL TENANT DATA" so a
 * stray/scripted call can't trigger it by accident:
 *
 *   npx convex run migrations:eraseAllTenantData '{"confirm":"ERASE ALL TENANT DATA"}'
 *
 * Run it multiple times (once per table batch) if any table reports
 * `done:false` — each call processes up to `limit` rows per table per call.
 */
const ERASABLE_TABLES: TableNames[] = [
  "configurators",
  "branding",
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
  "quoteRequests",
  "notifications",
  "catalogImports",
  "deletionRequests",
  "alphaFeedback",
  "notificationPrefs",
  "emailLog",
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
];

export const eraseAllTenantData = internalMutation({
  args: { confirm: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.confirm !== "ERASE ALL TENANT DATA") {
      throw new Error('Refusing: pass confirm:"ERASE ALL TENANT DATA" exactly.');
    }
    const limit = args.limit ?? 500;
    const perTable: Record<string, { deleted: number; done: boolean }> = {};
    for (const table of ERASABLE_TABLES) {
      const page = await ctx.db.query(table).take(limit);
      for (const row of page) await ctx.db.delete(row._id);
      perTable[table] = { deleted: page.length, done: page.length < limit };
    }
    return perTable;
  },
});
