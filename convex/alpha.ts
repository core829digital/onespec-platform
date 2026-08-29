import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requirePlatformAdmin } from "./lib/auth";

// The alpha seat claim itself lives in `tenants.registerTenant` (single code
// path, OCC-safe counter on the appSettings singleton).

export const getSeatStatus = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) return { claimed: 0, cap: 250, open: false };
    return {
      claimed: settings.alphaSeatsClaimed,
      cap: settings.alphaSeatCap,
      open: settings.registrationOpen,
    };
  },
});

export const raiseSeatCap = mutation({
  args: { newCap: v.number() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");
    if (args.newCap <= settings.alphaSeatCap) throw new ConvexError("CAP_MUST_INCREASE");
    await ctx.db.patch(settings._id, {
      alphaSeatCap: args.newCap,
      updatedAt: Date.now(),
      updatedByUserId: (await requirePlatformAdmin(ctx)) as any,
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "seatCap.raise",
      meta: { oldCap: settings.alphaSeatCap, newCap: args.newCap },
      createdAt: Date.now(),
    });
  },
});

export const toggleRegistration = mutation({
  args: { open: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const settings = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");
    await ctx.db.patch(settings._id, {
      registrationOpen: args.open,
      updatedAt: Date.now(),
      updatedByUserId: (await requirePlatformAdmin(ctx)) as any,
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "registration.toggle",
      meta: { open: args.open },
      createdAt: Date.now(),
    });
  },
});