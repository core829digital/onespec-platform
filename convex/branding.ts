import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireTenantRole, requireMembership } from "./lib/auth";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export const getBranding = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);
    const branding = await ctx.db
      .query("branding")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .unique();
    if (!branding) return null;
    const logoUrl = branding.logoStorageId ? await ctx.storage.getUrl(branding.logoStorageId) : null;
    const logoLightUrl = branding.logoLightStorageId
      ? await ctx.storage.getUrl(branding.logoLightStorageId)
      : null;
    return { ...branding, logoUrl, logoLightUrl };
  },
});

export const updateBranding = mutation({
  args: {
    configuratorId: v.id("configurators"),
    whiteLabel: v.optional(v.boolean()),
    colorAccent: v.optional(v.string()),
    colorAccentInk: v.optional(v.string()),
    colorBg: v.optional(v.string()),
    colorBgDark: v.optional(v.string()),
    fontFamily: v.optional(v.union(v.literal("space-grotesk"), v.literal("inter"), v.literal("geist"), v.literal("system"))),
    copy: v.optional(v.any()),
    companyInfo: v.optional(v.object({
      name: v.string(),
      vatId: v.optional(v.string()),
      address: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    const update: Partial<Doc<"branding">> = {};
    if (args.whiteLabel !== undefined) update.whiteLabel = args.whiteLabel;
    if (args.colorAccent !== undefined) update.colorAccent = args.colorAccent;
    if (args.colorAccentInk !== undefined) update.colorAccentInk = args.colorAccentInk;
    if (args.colorBg !== undefined) update.colorBg = args.colorBg;
    if (args.colorBgDark !== undefined) update.colorBgDark = args.colorBgDark;
    if (args.fontFamily !== undefined) update.fontFamily = args.fontFamily;
    if (args.copy !== undefined) update.copy = args.copy;
    if (args.companyInfo !== undefined) update.companyInfo = args.companyInfo;

    await ctx.db.patch(branding._id, update);
  },
});

export const generateUploadUrl = mutation({
  args: { configuratorId: v.id("configurators"), contentType: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);
    if (!IMAGE_TYPES.includes(args.contentType)) throw new ConvexError("UNSUPPORTED_IMAGE_TYPE");

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const setLogo = mutation({
  args: { configuratorId: v.id("configurators"), storageId: v.id("_storage"), variant: v.union(v.literal("dark"), v.literal("light")) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    const prev = args.variant === "dark" ? branding.logoStorageId : branding.logoLightStorageId;
    if (prev && prev !== args.storageId) await ctx.storage.delete(prev);
    await ctx.db.patch(
      branding._id,
      args.variant === "dark"
        ? { logoStorageId: args.storageId }
        : { logoLightStorageId: args.storageId },
    );
  },
});

export const deleteLogo = mutation({
  args: { configuratorId: v.id("configurators"), variant: v.union(v.literal("dark"), v.literal("light")) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    const prev = args.variant === "dark" ? branding.logoStorageId : branding.logoLightStorageId;
    if (prev) await ctx.storage.delete(prev);
    await ctx.db.patch(
      branding._id,
      args.variant === "dark" ? { logoStorageId: undefined } : { logoLightStorageId: undefined },
    );
  },
});