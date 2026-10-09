import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { requireUser } from "./lib/auth";

const DELETION_GRACE_DAYS = 30;
const EXPORT_NOTIFICATION_CAP = 10_000;
/** In-app notifications older than this are deleted by the daily retention sweep. */
export const NOTIFICATION_RETENTION_DAYS = 365;
const BATCH = 200;

export const getProfile = query({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const tenant = membership ? await ctx.db.get(membership.tenantId) : null;

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const currentSessionId = await getAuthSessionId(ctx);

    const consent = await ctx.db
      .query("userConsents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const pendingDeletion = await ctx.db
      .query("deletionRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    return {
      userId,
      name: user.name ?? "",
      email: user.email ?? "",
      locale: user.locale ?? "it",
      role: membership?.role ?? null,
      tenant: tenant ? { name: tenant.name, plan: tenant.plan } : null,
      sessions: sessions
        .map((s) => ({
          id: s._id,
          current: s._id === currentSessionId,
          createdAt: s._creationTime,
          expiresAt: s.expirationTime,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
      consent: {
        productUpdates: consent?.productUpdates ?? true,
        marketing: consent?.marketing ?? false,
      },
      pendingDeletion: pendingDeletion
        ? { requestedAt: pendingDeletion.requestedAt, scheduledFor: pendingDeletion.scheduledFor }
        : null,
    };
  },
});

export const updateProfile = mutation({
  args: { name: v.optional(v.string()), locale: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const patch: { name?: string; locale?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 1 || name.length > 80) throw new ConvexError("INVALID_NAME");
      patch.name = name;
    }
    if (args.locale !== undefined) {
      if (!["it", "en", "fr", "de", "nl", "ro"].includes(args.locale))
        throw new ConvexError("INVALID_LOCALE");
      patch.locale = args.locale;
    }
    await ctx.db.patch(userId, patch);
  },
});

export const setConsent = mutation({
  args: { productUpdates: v.optional(v.boolean()), marketing: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("userConsents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const next = {
      productUpdates: args.productUpdates ?? row?.productUpdates ?? true,
      marketing: args.marketing ?? row?.marketing ?? false,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert("userConsents", { userId, ...next });
  },
});

export const revokeSession = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new ConvexError("SESSION_NOT_FOUND");

    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const t of tokens) await ctx.db.delete(t._id);
    await ctx.db.delete(args.sessionId);
  },
});

export const revokeOtherSessions = mutation({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const currentSessionId = await getAuthSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    let revoked = 0;
    for (const s of sessions) {
      if (s._id === currentSessionId) continue;
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
        .collect();
      for (const t of tokens) await ctx.db.delete(t._id);
      await ctx.db.delete(s._id);
      revoked++;
    }
    return { revoked };
  },
});

