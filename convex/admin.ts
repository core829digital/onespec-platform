import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requirePlatformAdmin } from "./lib/auth";

export const getSeatCount = query({
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) return { claimed: 0, cap: 250 };
    return { claimed: settings.alphaSeatsClaimed, cap: settings.alphaSeatCap };
  },
});

export const listTenants = query({
  args: { limit: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const tenants = await ctx.db.query("tenants").order("desc").take(args.limit || 50);
    return tenants;
  },
});

export const recentSignups = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const signups = await ctx.db.query("users").order("desc").take(args.limit || 20);
    return signups;
  },
});

export const listEmails = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.query("emailLog").order("desc").take(args.limit || 50);
  },
});

/**
 * Re-send a logged email. We don't persist the original template `data`, so a
 * resend re-renders with empty data (fine for welcome/verify/reset which read a
 * code we no longer have — use this mainly to retry a `new_quote_request`).
 */
export const resendEmail = mutation({
  args: { emailLogId: v.id("emailLog") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const log = await ctx.db.get(args.emailLogId);
    if (!log) throw new ConvexError("EMAIL_LOG_NOT_FOUND");
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template: log.template,
      to: log.to,
      locale: "it",
      data: {},
      tenantId: log.tenantId ?? undefined,
      relatedEntityId: log.relatedEntityId ?? undefined,
    });
  },
});

// Seat-cap + registration controls live in `convex/alpha.ts`
// (raiseSeatCap, toggleRegistration, getSeatStatus).