import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { seedExtras } from "./lib/catalogExtras";
import { FULL_ACCESS_EMAILS, isFullAccessEmail } from "./lib/founding";
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
 * One-off backfill for the accessories/glazing/finish/hardware rows that
 * `seedExtras` used to insert at a hardcoded priceCents: 0 (fixed in the
 * same change as this migration — see catalogExtras.ts / configurator-model.ts).
 * `seedExtras` itself is idempotent-by-key and only INSERTS missing rows, so
 * it never touches a row that already exists — this patches the ones that
 * already exist at exactly 0 for one of the known-affected natural keys.
 * Skips any row whose price isn't 0, so a tenant who deliberately priced
 * something free is left untouched.
 *
 *   npx convex run migrations:backfillZeroPricedCatalogDefaults
 */
const ZERO_PRICED_ACCESSORY_DEFAULTS: Record<string, number> = {
  "zanz:carrarmato": 12000,
  "zanz:plisettata": 8500,
  "zanz:cerniere": 4500,
  "zanz:fissa": 3000,
  "zanz:molla": 6500,
  "cass:deceuninck132": 18000,
  "cass:rehau150": 20000,
  "cass:aluplast80": 12000,
  "cass:aluplast140": 16000,
  "avv:sovrapposto": 22000,
  "avv:applicato": 18000,
  "avv:accessori": 4500,
  "pers:fisse": 25000,
  "pers:orientabili": 32000,
};
const ZERO_PRICED_GLAZING_DEFAULTS: Record<string, number> = {
  acoustic: 4500,
  satinDouble: 5500,
  satinTriple: 12000,
};
const ZERO_PRICED_FINISH_DEFAULTS: Record<string, number> = {
  anthracite: 6500,
  bicolorRal: 7500,
  whiteWoodExt: 7000,
  woodIntExt: 9500,
  whiteWoodEffect: 6000,
  ivoryWoodEffect: 7000,
  otherColor: 9500,
};

export const backfillZeroPricedCatalogDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    let patched = 0;

    for (const row of await ctx.db.query("catalogAccessories").collect()) {
      if (row.priceCents !== 0) continue;
      const price = ZERO_PRICED_ACCESSORY_DEFAULTS[`${row.category}:${row.key}`];
      if (price === undefined) continue;
      await ctx.db.patch(row._id, { priceCents: price });
      patched++;
    }

    for (const row of await ctx.db.query("catalogGlazingOptions").collect()) {
      if (row.priceCents !== 0) continue;
      const price = ZERO_PRICED_GLAZING_DEFAULTS[row.key];
      if (price === undefined) continue;
      await ctx.db.patch(row._id, { priceCents: price });
      patched++;
    }

    for (const row of await ctx.db.query("catalogFinishOptions").collect()) {
      if (row.priceCents !== 0) continue;
      const price = ZERO_PRICED_FINISH_DEFAULTS[row.key];
      if (price === undefined) continue;
      await ctx.db.patch(row._id, { priceCents: price });
      patched++;
    }

    for (const row of await ctx.db
      .query("catalogHardwareOptions")
      .filter((q) => q.and(q.eq(q.field("kind"), "hardware"), q.eq(q.field("key"), "hidden")))
      .collect()) {
      if (row.priceCents !== 0) continue;
      await ctx.db.patch(row._id, { priceCents: 4500 });
      patched++;
    }

    return { patched };
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

/** Read-only overview before running resetToFoundingAdmins — never delete anything blind. */
export const overviewBeforeReset = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const tenants = await ctx.db.query("tenants").collect();
    const memberships = await ctx.db.query("memberships").collect();
    return {
      users: users.map((u) => ({ _id: u._id, email: u.email, isPlatformAdmin: u.isPlatformAdmin })),
      tenants: tenants.map((t) => ({ _id: t._id, name: t.name, plan: t.plan, planStatus: t.planStatus, ownerUserId: t.ownerUserId, unlimitedAccess: t.unlimitedAccess })),
      memberships: memberships.map((m) => ({ tenantId: m.tenantId, userId: m.userId, role: m.role, status: m.status })),
    };
  },
});

/**
 * Founding reset — keeps ONLY the two named accounts (as platform admins,
 * each on a lone tenant reset to "pending_plan" so they go through the new
 * plan wizard too), deletes every other user/tenant/membership and all of
 * their tenant-scoped data. Irreversible. Run:
 *
 *   npx convex run migrations:overviewBeforeReset --prod
 *   (verify the output matches expectations)
 *   npx convex run migrations:resetToFoundingAdmins '{"confirm":"RESET TO FOUNDING ADMINS"}' --prod
 */
