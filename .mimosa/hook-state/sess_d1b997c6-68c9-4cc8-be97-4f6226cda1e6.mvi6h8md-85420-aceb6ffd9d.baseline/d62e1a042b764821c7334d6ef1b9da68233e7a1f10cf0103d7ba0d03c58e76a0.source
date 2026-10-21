import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requirePermission } from "./lib/rbac";
import { regionForCountry } from "./lib/regions";
import { applyStandardPricing } from "./lib/standardCatalog";
import { MAX_MARGIN_PERCENT, isPriceZone } from "../src/shared/standard-pricing";

const zoneValidator = v.union(v.literal("nord"), v.literal("centro"), v.literal("sud"));

/**
 * Where the installer works (Italy): picks the standard price list. Prices follow after the configurator is republished.
 * Returns how many of the tenant's configurators price from the standard list (they need a republish).
 */
export const setPriceZone = mutation({
  args: { tenantId: v.id("tenants"), zone: zoneValidator },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "tenant.settings");
    if (!isPriceZone(args.zone)) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.tenantId, { priceZone: args.zone });
    const configurators = await ctx.db.query("configurators").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).collect();
    return { standardConfigurators: configurators.filter((c) => c.deletingAt === undefined && c.pricingMode === "standard").length };
  },
});

/** The installer's profit margin over the prices, percent with up to two decimals (0 - 300). Published with the catalogue. */
export const setMargin = mutation({
  args: { configuratorId: v.id("configurators"), marginPercent: v.number() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    const m = args.marginPercent;
    if (!Number.isFinite(m) || m < 0 || m > MAX_MARGIN_PERCENT) throw new ConvexError("INVALID_INPUT");
    // Two decimals at most: 12.345 is refused rather than silently rounded to a different price.
    if (Math.abs(Math.round(m * 100) - m * 100) > 1e-6) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.configuratorId, { marginPercent: Math.round(m * 100) / 100, updatedAt: Date.now() });
    return { marginPercent: Math.round(m * 100) / 100 };
  },
});

/** Highest per-m² charge accepted for the installer's own transporter / fitter: 1000 EUR, in cents. */
export const MAX_OWN_SERVICE_PER_M2_CENTS = 100_000;

/**
 * Who delivers and fits: the factory's transport is already inside the standard price ("factory"), or the installer uses their own
 * transporter / fitter and enters what that supplier charges per m² ("own"). The rate is kept when switching back, but only
 * counts in "own" mode. Published with the catalogue.
 */
export const setDelivery = mutation({
  args: { configuratorId: v.id("configurators"), mode: v.union(v.literal("factory"), v.literal("own")), perM2Cents: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    const patch: { deliveryMode: "factory" | "own"; ownServicePerM2Cents?: number; updatedAt: number } = { deliveryMode: args.mode, updatedAt: Date.now() };
    if (args.perM2Cents !== undefined) {
      const c = args.perM2Cents;
      if (!Number.isInteger(c) || c < 0 || c > MAX_OWN_SERVICE_PER_M2_CENTS) throw new ConvexError("INVALID_INPUT");
      patch.ownServicePerM2Cents = c;
    }
    if (args.mode === "own" && (patch.ownServicePerM2Cents ?? configurator.ownServicePerM2Cents ?? 0) <= 0) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.configuratorId, patch);
    return { deliveryMode: args.mode, ownServicePerM2Cents: patch.ownServicePerM2Cents ?? configurator.ownServicePerM2Cents ?? 0 };
  },
});

/** Highest fitting (posa) price accepted: 1000 EUR per m², in cents. */
export const MAX_INSTALLATION_PER_M2_CENTS = 100_000;

/**
 * The installer's fitting (posa) price per m² and whether quotes include it by default. 0 switches the priced fitting off.
 * The customer / installer can then choose, quote by quote, a price with the fitting or supply only. Published with the catalogue.
 */
export const setInstallation = mutation({
  args: { configuratorId: v.id("configurators"), perM2Cents: v.number(), defaultMode: v.union(v.literal("with"), v.literal("without")) },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    const c = args.perM2Cents;
    if (!Number.isInteger(c) || c < 0 || c > MAX_INSTALLATION_PER_M2_CENTS) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.configuratorId, { installationPerM2Cents: c, installationDefault: args.defaultMode, updatedAt: Date.now() });
    return { installationPerM2Cents: c, installationDefault: args.defaultMode };
  },
});

/** Highest bicolour surcharge accepted: 1000 EUR per m², in cents. */
export const MAX_BICOLOR_PER_M2_CENTS = 100_000;

/** Whether this configurator offers a different finish inside and outside, and what it adds per m². Published with the catalogue. */
export const setBicolor = mutation({
  args: { configuratorId: v.id("configurators"), enabled: v.boolean(), perM2Cents: v.number() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    const c = args.perM2Cents;
    if (!Number.isInteger(c) || c < 0 || c > MAX_BICOLOR_PER_M2_CENTS) throw new ConvexError("INVALID_INPUT");
    await ctx.db.patch(args.configuratorId, { bicolorEnabled: args.enabled, bicolorPerM2Cents: c, updatedAt: Date.now() });
    return { bicolorEnabled: args.enabled, bicolorPerM2Cents: c };
  },
});

/** Price this configurator from the standard price list of the installer's zone (nothing is deleted). */
export const applyStandard = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    return await applyStandardPricing(ctx, configurator);
  },
});

/** Back to the catalogue's own prices (the standard profiles and every setting stay in the catalogue). */
export const useCustomPricing = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.deletingAt !== undefined) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "configurators.manage");
    await ctx.db.patch(args.configuratorId, { pricingMode: "custom", updatedAt: Date.now() });
    return { pricingMode: "custom" as const };
  },
});

/**
 * One command for the founder: price every Italian configurator that has not chosen a mode yet from the standard list.
 *
 *   npx convex run --prod pricing:applyStandardEverywhere
 *
 * Configurators already in "custom" or "standard" mode are skipped; tenants without a zone are skipped too.
 */
export const applyStandardEverywhere = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("configurators").collect();
    let scheduled = 0;
    for (const c of all) {
      if (c.deletingAt !== undefined || c.pricingMode !== undefined) continue;
      const tenant = await ctx.db.get(c.tenantId);
      if (!tenant || regionForCountry(tenant.country).code !== "IT" || !isPriceZone(tenant.priceZone)) continue;
      await ctx.scheduler.runAfter(scheduled * 200, internal.pricing.applyStandardOne, { configuratorId: c._id });
      scheduled++;
    }
    return { scheduled };
  },
});

export const applyStandardOne = internalMutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.configuratorId);
    if (!c || c.deletingAt !== undefined || c.pricingMode !== undefined) return null;
    return await applyStandardPricing(ctx, c);
  },
});
