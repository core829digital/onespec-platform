import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireTenantRole, requireMembership } from "./lib/auth";
import { nanoid } from "./lib/ids";
import { resolveTenantEntitlements, assertQuota } from "./lib/entitlements";
import { resolveEffectiveConfig, PLATFORM_DEFAULTS, CONFIG_LAYERS } from "./lib/configResolution";
import { internal } from "./_generated/api";

export const createConfigurator = mutation({
  args: { tenantId: v.id("tenants"), name: v.string() },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) throw new ConvexError("INVALID_NAME");

    const existingCount = (
      await ctx.db
        .query("configurators")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect()
    ).filter((c) => c.status !== "archived").length;
    // Hard gate — the plan's configurator count is a boundary, not advisory.
    assertQuota(
      existingCount,
      resolveTenantEntitlements(tenant).maxConfigurators,
      "CONFIGURATOR_LIMIT_REACHED",
    );

    const publicId = nanoid(10);
    const configuratorId = await ctx.db.insert("configurators", {
      tenantId: args.tenantId,
      publicId,
      name,
      status: "draft",
      allowedOrigins: [],
      defaultLocale: "it",
      defaultTheme: "auto",
      vatRatePercent: 22,
      priceRoundingStep: 1,
      showPricesToEndUser: true,
      currency: "EUR",
      ecobonusEnabled: true,
      ecobonusMaxPercent: 50,
      discountEnabled: false,
      discountMaxPercent: 20,
    });

    await ctx.db.insert("branding", {
      tenantId: args.tenantId,
      configuratorId,
      whiteLabel: tenant.plan === "business" || tenant.plan === "enterprise" || tenant.isAlpha,
      colorAccent: "#16d19d",
      colorAccentInk: "#04150f",
      fontFamily: "geist",
      copy: {},
      companyInfo: { name: tenant.name },
    });

    await ctx.runMutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: args.tenantId });

    return { configuratorId, publicId };
  },
});

export const listConfigurators = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    return await ctx.db.query("configurators").withIndex("by_tenant", q => q.eq("tenantId", args.tenantId)).collect();
  },
});

export const getConfigurator = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);
    return configurator;
  },
});

export const updateConfigurator = mutation({
  args: {
    configuratorId: v.id("configurators"),
    name: v.optional(v.string()),
    allowedOrigins: v.optional(v.array(v.string())),
    defaultLocale: v.optional(v.string()),
    defaultTheme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("auto"))),
    vatRatePercent: v.optional(v.number()),
    priceRoundingStep: v.optional(v.number()),
    showPricesToEndUser: v.optional(v.boolean()),
    ecobonusEnabled: v.optional(v.boolean()),
    ecobonusMaxPercent: v.optional(v.number()),
    discountEnabled: v.optional(v.boolean()),
    discountMaxPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const update: Partial<Doc<"configurators">> = { updatedAt: Date.now() };
    if (args.name !== undefined) update.name = args.name;
    if (args.allowedOrigins !== undefined) update.allowedOrigins = args.allowedOrigins;
    if (args.defaultLocale !== undefined) update.defaultLocale = args.defaultLocale;
    if (args.defaultTheme !== undefined) update.defaultTheme = args.defaultTheme;
    if (args.vatRatePercent !== undefined) update.vatRatePercent = args.vatRatePercent;
    if (args.priceRoundingStep !== undefined) update.priceRoundingStep = args.priceRoundingStep;
    if (args.showPricesToEndUser !== undefined) update.showPricesToEndUser = args.showPricesToEndUser;
    if (args.ecobonusEnabled !== undefined) update.ecobonusEnabled = args.ecobonusEnabled;
    if (args.ecobonusMaxPercent !== undefined)
      update.ecobonusMaxPercent = Math.max(0, Math.min(100, args.ecobonusMaxPercent));
    if (args.discountEnabled !== undefined) update.discountEnabled = args.discountEnabled;
    if (args.discountMaxPercent !== undefined)
      update.discountMaxPercent = Math.max(0, Math.min(100, args.discountMaxPercent));

    await ctx.db.patch(args.configuratorId, update);
  },
});

