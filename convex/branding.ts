import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { resolveTenantEntitlements } from "./lib/entitlements";
import { consumeUploadSlot, scheduleSniff } from "./lib/uploads";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const COPY_MAX_BYTES = 20_000;

/**
 * Colours end up in the PUBLIC widget's styles: only plain colour values are
 * accepted (hex, rgb/rgba, hsl/hsla), never arbitrary CSS (`red; background:
 * url(...)`). Empty string = "use the default".
 */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[0-9.%\s,/deg]+\))$/;
function cleanColor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const c = value.trim();
  if (c === "") return c;
  if (c.length > 64 || !COLOR_RE.test(c)) throw new ConvexError("INVALID_INPUT");
  return c;
}

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
    await requirePermission(ctx, configurator.tenantId, "branding.manage");

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    const tenant = await ctx.db.get(configurator.tenantId);
    const whiteLabelAllowed = !!tenant && resolveTenantEntitlements(tenant).whiteLabel;

    const update: Partial<Doc<"branding">> = {};
    // The editor always sends whiteLabel. Without the entitlement it is stored
    // as false rather than refused, so a downgraded tenant can still save the
    // rest of its branding (the public widget also re-checks the plan).
    if (args.whiteLabel !== undefined) update.whiteLabel = args.whiteLabel && whiteLabelAllowed;
    const accent = cleanColor(args.colorAccent);
    if (accent) update.colorAccent = accent;
    const ink = cleanColor(args.colorAccentInk);
    if (ink) update.colorAccentInk = ink;
    if (args.colorBg !== undefined) update.colorBg = cleanColor(args.colorBg) || undefined;
    if (args.colorBgDark !== undefined) update.colorBgDark = cleanColor(args.colorBgDark) || undefined;
    if (args.fontFamily !== undefined) update.fontFamily = args.fontFamily;
    if (args.copy !== undefined) {
      if (JSON.stringify(args.copy ?? null).length > COPY_MAX_BYTES) throw new ConvexError("INVALID_INPUT");
      update.copy = args.copy;
    }
    if (args.companyInfo !== undefined) {
      const ci = args.companyInfo;
      if (ci.name.length > 200 || [ci.vatId, ci.address, ci.phone, ci.email].some((x) => x !== undefined && x.length > 300)) {
        throw new ConvexError("INVALID_INPUT");
      }
      update.companyInfo = ci;
    }

    await ctx.db.patch(branding._id, update);
  },
});

export const generateUploadUrl = mutation({
  args: { configuratorId: v.id("configurators"), contentType: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    const { userId } = await requirePermission(ctx, configurator.tenantId, "branding.manage");
    if (!IMAGE_TYPES.includes(args.contentType)) throw new ConvexError("UNSUPPORTED_IMAGE_TYPE");
    await consumeUploadSlot(ctx, configurator.tenantId, userId);

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const setLogo = mutation({
  args: { configuratorId: v.id("configurators"), storageId: v.id("_storage"), variant: v.union(v.literal("dark"), v.literal("light")) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "branding.manage");

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    // Verify what was ACTUALLY uploaded (the content type passed to
    // generateUploadUrl is only the client's claim).
    const meta = await ctx.db.system.get(args.storageId);
    if (!meta || !meta.contentType || !IMAGE_TYPES.includes(meta.contentType) || meta.size > LOGO_MAX_BYTES) {
      if (meta) await ctx.storage.delete(args.storageId);
      throw new ConvexError(meta && meta.size > LOGO_MAX_BYTES ? "IMAGE_TOO_LARGE" : "UNSUPPORTED_IMAGE_TYPE");
    }

    await scheduleSniff(ctx, args.storageId, "brandLogo");
    const prev = args.variant === "dark" ? branding.logoStorageId : branding.logoLightStorageId;
    if (prev && prev !== args.storageId) await ctx.storage.delete(prev).catch(() => undefined); // may already be gone (quarantined)
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
    await requirePermission(ctx, configurator.tenantId, "branding.manage");

    const branding = await ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique();
    if (!branding) throw new ConvexError("BRANDING_NOT_FOUND");

    const prev = args.variant === "dark" ? branding.logoStorageId : branding.logoLightStorageId;
    if (prev) await ctx.storage.delete(prev).catch(() => undefined);
    await ctx.db.patch(
      branding._id,
      args.variant === "dark" ? { logoStorageId: undefined } : { logoLightStorageId: undefined },
    );
  },
});