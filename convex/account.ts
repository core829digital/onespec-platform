import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { requireUser } from "./lib/auth";
import { resolveTenantEntitlements } from "./lib/entitlements";

const DELETION_GRACE_DAYS = 30;

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

    // The Alpha Member badge is only shown when the entitlement is actually
    // verified server-side; otherwise the user gets a neutral identity badge.
    const entitlements = tenant ? resolveTenantEntitlements(tenant) : null;
    const alphaVerified =
      !!tenant?.isAlpha && !!entitlements && entitlements.lifetimeDiscountPct >= 15;

    return {
      userId,
      name: user.name ?? "",
      email: user.email ?? "",
      locale: user.locale ?? "it",
      role: membership?.role ?? null,
      tenant: tenant ? { name: tenant.name, plan: tenant.plan } : null,
      alpha: alphaVerified
        ? { verified: true as const, seatNumber: tenant?.alphaSeatNumber ?? null }
        : { verified: false as const },
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
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
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
