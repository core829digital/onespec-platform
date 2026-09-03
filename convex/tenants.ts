import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireVerifiedUser,
  requireUser,
  requirePlatformAdmin,
  requireMembership,
  requireTenantRole,
} from "./lib/auth";
import { nanoid } from "./lib/ids";
import { resolveTenantEntitlements, assertQuota } from "./lib/entitlements";

const COUNTRY_RE = /^[A-Za-z]{2}$/;

export const registerTenant = mutation({
  args: { companyName: v.string(), country: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (existing) throw new ConvexError("ALREADY_HAS_TENANT");

    const country = args.country && COUNTRY_RE.test(args.country) ? args.country.toUpperCase() : undefined;
    if (country) await ctx.db.patch(userId, { country });

    // ── Atomic alpha-seat claim ──────────────────────────────────────────────
    // Convex mutations are serializable OCC transactions: this reads the
    // `appSettings` singleton and later patches `alphaSeatsClaimed` on it. If two
    // signups race, the first commits and the second's read set is invalidated,
    // so Convex re-runs it against the incremented counter. Over-allocation past
    // the cap is therefore impossible without any explicit lock.
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");

    const isAlpha = settings.alphaSeatsClaimed < settings.alphaSeatCap;
    let tenantId: Id<"tenants">;
    let alphaSeatNumber: number | undefined;

    if (isAlpha) {
      const seatNumber = settings.alphaSeatsClaimed + 1;
      const existingSeat = await ctx.db.query("alphaSeats").withIndex("by_seatNumber", q => q.eq("seatNumber", seatNumber)).unique();
      if (existingSeat) throw new ConvexError("SEAT_CONFLICT");

      const user = await ctx.db.get(userId);
      tenantId = await ctx.db.insert("tenants", {
        name: args.companyName,
        slug: args.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + nanoid(6),
        ownerUserId: userId,
        country,
        isAlpha: true,
        alphaSeatNumber: seatNumber,
        plan: "alpha",
        planStatus: "active",
        alphaDiscountLocked: true,
        createdVia: "alpha_signup",
        createdAt: Date.now(),
      });

      await ctx.db.insert("alphaSeats", {
        seatNumber,
        tenantId,
        userId,
        email: user?.email || "",
        claimedAt: Date.now(),
      });

      await ctx.db.patch(settings._id, {
        alphaSeatsClaimed: seatNumber,
        updatedAt: Date.now(),
        updatedByUserId: userId,
      });

      await ctx.db.insert("auditLog", {
        actorUserId: userId,
        actorKind: "user",
        action: "seat.claim",
        meta: { seatNumber },
        createdAt: Date.now(),
      });

      alphaSeatNumber = seatNumber;
    } else {
      if (!settings.registrationOpen) throw new ConvexError("REGISTRATION_CLOSED");
      tenantId = await ctx.db.insert("tenants", {
        name: args.companyName,
        slug: args.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + nanoid(6),
        ownerUserId: userId,
        country,
        isAlpha: false,
        plan: "starter",
        planStatus: "trialing",
        alphaDiscountLocked: false,
        createdVia: "open_signup",
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("memberships", {
      tenantId,
      userId,
      role: "owner",
      status: "active",
      acceptedAt: Date.now(),
    });

    const template = isAlpha ? "welcome_alpha" : "welcome";
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template,
      to: (await ctx.db.get(userId))?.email || "",
      locale: "it",
      data: { companyName: args.companyName, seatNumber: alphaSeatNumber },
      tenantId,
    });

    return { alpha: isAlpha, seatNumber: alphaSeatNumber, tenantId };
  },
});

export const getMyTenant = query({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const membership = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (!membership) return null;
    return await ctx.db.get(membership.tenantId);
  },
});

export const getTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    return await ctx.db.get(args.tenantId);
  },
});

export const listMembers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          userName: user?.name ?? null,
          userEmail: user?.email ?? null,
        };
      }),
    );
  },
});

export const updateTenant = mutation({
  args: { tenantId: v.id("tenants"), name: v.optional(v.string()), country: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const update: Partial<Doc<"tenants">> = { updatedAt: Date.now() };
    if (args.name !== undefined) update.name = args.name;
    if (args.country !== undefined) update.country = args.country;
    await ctx.db.patch(args.tenantId, update);
  },
});

