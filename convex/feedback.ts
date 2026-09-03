import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireUser, requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";

export const submitFeedback = mutation({
  args: {
    category: v.union(v.literal("bug"), v.literal("feature"), v.literal("general")),
    message: v.string(),
    pagePath: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const message = args.message.trim();
    if (message.length < 3 || message.length > 4000) throw new ConvexError("INVALID_MESSAGE");

    const ok = await consumeToken(ctx, `feedback:${userId}`, {
      tokens: 8,
      refillMs: 60 * 60 * 1000,
    });
    if (!ok) throw new ConvexError("RATE_LIMITED");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const id = await ctx.db.insert("alphaFeedback", {
      tenantId: membership?.tenantId,
      userId,
      category: args.category,
      message,
      pagePath: args.pagePath?.slice(0, 200),
      userAgent: args.userAgent?.slice(0, 300),
      status: "new",
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      tenantId: membership?.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "feedback.submit",
      targetTable: "alphaFeedback",
      targetId: id,
      meta: { category: args.category },
      createdAt: Date.now(),
    });

    // Notify every platform admin (carry the submitter's tenant as context).
    if (membership?.tenantId) {
      const admins = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("isPlatformAdmin"), true))
        .collect();
      const user = await ctx.db.get(userId);
      for (const a of admins) {
        await ctx.db.insert("notifications", {
          tenantId: membership.tenantId,
          userId: a._id,
          type: "system",
          title: `Feedback (${args.category}) da ${user?.email ?? user?.name ?? "utente"}`,
          data: { message: message.slice(0, 200) },
          href: "/app/admin",
          entityTable: "alphaFeedback",
          entityId: id,
        });
      }
    }
    return { id };
  },
});

export const listFeedback = query({
  args: { status: v.optional(v.union(v.literal("new"), v.literal("triaged"), v.literal("closed"))) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const rows = args.status
      ? await ctx.db
          .query("alphaFeedback")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(200)
      : await ctx.db.query("alphaFeedback").order("desc").take(200);
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        userEmail: (await ctx.db.get(r.userId))?.email ?? null,
      })),
    );
  },
});

export const setFeedbackStatus = mutation({
  args: {
    id: v.id("alphaFeedback"),
    status: v.union(v.literal("new"), v.literal("triaged"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});
