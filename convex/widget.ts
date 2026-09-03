import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { calculatePrice, type ProjectItem, type CatalogPayload } from "../src/shared/pricing";
import { ProjectItemSchema } from "../src/shared/widget-types";
import { requireMembership } from "./lib/auth";
import { resolveTenantEntitlements, currentPeriod } from "./lib/entitlements";
import { consumeToken } from "./lib/ratelimit";
import { regionForCountry, type RegionPolicy } from "./lib/regions";

/** Rows/objects that may carry Convex system + tenant fields. */
type WithSystemFields = Record<string, unknown> & {
  _id?: unknown;
  _creationTime?: unknown;
  tenantId?: unknown;
  configuratorId?: unknown;
};

/** The blob stored in `catalogVersions.payload`, plus the live-table variant. */
interface StoredPayload {
  configurator?: Record<string, unknown>;
  branding?: (Record<string, unknown> & Partial<Doc<"branding">>) | null;
  materials?: WithSystemFields[];
  qualityTiers?: WithSystemFields[];
  profileSystems?: WithSystemFields[];
  sizeConstraints?: WithSystemFields[];
  glazing?: WithSystemFields[];
  finish?: WithSystemFields[];
  hardware?: WithSystemFields[];
}

/**
 * INTERNAL — resolve publicId to configuratorId for rate-limit bucket tracking
 * and the quote-insert path. Not public: the internal `_id` must never leak to
 * an unauthenticated caller.
 */
export const getConfiguratorIdByPublicId = internalQuery({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    return configurator?._id ?? null;
  },
});

/**
 * PUBLIC (unauthenticated) — the embed policy for a widget, consumed by the
 * Next middleware to build a per-tenant `Content-Security-Policy: frame-ancestors`
 * header. Returns ONLY the allow-listed origins + activation state; no internals.
 */
export const getEmbedPolicy = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!configurator) return { exists: false, active: false, frameAncestors: [] as string[] };

    // Only http(s) origins, de-duplicated, hard-capped so a huge list can't be
    // used to bloat the response header.
    const frameAncestors = Array.from(
      new Set(
        (configurator.allowedOrigins ?? [])
          .map((o) => {
            try {
              const u = new URL(o);
              return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
            } catch {
              return null;
            }
          })
          .filter((o): o is string => o !== null),
      ),
    ).slice(0, 25);

    return {
      exists: true,
      active: configurator.status === "published",
      frameAncestors,
    };
  },
});

/**
 * INTERNAL — record one widget open, called from the `/api/widget/view` HTTP
 * action (which supplies a per-visitor `viewToken` = client nonce or IP hash).
 * De-duplicated per token per ~24h; a global per-configurator bucket bounds
 * abuse. Aggregate only, no PII. Published configurators only.
 */
export const recordWidgetView = internalMutation({
  args: { publicId: v.string(), viewToken: v.string() },
  handler: async (ctx, args) => {
    if (args.viewToken.length < 8 || args.viewToken.length > 128) return { counted: false };
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!configurator || configurator.status !== "published") return { counted: false };

    // Once per session token per ~24h.
    const fresh = await consumeToken(ctx, `view:${configurator._id}:${args.viewToken}`, {
      tokens: 1,
      refillMs: 24 * 60 * 60 * 1000,
    });
    if (!fresh) return { counted: false };
    // Bound total opens counted per configurator per hour.
    const underCap = await consumeToken(ctx, `view:${configurator._id}:hourly`, {
      tokens: 3000,
      refillMs: 60 * 60 * 1000,
    });
    if (!underCap) return { counted: false };

    const period = currentPeriod();
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) =>
        q.eq("tenantId", configurator.tenantId).eq("period", period),
      )
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, {
        widgetViewsCount: (counter.widgetViewsCount ?? 0) + 1,
      });
    } else {
      await ctx.db.insert("usageCounters", {
        tenantId: configurator.tenantId,
        period,
        quoteRequestsCount: 0,
        activeConfiguratorsCount: 0,
        widgetViewsCount: 1,
      });
    }
    return { counted: true };
  },
});

/** Strip Convex system + tenant fields from a catalog snapshot row. */
function sanitizeRow<T extends WithSystemFields>(row: T) {
  const rest = { ...row };
  delete rest._id;
  delete rest._creationTime;
  delete rest.tenantId;
  delete rest.configuratorId;
  return rest;
}

function sanitizePayload(payload: StoredPayload | null | undefined): CatalogPayload | null {
  if (!payload) return null;
  const arr = (a: WithSystemFields[] | undefined) => (Array.isArray(a) ? a.map(sanitizeRow) : []);
  const b = payload.branding;
  return {
    configurator: payload.configurator,
    branding: b
      ? {
          whiteLabel: b.whiteLabel,
          colorAccent: b.colorAccent,
          colorAccentInk: b.colorAccentInk,
          colorBg: b.colorBg,
          colorBgDark: b.colorBgDark,
          fontFamily: b.fontFamily,
          copy: b.copy,
          companyInfo: b.companyInfo,
        }
      : null,
    materials: arr(payload.materials),
    qualityTiers: arr(payload.qualityTiers),
    profileSystems: arr(payload.profileSystems),
    sizeConstraints: arr(payload.sizeConstraints),
    glazing: arr(payload.glazing),
    finish: arr(payload.finish),
    hardware: arr(payload.hardware),
  } as unknown as CatalogPayload;
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
        q.eq("configuratorId", configurator._id).eq("version", configurator.publishedCatalogVersion ?? 0),
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

    const tenant = await ctx.db.get(configurator.tenantId);

    return assembleWidgetResponse({
      configurator,
      branding,
      payload: version.payload,
      catalogVersion: configurator.publishedCatalogVersion,
      logoUrl,
      logoLightUrl,
      region: regionForCountry(tenant?.country),
    });
  },
});

