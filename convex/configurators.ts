import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { nanoid } from "./lib/ids";
import { loadExtras } from "./lib/catalogExtras";
import { resolveTenantEntitlements, currentPeriod } from "./lib/entitlements";
import { enforceForCreateConfigurator } from "./lib/enforcement";
import { resolveEffectiveConfig, PLATFORM_DEFAULTS, CONFIG_LAYERS } from "./lib/configResolution";
import { internal } from "./_generated/api";
import { regionForCountry } from "./lib/regions";

export const createConfigurator = mutation({
  args: { tenantId: v.id("tenants"), name: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "configurators.manage");
    await enforceForCreateConfigurator(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");

    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) throw new ConvexError("INVALID_NAME");

    // Market defaults: widget language and VAT rate follow the tenant's country
    // (a French dealer must not start with an Italian widget at 22% VAT).
    const region = regionForCountry(tenant.country);
    const defaultVat = region.vatRates.find((r) => r.key === region.defaultVatKey)?.percent ?? 22;

    const publicId = nanoid(10);
    const configuratorId = await ctx.db.insert("configurators", {
      tenantId: args.tenantId,
      publicId,
      name,
      status: "draft",
      allowedOrigins: [],
      defaultLocale: region.primaryLocale,
      defaultTheme: "auto",
      vatRatePercent: defaultVat,
      priceRoundingStep: 1,
      showPricesToEndUser: true,
      currency: "EUR",
      // Ecobonus is Italian-only.
      ecobonusEnabled: region.code === "IT",
      ecobonusMaxPercent: 50,
      discountEnabled: false,
      discountMaxPercent: 20,
    });

    await ctx.db.insert("branding", {
      tenantId: args.tenantId,
      configuratorId,
      whiteLabel: resolveTenantEntitlements(tenant).whiteLabel,
      colorAccent: "#16d19d",
      colorAccentInk: "#04150f",
      fontFamily: "geist",
      copy: {},
      companyInfo: { name: tenant.name },
    });

    await ctx.runMutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: args.tenantId });

    // Increment active configurator count for quota tracking
    const period = currentPeriod();
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId).eq("period", period))
      .first();
    if (counter) {
      await ctx.db.patch(counter._id, {
        activeConfiguratorsCount: counter.activeConfiguratorsCount + 1,
      });
    } else {
      await ctx.db.insert("usageCounters", {
        tenantId: args.tenantId,
        period,
        quoteRequestsCount: 0,
        activeConfiguratorsCount: 1,
      });
    }

    return { configuratorId, publicId };
  },
});

export const listConfigurators = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const all = await ctx.db.query("configurators").withIndex("by_tenant", q => q.eq("tenantId", args.tenantId)).collect();
    // A configurator being deleted is gone for the owner already, even if its data is still being purged.
    return all.filter((c) => c.deletingAt === undefined);
  },
});

/** Child tables of a configurator, purged when it is deleted (all indexed by `by_configurator`). */
const CONFIGURATOR_CHILD_TABLES = [
  "catalogMaterials",
  "catalogQualityTiers",
  "catalogProfileSystems",
  "catalogSizeConstraints",
  "catalogGlazingOptions",
  "catalogFinishOptions",
  "catalogFrameTypes",
  "catalogAccessories",
  "catalogProductBase",
  "catalogHardwareOptions",
  "catalogVersions",
  "catalogImports",
  "branding",
] as const;

/** Documents deleted per purge run; the run reschedules itself while anything is left. */
const PURGE_BATCH = 800;

/**
 * Archive a configurator: it stops serving (widget, link, Showroom) and stops counting against the plan, but
 * nothing is lost: catalogue, versions and customer requests stay, and it can be restored.
 */
export const archiveConfigurator = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    if (configurator.status === "archived") return { status: "archived" as const };
    await ctx.db.patch(args.configuratorId, { status: "archived", updatedAt: Date.now() });
    return { status: "archived" as const };
  },
});

/** Bring an archived configurator back as a draft (publish it again to serve it); it counts against the plan again. */
export const restoreConfigurator = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    if (configurator.status !== "archived") return { status: configurator.status };
    await enforceForCreateConfigurator(ctx, configurator.tenantId);
    await ctx.db.patch(args.configuratorId, { status: "draft", updatedAt: Date.now() });
    return { status: "draft" as const };
  },
});

/**
 * Delete a configurator: its catalogue, versions, branding and public widget link go away; the quota it used is
 * freed. Refused while it has received requests, because those carry customers' data. The data is purged in the
 * background in small batches; the configurator disappears from every list immediately and stops serving.
 */
export const deleteConfigurator = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    if (configurator.deletingAt !== undefined) return { deleted: true as const };

    const requests = await ctx.db
      .query("quoteRequests")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .take(1);
    if (requests.length > 0) throw new ConvexError("CONFIGURATOR_HAS_REQUESTS");

    // Stop serving at once (draft / published widgets read "published" only), then purge.
    await ctx.db.patch(args.configuratorId, { status: "archived", deletingAt: Date.now(), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.configurators.purgeConfigurator, { configuratorId: args.configuratorId });
    return { deleted: true as const };
  },
});

/** Tables whose rows carry whole catalogue snapshots: purged a few at a time to stay under the read limit. */
const HEAVY_TABLE_LIMIT = 8;

