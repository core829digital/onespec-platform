import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requirePlatformAdmin } from "./lib/auth";

/** Whether new signups are accepted (admin-controlled). */
export const getRegistrationStatus = query({
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const settings = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "global")).unique();
    return { open: settings?.registrationOpen ?? false };
  },
});

export const toggleRegistration = mutation({
  args: { open: v.boolean() },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const settings = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "global")).unique();
    if (!settings) throw new ConvexError("SETTINGS_NOT_FOUND");
    await ctx.db.patch(settings._id, {
      registrationOpen: args.open,
      updatedAt: Date.now(),
      updatedByUserId: adminId,
    });
    await ctx.db.insert("auditLog", {
      actorKind: "admin",
      action: "registration.toggle",
      meta: { open: args.open },
      createdAt: Date.now(),
    });
  },
});
