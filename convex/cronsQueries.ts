import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getCronJob = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("cronJobs").withIndex("by_name", (q) => q.eq("name", args.name)).unique();
  },
});

export const listCronJobs = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("cronJobs").collect();
  },
});

export const updateCronJob = internalMutation({
  args: {
    name: v.string(),
    status: v.optional(v.union(v.literal("scheduled"), v.literal("running"), v.literal("completed"), v.literal("failed"))),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    runCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cron = await ctx.db.query("cronJobs").withIndex("by_name", (q) => q.eq("name", args.name)).unique();
    if (!cron) throw new Error("Cron job not found");

    const update: Record<string, unknown> = {};
    if (args.status) update.status = args.status;
    if (args.lastRunAt) update.lastRunAt = args.lastRunAt;
    if (args.nextRunAt) update.nextRunAt = args.nextRunAt;
    if (args.lastError) update.lastError = args.lastError;
    if (args.runCount !== undefined) update.runCount = args.runCount;

    await ctx.db.patch(cron._id, update);
  },
});

export const listAllSubscriptions = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("subscriptions").collect();
  },
});

export const listImportJobs = internalQuery({
  args: { tenantId: v.optional(v.id("tenants")), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("importJobs");
    if (args.tenantId) q = q.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
    if (args.status) q = q.filter((q) => q.eq(q.field("status"), args.status));
    return await q.collect();
  },
});

export const listExportJobs = internalQuery({
  args: { tenantId: v.optional(v.id("tenants")), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("exportJobs");
    if (args.tenantId) q = q.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
    if (args.status) q = q.filter((q) => q.eq(q.field("status"), args.status));
    return await q.collect();
  },
});