export const purgeConfigurator = internalMutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt === undefined) return { done: true };
    let budget = PURGE_BATCH;
    let more = false;
    for (const table of CONFIGURATOR_CHILD_TABLES) {
      if (budget <= 0) {
        more = true;
        break;
      }
      const heavy = table === "catalogVersions" || table === "catalogImports";
      const limit = heavy ? Math.min(budget, HEAVY_TABLE_LIMIT) : budget;
      const rows = await ctx.db
        .query(table)
        .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
        .take(limit);
      for (const row of rows) {
        if (table === "branding") {
          const b = row as Doc<"branding">;
          for (const id of [b.logoStorageId, b.logoLightStorageId]) if (id) await ctx.storage.delete(id).catch(() => {});
        }
        await ctx.db.delete(row._id);
      }
      budget -= rows.length;
      // A full batch may have left more behind.
      if (rows.length === limit) more = true;
    }
    if (more) {
      await ctx.scheduler.runAfter(0, internal.configurators.purgeConfigurator, { configuratorId: args.configuratorId });
      return { done: false };
    }
    await ctx.db.delete(args.configuratorId);
    return { done: true };
  },
});

// No src/ caller, but has real test coverage (authz.test.ts's cross-tenant
// isolation check, configurators.test.ts's rollback assertion) — verified
// against tests/ too before concluding a function is dead, not just src/.
export const getConfigurator = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);
    return configurator;
  },
});

/**
 * The currently-published catalog payload for a configurator — same
 * `catalogVersions.payload` the widget and server pricing use, membership-gated.
 * Returns null when nothing has been published yet.
 */
export const getPublishedCatalog = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);

    const version = configurator.publishedCatalogVersion;
    if (!version) return null;

    const versionDoc = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", args.configuratorId).eq("version", version),
      )
      .unique();
    if (!versionDoc) return null;

    return { version, payload: versionDoc.payload as Record<string, unknown> };
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
    widgetStyle: v.optional(v.union(v.literal("standard"), v.literal("wizard"))),
  },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");

    const update: Partial<Doc<"configurators">> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2 || name.length > 80) throw new ConvexError("INVALID_NAME");
      update.name = name;
    }
    if (args.allowedOrigins !== undefined) {
      // Feeds the embed CSP (frame-ancestors) and the origin check: bounded,
      // http(s) origins only.
      if (args.allowedOrigins.length > 25) throw new ConvexError("INVALID_INPUT");
      const origins: string[] = [];
      for (const raw of args.allowedOrigins) {
        let o = raw.trim();
        if (!o) continue;
        // "www.example.com" → "https://www.example.com" (a scheme-less entry
        // used to be silently dropped by the embed policy, i.e. never worked).
        if (!/^[a-z]+:\/\//i.test(o)) o = `https://${o}`;
        let url: URL;
        try {
          url = new URL(o);
        } catch {
          throw new ConvexError("INVALID_INPUT");
        }
        if (o.length > 200 || (url.protocol !== "https:" && url.protocol !== "http:")) throw new ConvexError("INVALID_INPUT");
        origins.push(url.origin);
      }
      update.allowedOrigins = [...new Set(origins)];
    }
    if (args.defaultLocale !== undefined) {
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(args.defaultLocale)) throw new ConvexError("INVALID_INPUT");
      update.defaultLocale = args.defaultLocale;
    }
    if (args.defaultTheme !== undefined) update.defaultTheme = args.defaultTheme;
    // The public widget prices with these: never a negative / >100% VAT or a
    // non-positive rounding step.
    if (args.vatRatePercent !== undefined) {
      if (!Number.isFinite(args.vatRatePercent) || args.vatRatePercent < 0 || args.vatRatePercent > 100) {
        throw new ConvexError("INVALID_INPUT");
      }
      update.vatRatePercent = args.vatRatePercent;
    }
    if (args.priceRoundingStep !== undefined) {
      if (!Number.isFinite(args.priceRoundingStep) || args.priceRoundingStep <= 0 || args.priceRoundingStep > 100_000) {
        throw new ConvexError("INVALID_INPUT");
      }
      update.priceRoundingStep = args.priceRoundingStep;
    }
    if (args.showPricesToEndUser !== undefined) update.showPricesToEndUser = args.showPricesToEndUser;
    if (args.ecobonusEnabled !== undefined) update.ecobonusEnabled = args.ecobonusEnabled;
    if (args.ecobonusMaxPercent !== undefined)
      update.ecobonusMaxPercent = Math.max(0, Math.min(100, args.ecobonusMaxPercent));
    if (args.discountEnabled !== undefined) update.discountEnabled = args.discountEnabled;
    if (args.discountMaxPercent !== undefined)
      update.discountMaxPercent = Math.max(0, Math.min(100, args.discountMaxPercent));
    if (args.widgetStyle !== undefined) update.widgetStyle = args.widgetStyle;

    await ctx.db.patch(args.configuratorId, update);
  },
});

export const publishConfigurator = mutation({
  args: { configuratorId: v.id("configurators"), changeNote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    const { membership } = await requirePermission(ctx, configurator.tenantId, "configurators.manage");

    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding] = await Promise.all([
      ctx.db.query("catalogMaterials").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogQualityTiers").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogProfileSystems").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).first(),
    ]);

    const version = (configurator.publishedCatalogVersion || 0) + 1;
    const extras = await loadExtras(ctx, args.configuratorId);

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
      ...extras,
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
    const { membership } = await requirePermission(ctx, configurator.tenantId, "configurators.manage");

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
      country: tenant.country,
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
      ctx.db.query("branding").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).first(),
    ]);

    const extras = await loadExtras(ctx, args.configuratorId);
    return { configurator, materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding, ...extras };
  },
});