export const publishConfigurator = mutation({
  args: { configuratorId: v.id("configurators"), changeNote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    const { membership } = await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding] = await Promise.all([
      ctx.db.query("catalogMaterials").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogQualityTiers").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogProfileSystems").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique(),
    ]);

    const version = (configurator.publishedCatalogVersion || 0) + 1;

    const payload = {
      configurator: {
        publicId: configurator.publicId,
        name: configurator.name,
        defaultLocale: configurator.defaultLocale,
        defaultTheme: configurator.defaultTheme,
        vatRatePercent: configurator.vatRatePercent,
        priceRoundingStep: configurator.priceRoundingStep,
        showPricesToEndUser: configurator.showPricesToEndUser,
        currency: configurator.currency,
        ecobonusEnabled: configurator.ecobonusEnabled,
        ecobonusMaxPercent: configurator.ecobonusMaxPercent,
        discountEnabled: configurator.discountEnabled,
        discountMaxPercent: configurator.discountMaxPercent,
      },
      branding,
      materials,
      qualityTiers,
      profileSystems,
      sizeConstraints,
      glazing,
      finish,
      hardware,
    };

    await ctx.db.insert("catalogVersions", {
      tenantId: configurator.tenantId,
      configuratorId: args.configuratorId,
      version,
      publishedByUserId: membership.userId,
      publishedAt: Date.now(),
      payload,
      changeNote: args.changeNote,
    });

    await ctx.db.patch(args.configuratorId, {
      status: "published",
      publishedAt: Date.now(),
      publishedCatalogVersion: version,
    });

    await ctx.db.insert("auditLog", {
      actorUserId: membership.userId,
      actorKind: "user",
      action: "configurator.publish",
      targetTable: "configurators",
      targetId: args.configuratorId,
      meta: { version, changeNote: args.changeNote },
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
      tenantId: configurator.tenantId,
      type: "configurator_published",
      data: { configuratorName: configurator.name, version },
      href: `/configurators/${args.configuratorId}`,
    });

    return { version };
  },
});

export const listVersions = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return [];
    await requireMembership(ctx, configurator.tenantId);
    const versions = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .order("desc")
      .take(50);
    return versions.map((row) => ({
      _id: row._id,
      version: row.version,
      publishedAt: row.publishedAt,
      publishedByUserId: row.publishedByUserId,
      changeNote: row.changeNote,
      isCurrent: row.version === configurator.publishedCatalogVersion,
    }));
  },
});

export const rollbackToVersion = mutation({
  args: { configuratorId: v.id("configurators"), version: v.number() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    const { membership } = await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const target = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", args.configuratorId).eq("version", args.version),
      )
      .unique();
    if (!target) throw new ConvexError("VERSION_NOT_FOUND");

    // Re-publish the old payload as a new version — never mutate history.
    const newVersion = (configurator.publishedCatalogVersion || 0) + 1;
    await ctx.db.insert("catalogVersions", {
      tenantId: configurator.tenantId,
      configuratorId: args.configuratorId,
      version: newVersion,
      publishedByUserId: membership.userId,
      publishedAt: Date.now(),
      payload: target.payload,
      changeNote: `Ripristino della versione ${args.version}`,
    });
    await ctx.db.patch(args.configuratorId, {
      status: "published",
      publishedAt: Date.now(),
      publishedCatalogVersion: newVersion,
    });
    await ctx.db.insert("auditLog", {
      tenantId: configurator.tenantId,
      actorUserId: membership.userId,
      actorKind: "user",
      action: "configurator.rollback",
      targetTable: "configurators",
      targetId: args.configuratorId,
      meta: { fromVersion: args.version, newVersion },
      createdAt: Date.now(),
    });
    return { version: newVersion };
  },
});

export const getEffectiveConfig = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);

    const tenant = await ctx.db.get(configurator.tenantId);
    if (!tenant) return null;
    const branding = await ctx.db
      .query("branding")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .unique();

    const effective = resolveEffectiveConfig({
      entitlements: resolveTenantEntitlements(tenant),
      configurator: {
        defaultLocale: configurator.defaultLocale,
        defaultTheme: configurator.defaultTheme,
        currency: configurator.currency,
        vatRatePercent: configurator.vatRatePercent,
        priceRoundingStep: configurator.priceRoundingStep,
        showPricesToEndUser: configurator.showPricesToEndUser,
      },
      branding: branding
        ? { whiteLabel: branding.whiteLabel, fontFamily: branding.fontFamily, colorAccent: branding.colorAccent }
        : null,
    });

    return {
      effective,
      layers: CONFIG_LAYERS,
      platformDefaults: PLATFORM_DEFAULTS,
      plan: tenant.plan,
      isAlpha: tenant.isAlpha,
    };
  },
});

export const getEditorState = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);

    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding] = await Promise.all([
      ctx.db.query("catalogMaterials").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogQualityTiers").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogProfileSystems").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).unique(),
    ]);

    return { configurator, materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding };
  },
});