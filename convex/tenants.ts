import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireVerifiedUser, requirePlatformAdmin, requireMembership } from "./lib/auth";
import { nanoid } from "./lib/ids";

export const registerTenant = mutation({
  args: { companyName: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const existing = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (existing) throw new ConvexError("ALREADY_HAS_TENANT");

    // ── Atomic alpha-seat claim ──────────────────────────────────────────────
    // Convex mutations are serializable OCC transactions: this reads the
    // `appSettings` singleton and later patches `alphaSeatsClaimed` on it. If two
    // signups race, the first commits and the second's read set is invalidated,
    // so Convex re-runs it against the incremented counter. Over-allocation past
    // the cap is therefore impossible without any explicit lock.
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");

    const isAlpha = settings.alphaSeatsClaimed < settings.alphaSeatCap;
    let tenantId: any;
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
    const { membership } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const update: any = { updatedAt: Date.now() };
    if (args.name !== undefined) update.name = args.name;
    if (args.country !== undefined) update.country = args.country;
    await ctx.db.patch(args.tenantId, update);
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

async function requireTenantRole(ctx: any, tenantId: any, roles: string[]) {
  const userId = await requireVerifiedUser(ctx);
  const membership = await ctx.db.query("memberships").withIndex("by_tenant_user", q => q.eq("tenantId", tenantId).eq("userId", userId)).unique();
  if (!membership || membership.status !== "active" || !roles.includes(membership.role)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  return { userId, membership };
}