// ── Team invitations ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const listInvitations = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const rows = await ctx.db
      .query("invitations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    return rows
      .filter((r) => !r.acceptedAt && r.expiresAt > Date.now())
      .map((r) => ({ _id: r._id, email: r.email, role: r.role, expiresAt: r.expiresAt }));
  },
});

export const inviteMember = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) throw new ConvexError("INVALID_EMAIL");

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");

    // Already a member?
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      if (u?.email?.toLowerCase() === email) throw new ConvexError("ALREADY_MEMBER");
    }

    // Pending invite for this email?
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const pending = existing.find(
      (i) => i.tenantId === args.tenantId && !i.acceptedAt && i.expiresAt > Date.now(),
    );
    if (pending) throw new ConvexError("ALREADY_INVITED");

    // Seat quota: active members + pending invites.
    const activeMembers = members.filter((m) => m.status === "active").length;
    const pendingCount = existing.filter(
      (i) => i.tenantId === args.tenantId && !i.acceptedAt && i.expiresAt > Date.now(),
    ).length;
    assertQuota(
      activeMembers + pendingCount,
      resolveTenantEntitlements(tenant).maxTeamMembers,
      "MEMBER_LIMIT_REACHED",
    );

    const token = nanoid(32);
    const invitationId = await ctx.db.insert("invitations", {
      tenantId: args.tenantId,
      email,
      role: args.role,
      token,
      invitedByUserId: userId,
      expiresAt: Date.now() + INVITE_TTL_MS,
    });

    const inviter = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template: "invitation",
      to: email,
      locale: "it",
      data: {
        companyName: tenant.name,
        inviterName: inviter?.name ?? inviter?.email ?? undefined,
        role: args.role === "admin" ? "amministratore" : "membro",
        acceptUrl: `${process.env.SITE_URL ?? "http://localhost:3000"}/invite/${token}`,
      },
      tenantId: args.tenantId,
    });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "team.invite",
      targetTable: "invitations",
      targetId: invitationId,
      meta: { email, role: args.role },
      createdAt: Date.now(),
    });
    return { invitationId };
  },
});

export const cancelInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) return;
    await requireTenantRole(ctx, inv.tenantId, ["owner", "admin"]);
    await ctx.db.delete(args.invitationId);
  },
});

export const removeMember = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) return;
    const { userId } = await requireTenantRole(ctx, membership.tenantId, ["owner", "admin"]);
    if (membership.role === "owner") throw new ConvexError("CANNOT_REMOVE_OWNER");
    await ctx.db.delete(args.membershipId);
    await ctx.db.insert("auditLog", {
      tenantId: membership.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "team.remove_member",
      targetTable: "memberships",
      targetId: args.membershipId,
      createdAt: Date.now(),
    });
  },
});

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) return null;
    const tenant = await ctx.db.get(inv.tenantId);
    return {
      email: inv.email,
      role: inv.role,
      tenantName: tenant?.name ?? "—",
      expired: inv.expiresAt <= Date.now(),
      accepted: !!inv.acceptedAt,
    };
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const inv = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!inv) throw new ConvexError("INVITATION_NOT_FOUND");
    if (inv.acceptedAt) throw new ConvexError("INVITATION_USED");
    if (inv.expiresAt <= Date.now()) throw new ConvexError("INVITATION_EXPIRED");

    const user = await ctx.db.get(userId);
    if (user?.email && user.email.toLowerCase() !== inv.email) {
      throw new ConvexError("INVITATION_EMAIL_MISMATCH");
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new ConvexError("ALREADY_HAS_TENANT");

    await ctx.db.insert("memberships", {
      tenantId: inv.tenantId,
      userId,
      role: inv.role,
      invitedByUserId: inv.invitedByUserId,
      status: "active",
      acceptedAt: Date.now(),
    });
    await ctx.db.patch(inv._id, { acceptedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      tenantId: inv.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "team.invite_accepted",
      targetTable: "memberships",
      createdAt: Date.now(),
    });
    return { tenantId: inv.tenantId };
  },
});

export const suspendTenant = mutation({
  args: { tenantId: v.id("tenants"), reason: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    await ctx.db.patch(args.tenantId, {
      suspendedAt: Date.now(),
      suspendedReason: args.reason,
      planStatus: "suspended",
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "tenant.suspend",
      targetTable: "tenants",
      targetId: args.tenantId,
      meta: { reason: args.reason },
      createdAt: Date.now(),
    });
  },
});

