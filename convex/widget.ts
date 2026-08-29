import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { calculatePrice, type ProjectItem } from "../src/shared/pricing";
import { ProjectItemSchema } from "../src/shared/widget-types";

/**
 * INTERNAL — resolve publicId to configuratorId for rate-limit bucket tracking
 * in the HTTP action.
 */
export const getConfiguratorIdByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    return configurator?._id ?? null;
  },
});

/** Strip Convex system + tenant fields from a catalog snapshot row. */
function sanitizeRow<T extends Record<string, any>>(row: T) {
  const { _id, _creationTime, tenantId, configuratorId, ...rest } = row;
  return rest;
}

function sanitizePayload(payload: any) {
  if (!payload) return payload;
  const arr = (a: any[]) => (Array.isArray(a) ? a.map(sanitizeRow) : []);
  return {
    configurator: payload.configurator,
    branding: payload.branding
      ? {
          whiteLabel: payload.branding.whiteLabel,
          colorAccent: payload.branding.colorAccent,
          colorAccentInk: payload.branding.colorAccentInk,
          colorBg: payload.branding.colorBg,
          colorBgDark: payload.branding.colorBgDark,
          fontFamily: payload.branding.fontFamily,
          copy: payload.branding.copy,
          companyInfo: payload.branding.companyInfo,
        }
      : null,
    materials: arr(payload.materials),
    qualityTiers: arr(payload.qualityTiers),
    sizeConstraints: arr(payload.sizeConstraints),
    glazing: arr(payload.glazing),
    finish: arr(payload.finish),
    hardware: arr(payload.hardware),
  };
}

/**
 * PUBLIC (unauthenticated) — read a published configurator for the embeddable
 * widget. Returns only what the widget needs; never tenant internals.
 */
export const getPublicConfigurator = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!configurator || configurator.status !== "published" || !configurator.publishedCatalogVersion) {
      return null;
    }

    const version = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", configurator._id).eq("version", configurator.publishedCatalogVersion),
      )
      .unique();
    if (!version) return null;

    const branding = await ctx.db
      .query("branding")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id))
      .unique();
    const logoUrl = branding?.logoStorageId ? await ctx.storage.getUrl(branding.logoStorageId) : null;
    const logoLightUrl = branding?.logoLightStorageId
      ? await ctx.storage.getUrl(branding.logoLightStorageId)
      : null;

    const cfg = version.payload?.configurator ?? {};
    return {
      publicId: configurator.publicId,
      name: configurator.name,
      defaultLocale: cfg.defaultLocale ?? configurator.defaultLocale,
      defaultTheme: cfg.defaultTheme ?? configurator.defaultTheme,
      showPricesToEndUser: cfg.showPricesToEndUser ?? configurator.showPricesToEndUser,
      currency: cfg.currency ?? configurator.currency,
      vatRatePercent: cfg.vatRatePercent ?? configurator.vatRatePercent,
      priceRoundingStep: cfg.priceRoundingStep ?? configurator.priceRoundingStep,
      catalogVersion: configurator.publishedCatalogVersion,
      branding: {
        whiteLabel: branding?.whiteLabel ?? false,
        colorAccent: branding?.colorAccent ?? "#16d19d",
        colorAccentInk: branding?.colorAccentInk ?? "#04231a",
        colorBg: branding?.colorBg,
        colorBgDark: branding?.colorBgDark,
        fontFamily: branding?.fontFamily ?? "space-grotesk",
        copy: branding?.copy ?? {},
        companyInfo: branding?.companyInfo ?? { name: configurator.name },
        logoUrl,
        logoLightUrl,
      },
      catalog: sanitizePayload(version.payload),
    };
  },
});

/**
 * INTERNAL — the real trust boundary for widget submissions. Called only from
 * the HTTP action after rate-limit + Turnstile. Re-validates items and
 * recomputes the price server-side (client price is stored for reference only).
 */
export const insertQuote = internalMutation({
  args: {
    publicId: v.string(),
    configuratorId: v.id("configurators"),
    catalogVersion: v.number(),
    items: v.any(),
    leadName: v.string(),
    leadEmail: v.string(),
    leadPhone: v.optional(v.string()),
    leadCompany: v.optional(v.string()),
    leadMessage: v.optional(v.string()),
    leadLocale: v.string(),
    clientReportedPriceCents: v.optional(v.number()),
    sourceIpHash: v.optional(v.string()),
    sourceOrigin: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    turnstileVerified: v.optional(v.boolean()),
    flagged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");

    const version = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", args.configuratorId).eq("version", args.catalogVersion),
      )
      .unique();
    if (!version) throw new ConvexError("VERSION_NOT_FOUND");

    const rawItems = Array.isArray(args.items) ? args.items : [];
    const items: ProjectItem[] = rawItems.map((it: unknown) => {
      const parsed = ProjectItemSchema.safeParse(it);
      if (!parsed.success) throw new ConvexError("INVALID_ITEM");
      return parsed.data as ProjectItem;
    });
    if (items.length === 0) throw new ConvexError("NO_ITEMS");

    const price = calculatePrice(version.payload, items);

    const priceMismatch =
      args.clientReportedPriceCents != null &&
      price.priceCents > 0 &&
      Math.abs(price.priceCents - args.clientReportedPriceCents) / price.priceCents > 0.01;

    const quoteId = await ctx.db.insert("quoteRequests", {
      tenantId: configurator.tenantId,
      configuratorId: args.configuratorId,
      catalogVersion: args.catalogVersion,
      publicId: args.publicId,
      items,
      leadName: args.leadName,
      leadEmail: args.leadEmail,
      leadPhone: args.leadPhone,
      leadCompany: args.leadCompany,
      leadMessage: args.leadMessage,
      leadLocale: args.leadLocale,
      priceCents: price.priceCents,
      priceExVatCents: price.priceExVatCents,
      vatRatePercent: price.vatRatePercent,
      currency: "EUR",
      clientReportedPriceCents: args.clientReportedPriceCents,
      status: args.flagged ? "spam" : "new",
      sourceIpHash: args.sourceIpHash,
      sourceOrigin: args.sourceOrigin,
      userAgent: args.userAgent,
      turnstileVerified: args.turnstileVerified,
      spamScore: args.flagged ? 80 : priceMismatch ? 30 : 0,
    });

    // Upsert this period's usage counter.
    const period = new Date().toISOString().slice(0, 7);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) =>
        q.eq("tenantId", configurator.tenantId).eq("period", period),
      )
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, { quoteRequestsCount: counter.quoteRequestsCount + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        tenantId: configurator.tenantId,
        period,
        quoteRequestsCount: 1,
        activeConfiguratorsCount: 0,
      });
    }

    await ctx.db.insert("auditLog", {
      tenantId: configurator.tenantId,
      actorKind: "widget",
      action: priceMismatch ? "quote.price_mismatch" : "quote.create",
      targetTable: "quoteRequests",
      targetId: quoteId,
      meta: {
        priceCents: price.priceCents,
        clientReportedPriceCents: args.clientReportedPriceCents,
      },
      ip: args.sourceIpHash,
      createdAt: Date.now(),
    });

    if (!args.flagged) {
      await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
        tenantId: configurator.tenantId,
        type: "quote_request_new",
        data: {
          quoteId,
          leadName: args.leadName,
          leadEmail: args.leadEmail,
          priceCents: price.priceCents,
          configuratorName: configurator.name,
        },
        href: `/app/requests/${quoteId}`,
        emailTemplate: "new_quote_request",
      });
    }

    return quoteId;
  },
});
