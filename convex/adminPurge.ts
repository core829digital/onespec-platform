import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * One-off, internal-only: delete EVERY account except the ones whose e-mail is
 * listed in `keepEmails`, together with everything that belongs to them.
 *
 * Run it from the Convex dashboard (Functions → adminPurge → purgeAccountsExcept)
 * or `npx convex run --prod adminPurge:purgeAccountsExcept '{...}'`.
 *
 * Safe by construction:
 *  - `dryRun` defaults to TRUE: it only reports what it WOULD delete.
 *  - a real run needs `confirm: "DELETE-ALL-EXCEPT-KEPT"`.
 *  - it aborts if any kept e-mail is not found (typo protection).
 *  - it refuses to delete a platform admin or an `unlimitedAccess` tenant
 *    unless `allowProtected: true` is passed explicitly.
 *  - a tenant is kept whenever a kept user owns it or is a member of it.
 *
 * It does NOT touch Stripe (customers/subscriptions must be removed in the
 * Stripe Dashboard — the dry run lists the customer ids) and leaves uploaded
 * files in Convex storage orphaned (harmless).
 */

/** Tables that carry a `tenantId` — wiped for every tenant being deleted. */
export const TENANT_TABLES = [
  "billingEvents",
  "trialFingerprints",
  "memberships",
  "invitations",
  "dpaAcceptances",
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
  "alphaFeedback",
  "emailLog",
  "emailDeliveryLog",
  "auditLog",
  "usageCounters",
  "meteredEvents",
  "siteSurveys",
  "installationDossiers",
  "inspectionReports",
  "serramentoPassports",
  "passportInterventions",
  "clients",
  "clientActivities",
  "cantieri",
  "cantiereTasks",
  "logisticsSuppliers",
  "carriers",
  "deliveries",
  "inventoryItems",
  "siteDeliveries",
] as const;

/** Tables keyed by `userId` — wiped for every user being deleted. */
export const USER_TABLES = ["deletionRequests", "userConsents", "notificationPrefs", "notifications", "meteredEvents", "alphaFeedback"] as const;

type Plan = {
  keepUserIds: Id<"users">[];
  keepTenantIds: Id<"tenants">[];
  doomedUsers: Array<{ id: Id<"users">; email: string | null; isPlatformAdmin: boolean }>;
  doomedTenants: Array<{ id: Id<"tenants">; name: string; plan: string; planStatus: string; stripeCustomerId: string | null; unlimitedAccess: boolean }>;
  missingEmails: string[];
};

export const planPurge = internalQuery({
  args: { keepEmails: v.array(v.string()) },
  handler: async (ctx, args): Promise<Plan> => {
    const keep = new Set(args.keepEmails.map((e) => e.trim().toLowerCase()));
    // Pre-launch scale: a full read is fine for this one-off admin script.
    const users = await ctx.db.query("users").collect();
    const keptUsers = users.filter((u) => u.email && keep.has(u.email.toLowerCase()));
    const found = new Set(keptUsers.map((u) => u.email!.toLowerCase()));
    const missingEmails = [...keep].filter((e) => !found.has(e));
    const keepUserIds = new Set(keptUsers.map((u) => u._id));

    const tenants = await ctx.db.query("tenants").collect();
    const memberships = await ctx.db.query("memberships").collect();
    const keepTenantIds = new Set<Id<"tenants">>();
    for (const t of tenants) if (keepUserIds.has(t.ownerUserId)) keepTenantIds.add(t._id);
    for (const m of memberships) if (keepUserIds.has(m.userId)) keepTenantIds.add(m.tenantId);

    return {
      keepUserIds: [...keepUserIds],
      keepTenantIds: [...keepTenantIds],
      doomedUsers: users
        .filter((u) => !keepUserIds.has(u._id))
        .map((u) => ({ id: u._id, email: u.email ?? null, isPlatformAdmin: u.isPlatformAdmin === true })),
      doomedTenants: tenants
        .filter((t) => !keepTenantIds.has(t._id))
        .map((t) => ({
          id: t._id,
          name: t.name,
          plan: t.plan,
          planStatus: t.planStatus,
          stripeCustomerId: t.stripeCustomerId ?? null,
          unlimitedAccess: t.unlimitedAccess === true,
        })),
      missingEmails,
    };
  },
});

/** Deletes the rows of one page of `table` that belong to the given tenants/users. */
export const purgeTablePage = internalMutation({
  args: {
    table: v.string(),
    field: v.union(v.literal("tenantId"), v.literal("userId")),
    ids: v.array(v.string()),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args): Promise<{ deleted: number; next: string | null }> => {
    const ids = new Set(args.ids);
    const page = await ctx.db.query(args.table as never).paginate({ numItems: 200, cursor: args.cursor });
    let deleted = 0;
    for (const row of page.page as Array<Record<string, unknown> & { _id: never }>) {
      const ref = row[args.field];
      if (typeof ref === "string" && ids.has(ref)) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted, next: page.isDone ? null : page.continueCursor };
  },
});