/** GDPR Art. 20 — machine-readable copy of the personal data we hold. */
export const exportMyData = mutation({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("USER_NOT_FOUND");

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Bounded: notifications older than NOTIFICATION_RETENTION_DAYS are
    // purged daily, so this is the complete set in practice; the cap keeps a
    // pathological backlog from exceeding the transaction read limit.
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(EXPORT_NOTIFICATION_CAP);
    const prefs = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const consent = await ctx.db
      .query("userConsents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: userId,
        name: user.name ?? null,
        email: user.email ?? null,
        locale: user.locale ?? null,
        birthDate: user.birthDate ?? null,
        emailVerified: !!user.emailVerificationTime,
        createdAt: new Date(user._creationTime).toISOString(),
      },
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        role: m.role,
        status: m.status,
        joinedAt: m.acceptedAt ? new Date(m.acceptedAt).toISOString() : null,
      })),
      notifications: notifications.map((n) => ({
        type: n.type,
        title: n.title,
        createdAt: new Date(n._creationTime).toISOString(),
        readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      })),
      notificationPreferences: prefs
        ? { mutedInApp: prefs.mutedInApp, mutedEmail: prefs.mutedEmail, timezone: prefs.timezone ?? null }
        : null,
      consent: consent
        ? { productUpdates: consent.productUpdates, marketing: consent.marketing }
        : null,
    };

    return {
      filename: `onespec-dati-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: "application/json",
      content: JSON.stringify(payload, null, 2),
    };
  },
});

/** GDPR Art. 17 — request erasure. Soft, with a 30-day grace window. */
export const requestDeletion = mutation({
  args: { reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("USER_NOT_FOUND");

    // A sole owner cannot delete their account without first handing over or
    // closing the organization — otherwise the tenant is orphaned.
    const ownedMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .collect();
    for (const m of ownedMemberships) {
      const others = await ctx.db
        .query("memberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", m.tenantId))
        .filter((q) => q.and(q.eq(q.field("role"), "owner"), q.neq(q.field("userId"), userId)))
        .collect();
      if (others.length === 0) throw new ConvexError("SOLE_OWNER_MUST_TRANSFER_FIRST");
    }

    const existing = await ctx.db
      .query("deletionRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (existing) return { scheduledFor: existing.scheduledFor };

    const now = Date.now();
    const scheduledFor = now + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
    await ctx.db.insert("deletionRequests", {
      userId,
      email: user.email ?? "",
      reason: args.reason?.slice(0, 500),
      status: "pending",
      requestedAt: now,
      scheduledFor,
    });
    await ctx.db.insert("auditLog", {
      actorUserId: userId,
      actorKind: "user",
      action: "account.deletion_requested",
      targetTable: "users",
      targetId: userId,
      createdAt: now,
    });
    return { scheduledFor };
  },
});

export const cancelDeletion = mutation({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const pending = await ctx.db
      .query("deletionRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (!pending) return;
    await ctx.db.patch(pending._id, { status: "cancelled", resolvedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorUserId: userId,
      actorKind: "user",
      action: "account.deletion_cancelled",
      targetTable: "users",
      targetId: userId,
      createdAt: Date.now(),
    });
  },
});

/* ------------------------------------------------------------------------ */
/*  GDPR Art. 17 — execution of due deletion requests (daily cron)          */
/* ------------------------------------------------------------------------ */

/**
 * Executes every deletion request whose 30-day grace period has passed.
 * The user row is ANONYMISED rather than removed — tenant records (quotes,
 * audit log, assignments) keep a valid reference, but nothing identifies the
 * person any more and they can no longer sign in: auth accounts, sessions,
 * refresh tokens, verification codes, memberships, notifications, prefs and
 * consents are deleted. A user who has meanwhile become a SOLE owner is
 * skipped (the tenant would be orphaned) and retried the next day.
 */
export const processDueDeletions = internalMutation({
  args: {},
  returns: v.object({ processed: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("deletionRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(25);
    let processed = 0;
    let skipped = 0;
    for (const req of due) {
      if (req.scheduledFor > now) continue;
      const done = await anonymiseUser(ctx, req.userId);
      if (!done) {
        skipped++;
        continue;
      }
      await ctx.db.patch(req._id, { status: "completed", resolvedAt: now, email: "", reason: undefined });
      await ctx.db.insert("auditLog", {
        actorKind: "system",
        action: "account.deleted",
        targetTable: "users",
        targetId: req.userId,
        createdAt: now,
      });
      processed++;
    }
    if (due.length === 25 && processed > 0) {
      await ctx.scheduler.runAfter(0, internal.account.processDueDeletions, {});
    }
    return { processed, skipped };
  },
});

async function anonymiseUser(ctx: import("./_generated/server").MutationCtx, userId: import("./_generated/dataModel").Id<"users">): Promise<boolean> {
  const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
  for (const m of memberships) {
    if (m.role !== "owner" || m.status !== "active") continue;
    const otherOwner = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", m.tenantId))
      .filter((q) => q.and(q.eq(q.field("role"), "owner"), q.eq(q.field("status"), "active"), q.neq(q.field("userId"), userId)))
      .first();
    if (!otherOwner) return false;
  }

  for (const m of memberships) await ctx.db.patch(m._id, { status: "removed" });

  const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).take(100);
  for (const sess of sessions) {
    const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", sess._id)).take(500);
    for (const t of tokens) await ctx.db.delete(t._id);
    await ctx.db.delete(sess._id);
  }
  const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).take(20);
  for (const a of accounts) {
    const codes = await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", a._id)).take(50);
    for (const c of codes) await ctx.db.delete(c._id);
    await ctx.db.delete(a._id);
  }

  const notifications = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", userId)).take(1000);
  for (const n of notifications) await ctx.db.delete(n._id);
  if (notifications.length === 1000) {
    await ctx.scheduler.runAfter(0, internal.account.purgeUserNotifications, { userId });
  }
  const prefs = await ctx.db.query("notificationPrefs").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (prefs) await ctx.db.delete(prefs._id);
  const consent = await ctx.db.query("userConsents").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (consent) await ctx.db.delete(consent._id);

  await ctx.db.replace(userId, { name: "Utente eliminato" });
  return true;
}

/** Continues deleting a deleted user's notifications in batches. */
export const purgeUserNotifications = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", args.userId)).take(1000);
    for (const n of rows) await ctx.db.delete(n._id);
    if (rows.length === 1000) await ctx.scheduler.runAfter(0, internal.account.purgeUserNotifications, args);
    return null;
  },
});

/** Daily retention: in-app notifications older than NOTIFICATION_RETENTION_DAYS. Batched. */
export const purgeOldNotifications = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(BATCH * 5);
    for (const n of rows) await ctx.db.delete(n._id);
    if (rows.length === BATCH * 5) await ctx.scheduler.runAfter(0, internal.account.purgeOldNotifications, {});
    return rows.length;
  },
});