const KEEP_EMAILS = FULL_ACCESS_EMAILS;

export const resetToFoundingAdmins = internalMutation({
  args: { confirm: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.confirm !== "RESET TO FOUNDING ADMINS") {
      throw new Error('Refusing: pass confirm:"RESET TO FOUNDING ADMINS" exactly.');
    }
    const limit = args.limit ?? 1000;

    const allUsers = await ctx.db.query("users").collect();
    const keepUsers = allUsers.filter((u) => u.email && KEEP_EMAILS.includes(u.email));
    const keepUserIds = new Set(keepUsers.map((u) => u._id));

    for (const u of keepUsers) {
      if (!u.isPlatformAdmin) await ctx.db.patch(u._id, { isPlatformAdmin: true });
    }

    const allMemberships = await ctx.db.query("memberships").collect();
    const keepTenantIds = new Set(
      allMemberships.filter((m) => keepUserIds.has(m.userId)).map((m) => m.tenantId),
    );

    const report: Record<string, number> = { usersDeleted: 0, membershipsDeleted: 0, tenantsDeleted: 0 };

    for (const m of allMemberships) {
      if (!keepTenantIds.has(m.tenantId)) {
        await ctx.db.delete(m._id);
        report.membershipsDeleted++;
      }
    }

    for (const u of allUsers) {
      if (!keepUserIds.has(u._id)) {
        await ctx.db.delete(u._id);
        report.usersDeleted++;
      }
    }

    const allTenants = await ctx.db.query("tenants").collect();
    for (const t of allTenants) {
      if (!keepTenantIds.has(t._id)) {
        await ctx.db.delete(t._id);
        report.tenantsDeleted++;
      } else {
        // Kept tenants go through the plan wizard too, per "incluso il admin".
        await ctx.db.patch(t._id, {
          planStatus: "pending_plan",
          suspendedAt: undefined,
          suspendedReason: undefined,
          onboardingCompletedAt: undefined,
          onboardingStep: undefined,
          stripeSubscriptionId: undefined,
        });
      }
    }

    // Tenant-scoped tables: delete every row whose tenantId isn't kept.
    // Tables without a tenantId (e.g. rateLimits keyed by string) are left
    // alone — they carry no identifying data worth wiping here.
    const perTable: Record<string, { deleted: number; done: boolean }> = {};
    for (const table of ERASABLE_TABLES) {
      const page = await ctx.db.query(table).take(limit);
      let deleted = 0;
      for (const row of page) {
        const tenantId = (row as unknown as { tenantId?: string }).tenantId;
        if (tenantId && !keepTenantIds.has(tenantId as never)) {
          await ctx.db.delete(row._id);
          deleted++;
        }
      }
      perTable[table] = { deleted, done: page.length < limit };
    }

    return { ...report, keptTenantIds: [...keepTenantIds], perTable };
  },
});

/**
 * Grant founding full-access: isPlatformAdmin for both founding users +
 * unlimitedAccess on every tenant they own. Idempotent — safe to re-run.
 * Run AFTER deploy: npx convex run migrations:grantFullAccessToFounders --prod
 */
export const grantFullAccessToFounders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const report: Record<string, number> = { adminsFlagged: 0, tenantsFlagged: 0 };
    const users = await ctx.db.query("users").collect();
    const founderIds = new Set(
      users.filter((u) => isFullAccessEmail(u.email)).map((u) => u._id),
    );
    for (const u of users) {
      if (founderIds.has(u._id) && !u.isPlatformAdmin) {
        await ctx.db.patch(u._id, { isPlatformAdmin: true });
        report.adminsFlagged++;
      }
    }
    const tenants = await ctx.db.query("tenants").collect();
    for (const t of tenants) {
      const ownedByFounder =
        founderIds.has(t.ownerUserId) ||
        isFullAccessEmail((await ctx.db.get(t.ownerUserId))?.email);
      if (!ownedByFounder) continue;
      const patch: Record<string, unknown> = {};
      if (t.unlimitedAccess !== true) patch.unlimitedAccess = true;
      // Founding accounts show as Enterprise, not just unlimited-access Base —
      // unlimitedAccess already bypasses every limit regardless of `plan`,
      // this is so the admin UI/plan label reflects reality, not a leftover
      // default from registerTenant.
      if (t.plan !== "enterprise") patch.plan = "enterprise";
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch(t._id, { ...patch, updatedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        actorKind: "system",
        action: "tenant.grant_full_access",
        targetTable: "tenants",
        targetId: t._id,
        meta: { reason: "founding account", ...patch },
        createdAt: Date.now(),
      });
      report.tenantsFlagged++;
    }
    return report;
  },
});