/** Removes the sign-in data of one user (sessions, tokens, accounts, codes). */
export const purgeUserAuth = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    for (const s of sessions) {
      const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect();
      for (const t of tokens) await ctx.db.delete(t._id);
      await ctx.db.delete(s._id);
    }
    const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId)).collect();
    for (const a of accounts) {
      const codes = await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", a._id)).collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(args.userId);
  },
});

export const deleteTenant = internalMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.delete(args.tenantId);
  },
});

/** Memberships/invitations of kept tenants that point at a deleted user. */
export const dropKeptTenantLinks = internalMutation({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args): Promise<number> => {
    const doomed = new Set<string>(args.userIds);
    let n = 0;
    for (const m of await ctx.db.query("memberships").collect()) {
      if (doomed.has(m.userId)) { await ctx.db.delete(m._id); n++; }
    }
    for (const i of await ctx.db.query("invitations").collect()) {
      if (doomed.has(i.invitedByUserId)) { await ctx.db.delete(i._id); n++; }
    }
    return n;
  },
});

async function sweep(
  ctx: { runMutation: (fn: typeof internal.adminPurge.purgeTablePage, a: { table: string; field: "tenantId" | "userId"; ids: string[]; cursor: string | null }) => Promise<{ deleted: number; next: string | null }> },
  table: string,
  field: "tenantId" | "userId",
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let total = 0;
  let cursor: string | null = null;
  do {
    const r: { deleted: number; next: string | null } = await ctx.runMutation(internal.adminPurge.purgeTablePage, { table, field, ids, cursor });
    total += r.deleted;
    cursor = r.next;
  } while (cursor);
  return total;
}

export const purgeAccountsExcept = internalAction({
  args: {
    keepEmails: v.array(v.string()),
    dryRun: v.optional(v.boolean()),
    confirm: v.optional(v.string()),
    allowProtected: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const dryRun = args.dryRun !== false;
    if (args.keepEmails.length === 0) throw new Error("keepEmails must not be empty");
    const plan: Plan = await ctx.runQuery(internal.adminPurge.planPurge, { keepEmails: args.keepEmails });
    if (plan.missingEmails.length > 0) {
      throw new Error(`Aborted: these kept e-mails were not found: ${plan.missingEmails.join(", ")}`);
    }
    const protectedHits = [
      ...plan.doomedUsers.filter((u) => u.isPlatformAdmin).map((u) => `platform admin ${u.email}`),
      ...plan.doomedTenants.filter((t) => t.unlimitedAccess).map((t) => `full-access tenant "${t.name}"`),
    ];
    const report = {
      dryRun,
      keeping: { users: plan.keepUserIds.length, tenants: plan.keepTenantIds.length },
      deleting: {
        users: plan.doomedUsers.map((u) => u.email ?? "(no email)"),
        tenants: plan.doomedTenants.map((t) => `${t.name} [${t.plan}/${t.planStatus}]`),
      },
      stripeCustomersToRemoveManually: plan.doomedTenants.map((t) => t.stripeCustomerId).filter(Boolean),
      protectedHits,
    };
    if (protectedHits.length > 0 && !args.allowProtected) {
      return { ...report, aborted: "Protected accounts would be deleted. Re-run with allowProtected:true if intended." };
    }
    if (dryRun) return report;
    if (args.confirm !== "DELETE-ALL-EXCEPT-KEPT") {
      return { ...report, aborted: 'Real run needs confirm: "DELETE-ALL-EXCEPT-KEPT".' };
    }

    const tenantIds = plan.doomedTenants.map((t) => t.id as string);
    const userIds = plan.doomedUsers.map((u) => u.id as string);
    const deleted: Record<string, number> = {};
    for (const table of TENANT_TABLES) deleted[table] = await sweep(ctx as never, table, "tenantId", tenantIds);
    for (const table of USER_TABLES) {
      deleted[`${table}(by user)`] = await sweep(ctx as never, table, "userId", userIds);
    }
    deleted.keptTenantLinks = await ctx.runMutation(internal.adminPurge.dropKeptTenantLinks, {
      userIds: plan.doomedUsers.map((u) => u.id),
    });
    for (const t of plan.doomedTenants) await ctx.runMutation(internal.adminPurge.deleteTenant, { tenantId: t.id });
    for (const u of plan.doomedUsers) await ctx.runMutation(internal.adminPurge.purgeUserAuth, { userId: u.id });
    return { ...report, deleted, done: true };
  },
});
