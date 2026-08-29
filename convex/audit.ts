import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePlatformAdmin } from "./lib/auth";

/**
 * Append an audit-log row. Internal only — never callable from a client
 * (prevents audit forgery).
 */
export const log = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    actorUserId: v.optional(v.id("users")),
    actorKind: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("system"),
      v.literal("widget"),
    ),
    action: v.string(),
    targetTable: v.optional(v.string()),
    targetId: v.optional(v.string()),
    meta: v.optional(v.any()),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", { ...args, createdAt: Date.now() });
  },
});

export const listAudit = query({
  args: {
    tenantId: v.optional(v.id("tenants")),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const limit = args.limit ?? 100;

    if (args.tenantId) {
      const tid = args.tenantId;
      return await ctx.db
        .query("auditLog")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tid))
        .order("desc")
        .take(limit);
    }
    if (args.action) {
      const action = args.action;
      return await ctx.db
        .query("auditLog")
        .withIndex("by_action", (q) => q.eq("action", action))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("auditLog").order("desc").take(limit);
  },
});
