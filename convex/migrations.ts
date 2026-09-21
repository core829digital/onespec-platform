import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
 * Retire the Alpha programme (deploy #1 of 2 — the schema still allows the
 * "alpha" plan and the alpha fields/tables until this has been applied):
 *
 *   npx convex run migrations:retireAlpha '{"adminEmail":"…"}'              # dry run (default)
 *   npx convex run migrations:retireAlpha '{"adminEmail":"…","apply":true}'  # writes
 *
 * - the platform admin's tenant gets the top plan (Showroom);
 * - every other Alpha tenant moves to Starter, grandfathered at 50 quotes/month;
 * - alphaSeats rows are deleted and the alpha counters cleared.
 *
 * Idempotent — a second run finds nothing to do.
 */
export const retireAlpha = internalMutation({
  args: { adminEmail: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const adminEmail = args.adminEmail.trim().toLowerCase();
    const changes: Array<{ tenantId: string; name: string; ownerEmail: string | null; from: string; to: string }> = [];
    let adminTenantFound = false;

    for (const t of await ctx.db.query("tenants").collect()) {
      const members = await ctx.db
        .query("memberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", t._id))
        .collect();
      const emails: string[] = [];
      for (const m of members) {
        const email = (await ctx.db.get(m.userId))?.email?.toLowerCase();
        if (email) emails.push(email);
      }
      const isAdminTenant = emails.includes(adminEmail);
      const wasAlpha = (t.plan as string) === "alpha" || t.isAlpha === true || t.createdVia === "alpha_signup";
      if (isAdminTenant) adminTenantFound = true;
      if (!isAdminTenant && !wasAlpha) continue;

      const to = isAdminTenant ? "showroom" : "starter";
      const dirty = t.plan !== to || wasAlpha || t.isAlpha !== undefined || t.alphaSeatNumber !== undefined;
      if (!dirty) continue;

      changes.push({
        tenantId: t._id,
        name: t.name,
        ownerEmail: (await ctx.db.get(t.ownerUserId))?.email ?? null,
        from: t.plan,
        to,
      });
      if (!apply) continue;

      await ctx.db.patch(t._id, {
        plan: to,
        planStatus: "active",
        isAlpha: undefined,
        alphaSeatNumber: undefined,
        alphaDiscountLocked: undefined,
        createdVia: t.createdVia === "alpha_signup" ? "open_signup" : t.createdVia,
        ...(to === "starter" && t.quotaOverrideQuotesPerMonth === undefined ? { quotaOverrideQuotesPerMonth: 50 } : {}),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        tenantId: t._id,
        actorKind: "system",
        action: "alpha.retire",
        targetTable: "tenants",
        targetId: t._id,
        meta: { from: t.plan, to, alphaSeatNumber: t.alphaSeatNumber ?? null },
        createdAt: Date.now(),
      });
    }

    let seatsDeleted = 0;
    for (const seat of await ctx.db.query("alphaSeats").collect()) {
      if (apply) await ctx.db.delete(seat._id);
      seatsDeleted++;
    }
    if (apply) {
      const settings = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "global")).unique();
      if (settings) await ctx.db.patch(settings._id, { alphaSeatCap: undefined, alphaSeatsClaimed: undefined });
    }

    return { applied: apply, adminTenantFound, changes, seatsDeleted };
  },
});