/** Shared shape builder for the public and preview widget responses. */
function assembleWidgetResponse(args: {
  configurator: Doc<"configurators">;
  branding: Doc<"branding"> | null;
  payload: StoredPayload | null | undefined;
  catalogVersion: number;
  logoUrl: string | null;
  logoLightUrl: string | null;
  region: RegionPolicy;
}) {
  const { configurator, branding, payload, catalogVersion, logoUrl, logoLightUrl, region } = args;
  const cfg = (payload?.configurator ?? {}) as Record<string, unknown>;
  const pick = <T,>(key: string, fallback: T): T =>
    (cfg[key] as T | undefined) ?? fallback;
  return {
    publicId: configurator.publicId,
    name: configurator.name,
    defaultLocale: pick("defaultLocale", configurator.defaultLocale),
    defaultTheme: pick("defaultTheme", configurator.defaultTheme),
    showPricesToEndUser: pick("showPricesToEndUser", configurator.showPricesToEndUser),
    currency: pick("currency", configurator.currency),
    vatRatePercent: pick("vatRatePercent", configurator.vatRatePercent),
    priceRoundingStep: pick("priceRoundingStep", configurator.priceRoundingStep),
    ecobonusEnabled: pick("ecobonusEnabled", configurator.ecobonusEnabled ?? true),
    ecobonusMaxPercent: pick("ecobonusMaxPercent", configurator.ecobonusMaxPercent ?? 50),
    discountEnabled: pick("discountEnabled", configurator.discountEnabled ?? false),
    discountMaxPercent: pick("discountMaxPercent", configurator.discountMaxPercent ?? 20),
    // Region policy — server-authoritative, resolved from the tenant's country.
    region: region.code,
    widgetMode: region.widgetMode,
    vatRates: region.vatRates,
    defaultVatKey: region.defaultVatKey,
    complianceFlags: region.complianceFlags,
    catalogVersion,
    branding: {
      whiteLabel: branding?.whiteLabel ?? false,
      colorAccent: branding?.colorAccent ?? "#16d19d",
      colorAccentInk: branding?.colorAccentInk ?? null,
      colorBg: branding?.colorBg ?? null,
      colorBgDark: branding?.colorBgDark ?? null,
      fontFamily: branding?.fontFamily ?? "space-grotesk",
      copy: branding?.copy ?? {},
      companyInfo: branding?.companyInfo ?? { name: configurator.name },
      logoUrl,
      logoLightUrl,
    },
    catalog: sanitizePayload(payload),
  };
}

/**
 * AUTHENTICATED — live (unpublished) preview of a configurator, built from the
 * working catalog tables. Gated by tenant membership so drafts never leak.
 * Used by the editor's `/w/{publicId}?preview=1` iframe.
 */
export const getConfiguratorForPreview = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db
      .query("configurators")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!configurator) return null;

    // Best-effort auth gate: non-members / anonymous callers get null (the page
    // then falls back to the published version, or 404s).
    try {
      await requireMembership(ctx, configurator.tenantId);
    } catch {
      return null;
    }

    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, branding] =
      await Promise.all([
        ctx.db.query("catalogMaterials").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogQualityTiers").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogFinishOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).collect(),
        ctx.db.query("branding").withIndex("by_configurator", (q) => q.eq("configuratorId", configurator._id)).unique(),
      ]);

    const logoUrl = branding?.logoStorageId ? await ctx.storage.getUrl(branding.logoStorageId) : null;
    const logoLightUrl = branding?.logoLightStorageId
      ? await ctx.storage.getUrl(branding.logoLightStorageId)
      : null;

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

    const tenant = await ctx.db.get(configurator.tenantId);

    return assembleWidgetResponse({
      configurator,
      branding,
      payload,
      catalogVersion: 0,
      logoUrl,
      logoLightUrl,
      region: regionForCountry(tenant?.country),
    });
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

    const tenant = await ctx.db.get(configurator.tenantId);
    const entitlements = tenant ? resolveTenantEntitlements(tenant) : null;

    // Monthly quota: over the limit we still accept the lead (never lose a
    // real prospect), flag it, and warn the tenant once per period.
    const period = currentPeriod();
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) =>
        q.eq("tenantId", configurator.tenantId).eq("period", period),
      )
      .unique();
    const usedThisPeriod = counter?.quoteRequestsCount ?? 0;
    const overQuota =
      !!entitlements &&
      Number.isFinite(entitlements.maxQuotesPerMonth) &&
      usedThisPeriod >= entitlements.maxQuotesPerMonth;

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
      overQuota: overQuota || undefined,
    });

    // Bump this period's usage counter.
    if (counter) {
      await ctx.db.patch(counter._id, {
        quoteRequestsCount: counter.quoteRequestsCount + 1,
        overQuotaNotifiedAt:
          overQuota && !counter.overQuotaNotifiedAt ? Date.now() : counter.overQuotaNotifiedAt,
      });
    } else {
      await ctx.db.insert("usageCounters", {
        tenantId: configurator.tenantId,
        period,
        quoteRequestsCount: 1,
        activeConfiguratorsCount: 0,
      });
    }

    // Warn the tenant the first time it goes over quota in a period.
    if (overQuota && counter && !counter.overQuotaNotifiedAt && entitlements) {
      await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
        tenantId: configurator.tenantId,
        type: "plan_limit",
        data: {
          message: `Monthly quote limit reached (${entitlements.maxQuotesPerMonth}). New requests are still saved — upgrade to keep full analytics.`,
        },
        href: `/app/account`,
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
