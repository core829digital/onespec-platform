import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireTenantRole, requireMembership } from "./lib/auth";

const QUOTE_STATUS = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("quoted"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("spam"),
);

export const listRequests = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(QUOTE_STATUS),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("quoteRequests")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", status),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("quoteRequests")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const getRequest = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return null;
    await requireMembership(ctx, quote.tenantId);
    return quote;
  },
});

export const updateStatus = mutation({
  args: { quoteId: v.id("quoteRequests"), status: v.union(v.literal("new"), v.literal("contacted"), v.literal("quoted"), v.literal("won"), v.literal("lost"), v.literal("spam")) },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    const oldStatus = quote.status;
    await ctx.db.patch(args.quoteId, { status: args.status });

    await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
      tenantId: quote.tenantId,
      type: "quote_status_changed",
      data: { quoteId: args.quoteId, oldStatus, newStatus: args.status, leadName: quote.leadName },
      href: `/app/requests/${args.quoteId}`,
    });

    await ctx.db.insert("auditLog", {
      tenantId: quote.tenantId,
      actorKind: "user",
      action: "quote.status_change",
      targetTable: "quoteRequests",
      targetId: args.quoteId,
      meta: { oldStatus, newStatus: args.status },
      createdAt: Date.now(),
    });
  },
});

export const assignRequest = mutation({
  args: { quoteId: v.id("quoteRequests"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    const assigneeMembership = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", quote.tenantId).eq("userId", args.userId),
      )
      .unique();
    if (!assigneeMembership || assigneeMembership.status !== "active") {
      throw new ConvexError("ASSIGNEE_NOT_A_MEMBER");
    }

    await ctx.db.patch(args.quoteId, { assignedToUserId: args.userId });
  },
});

export const addNote = mutation({
  args: { quoteId: v.id("quoteRequests"), note: v.string() },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    await ctx.db.patch(args.quoteId, { internalNotes: (quote.internalNotes || "") + "\n" + args.note });
  },
});