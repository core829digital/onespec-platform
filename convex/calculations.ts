import { query, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, type ReadCtx } from "./lib/auth";
import { publicPayload } from "./lib/payload";
import { resolveTenantEntitlements } from "./lib/entitlements";
import { regionForCountry, regionCodeValidator } from "./lib/regions";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../src/shared/pricing";
import { computeCalculationPreview, type BeniSignificativiBreakdown, type FundingDocParams } from "./lib/calcPreview";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { parseQuoteItems } from "./lib/quoteItems";
import { findPublishedVersion } from "./lib/catalogLoad";

/**
 * The published catalogue the Showroom prices with. With `configuratorId` it is that configurator's (it must belong
 * to the tenant and be published); without it, the most recently published one.
 */
export async function getTenantCatalog(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
  configuratorId?: Id<"configurators">,
): Promise<{ payload: CatalogPayload; version: number; configuratorId: Id<"configurators">; configuratorName: string } | null> {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) return null;

  let configurator: Doc<"configurators"> | undefined;
  if (configuratorId) {
    const c = await ctx.db.get(configuratorId);
    // Another tenant's id, a draft or a configurator being deleted all read as "not available".
    if (!c || c.tenantId !== tenantId || c.status !== "published" || c.publishedCatalogVersion === undefined || c.deletingAt !== undefined) return null;
    configurator = c;
  } else {
    // Use the by_tenant_status index (no .filter() — its predicate receives a
    // FilterBuilder, not the document, and treating it as the document silently
    // matched nothing, which broke the showroom with "no published configurator").
    const configurators = await ctx.db
      .query("configurators")
      .withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "published"))
      .collect();
    configurator = configurators
      .filter((c) => c.publishedCatalogVersion !== undefined && c.deletingAt === undefined)
      .sort((a, b) => (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime))[0];
  }
  if (!configurator) return null;

  const versionDoc = await findPublishedVersion(ctx, configurator);

  if (!versionDoc) return null;

  return {
    payload: versionDoc.payload as CatalogPayload,
    version: versionDoc.version,
    configuratorId: configurator._id,
    configuratorName: configurator.name,
  };
}


export const getCalculationPreview = query({
  args: {
    tenantId: v.id("tenants"),
    /** Which configurator's catalogue to price with; default = the most recently published. */
    configuratorId: v.optional(v.id("configurators")),
    items: v.array(v.any()),
    options: v.object({
      regionCode: regionCodeValidator,
      buildingAge: v.number(),
      isEnergyRenovation: v.boolean(),
      deductionPercent: v.number(),
      uwAnte: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args): Promise<{
    priceCents: number;
    priceExVatCents: number;
    vatRatePercent: number;
    vatBreakdown: Array<{ rate: number; label: string; baseCents: number; vatCents: number; totalCents: number; suggested?: { rate: number; label: string } }>;
    totalVatCents: number;
    beniSignificativi: BeniSignificativiBreakdown | null;
    uwPerItem: number[];
    uwWeightedAverage: number;
    uwEligible: boolean;
    energySavingsKwhYear: number;
    fundingDocParams: FundingDocParams | null;
    monthlyRate24Months: number;
    netAfterBonus50: number;
    items: ReturnType<typeof calculatePrice>["items"];
    disposal?: ReturnType<typeof calculatePrice>["disposal"];
    calculatedAt: number;
    catalogVersion: number;
  }> => {
    await requireMembership(ctx, args.tenantId);
    // Same validation as a saved quote: schema-checked pieces, at most 50 —
    // malformed input must be a clean INVALID_ITEM, not a server crash.
    const items = parseQuoteItems(args.items);

    const result = await ctx.runQuery(internal.calculations.calculateInternal, {
      tenantId: args.tenantId,
      configuratorId: args.configuratorId,
      items,
      options: args.options,
    });

    return result;
  },
});
/** Shared internal calculation logic used by getCalculationPreview. */
export const calculateInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    configuratorId: v.optional(v.id("configurators")),
    items: v.array(v.any()),
    options: v.object({
      regionCode: regionCodeValidator,
      buildingAge: v.number(),
      isEnergyRenovation: v.boolean(),
      deductionPercent: v.number(),
      uwAnte: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    // Every deliberate refusal on this path is already a coded ConvexError; anything else here is a bug, and the
    // Showroom preview must still fail with a message the client can show, not a redacted "Server Error" (issue: Showroom
    // price preview crashed with an uncoded error for a session on 2026-10-23).
    try {
      const catalogData = await getTenantCatalog(ctx, args.tenantId, args.configuratorId);
      if (!catalogData) throw new ConvexError("NO_CATALOG_VERSION");
      return computeCalculationPreview(catalogData.payload, catalogData.version, args.items as ProjectItem[], args.options);
    } catch (e) {
      if (e instanceof ConvexError) throw e;
      // The client only ever sees the coded error below; this keeps the real stack in Convex's own function logs.
      console.error("[calculateInternal] unexpected error", e);
      throw new ConvexError("CALCULATION_FAILED");
    }
  },
});

/** Option lists for the in-app Showroom configurator (FASE 3). */
export const getShowroomCatalog = query({
  args: { tenantId: v.id("tenants"), configuratorId: v.optional(v.id("configurators")) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    const region = regionForCountry(tenant?.country);
    // The calculator is a Showroom-plan feature; other plans get a clear "not included" state.
    if (!tenant || !resolveTenantEntitlements(tenant).showroomCalculator) {
      return { regionCode: region.code, ready: false as const, allowed: false as const };
    }

    const cat = await getTenantCatalog(ctx, args.tenantId, args.configuratorId);
    if (!cat) return { regionCode: region.code, ready: false as const, allowed: true as const };

    const p = cat.payload;
    const lbl = (o: { key: string; labels?: Record<string, string> }) =>
      o.labels?.[region.primaryLocale] ?? o.labels?.it ?? o.labels?.en ?? o.key;

    const materials = p.materials.filter((m) => m.enabled);
    return {
      regionCode: region.code,
      ready: true as const,
      allowed: true as const,
      configuratorId: cat.configuratorId,
      configuratorName: cat.configuratorName,
      locale: region.primaryLocale,
      payload: publicPayload(p),
      materials: materials.map((m) => ({ key: m.key, label: lbl(m) })),
      quality: Object.fromEntries(
        materials.map((m) => [
          m.key,
          p.qualityTiers
            .filter((q) => q.materialKey === m.key && q.enabled)
            .map((q) => ({ key: q.key, label: lbl(q) })),
        ]),
      ) as Record<string, { key: string; label: string }[]>,
      glazing: p.glazing.filter((g) => g.enabled).map((g) => ({ key: g.key, label: lbl(g) })),
      finish: p.finish.filter((f) => f.enabled).map((f) => ({ key: f.key, label: lbl(f) })),
      installation: p.hardware
        .filter((h) => h.kind === "installation" && h.enabled)
        .map((h) => ({ key: h.key, label: lbl(h), priceCents: h.priceCents })),
      // Markets that price "posa" under their own catalog kind (FR pose type,
      // DE/LU montage system) have NO 'installation' options — the showroom's
      // Posa select used to render empty for them. Expose those lists so the
      // page can fall back to the one this market actually uses.
      poseType: p.hardware
        .filter((h) => h.kind === "poseType" && h.enabled)
        .map((h) => ({ key: h.key, label: lbl(h), priceCents: h.priceCents })),
      montageSystem: p.hardware
        .filter((h) => h.kind === "montageSystem" && h.enabled)
        .map((h) => ({ key: h.key, label: lbl(h), priceCents: h.priceCents })),
    };
  },
});
