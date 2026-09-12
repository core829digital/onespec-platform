import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { regionForCountry } from "./lib/regions";
import { complianceForRegion } from "./lib/compliance";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../src/shared/pricing";
import { computeOverallUw } from "../src/shared/pricing";
import { enforceForFiscalEngine } from "./lib/enforcement";
import { internal } from "./_generated/api";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getHardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find((h) => h.kind === kind && h.key === key && h.enabled);
}

interface VatBreakdown {
  rate: number;
  label: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
}

interface BeniSignificativiBreakdown {
  beni10: number;
  beni22: number;
  imponibile10: number;
  iva10: number;
  imponibile22: number;
  iva22: number;
  totalCents: number;
}

interface FundingDocParams {
  region: string;
  title: string;
  programme: string;
  hasXml: boolean;
  preamble: string[];
  uwPost: number;
  uwAnte?: number;
  deltaU?: number;
  superficieM2?: number;
  costoCents?: number;
  deductionPercent?: number;
  conform?: boolean;
  uwLimit?: number;
  zone?: string;
  gradiGiorno?: number;
  risparmioKwhAnno?: number;
}

function calculateBeniSignificativi(manoperaCents: number, beniCents: number, altriCents: number): BeniSignificativiBreakdown {
  const limitaBeniLa10 = manoperaCents + altriCents;
  const beni10 = Math.min(beniCents, limitaBeniLa10);
  const beni22 = Math.max(0, beniCents - limitaBeniLa10);
  const imponibile10 = manoperaCents + altriCents + beni10;
  const iva10 = Math.round(imponibile10 * 0.1);
  const imponibile22 = beni22;
  const iva22 = Math.round(imponibile22 * 0.22);
  const totalCents = imponibile10 + iva10 + imponibile22 + iva22;
  return { beni10, beni22, imponibile10, iva10, imponibile22, iva22, totalCents };
}

function calculateVatBreakdown(
  regionCode: string,
  items: ProjectItem[],
  payload: CatalogPayload,
  baseCalc: ReturnType<typeof calculatePrice>,
  isEnergyRenovation: boolean,
  buildingAge: number
): VatBreakdown[] {
  const region = regionForCountry(regionCode);
  const breakdown: VatBreakdown[] = [];

  if (region.code === "IT") {
    let manoperaCents = 0;
    let beniCents = 0;
    let altriCents = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ib = baseCalc.items[i];
      if (!ib) continue;

      const installationCost = item.installation
        ? (getHardwareOption(payload, "installation", item.installation)?.priceCents || 0)
        : 0;
      manoperaCents += installationCost * item.quantity;

      const materialCost = ib.materialCost + ib.profileCost;
      beniCents += materialCost * item.quantity;

      const optionsCost = ib.optionsCost - installationCost;
      altriCents += optionsCost * item.quantity;
    }

    const beniSig = calculateBeniSignificativi(manoperaCents, beniCents, altriCents);

    breakdown.push({
      rate: 0.1,
      label: "IVA 10% (manopera + beni fino a concorrenza manopera)",
      baseCents: beniSig.imponibile10,
      vatCents: beniSig.iva10,
      totalCents: beniSig.imponibile10 + beniSig.iva10,
    });
    breakdown.push({
      rate: 0.22,
      label: "IVA 22% (beni eccedenti)",
      baseCents: beniSig.imponibile22,
      vatCents: beniSig.iva22,
      totalCents: beniSig.imponibile22 + beniSig.iva22,
    });
    return breakdown;
  }

  if (region.code === "FR") {
    let vatKey = "renovation";
    if (isEnergyRenovation) vatKey = "renovation_energetique";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  if (region.code === "BE") {
    const vatKey = buildingAge > 10 ? "renovation" : "standard";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[0];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  if (region.code === "LU") {
    const vatKey = isEnergyRenovation && buildingAge > 10 ? "super_reduit" : "standard";
    const vatRate = region.vatRates.find((v) => v.key === vatKey) || region.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  const vatRate = region.vatRates.find((v) => v.key === region.defaultVatKey) || region.vatRates[0];
  breakdown.push({
    rate: vatRate.percent / 100,
    label: vatRate.label,
    baseCents: baseCalc.priceExVatCents,
    vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
    totalCents: baseCalc.priceCents,
  });
  return breakdown;
}

function getFundingDocParams(
  regionCode: string,
  uwPost: number,
  items: ProjectItem[],
  payload: CatalogPayload,
  baseCalc: ReturnType<typeof calculatePrice>,
  deductionPercent: number,
  uwAnte?: number
): FundingDocParams | null {
  const region = regionForCountry(regionCode);
  const funding = complianceForRegion(region.code).funding;
  const superficieM2 = items.reduce(
    (s, it) => s + (it.width / 1000) * (it.height / 1000) * it.quantity,
    0
  );
  const costoCents = baseCalc.priceCents;

  if (region.code === "IT") {
    const zone = "E";
    const uwLimit = 1.3;
    return {
      region: region.code,
      title: funding.title,
      programme: funding.programme,
      hasXml: funding.hasPortalXml,
      preamble: funding.preamble,
      uwPost: round2(uwPost),
      uwAnte: uwAnte ? round2(uwAnte) : undefined,
      deltaU: uwAnte ? round2(uwAnte - uwPost) : undefined,
      superficieM2: round2(superficieM2),
      costoCents,
      deductionPercent,
      conform: uwPost <= uwLimit,
      uwLimit,
      zone,
      gradiGiorno: 1661,
      risparmioKwhAnno: Math.round(Math.max((uwAnte ?? 3.2) - uwPost, 0) * superficieM2 * 1661 * 24 / 1000),
    };
  }

  return {
    region: region.code,
    title: funding.title,
    programme: funding.programme,
    hasXml: funding.hasPortalXml,
    preamble: funding.preamble,
    uwPost: round2(uwPost),
    uwAnte: uwAnte ? round2(uwAnte) : undefined,
    deltaU: uwAnte ? round2(uwAnte - uwPost) : undefined,
    superficieM2: round2(superficieM2),
    costoCents,
    deductionPercent,
  };
}

function calculateMonthlyRate(totalCents: number, months: number = 24, ratePercent: number = 0): number {
  if (ratePercent === 0) return Math.round(totalCents / months);
  const monthlyRate = ratePercent / 100 / 12;
  const payment = (totalCents * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

function calculateNetAfterBonus50(totalCents: number, deductionPercent: number = 50): number {
  return Math.round(totalCents * (1 - deductionPercent / 100));
}

function checkUwEligibility(regionCode: string, uw: number): boolean {
  const limits: Record<string, number> = {
    IT: 1.4,
    FR: 1.3,
    BE: 1.5,
    NL: 1.5,
    DE: 0.95,
    LU: 1.0,
  };
  return uw <= (limits[regionCode] || 999);
}

function estimateEnergySavings(regionCode: string, uw: number, items: ProjectItem[]): number {
  const zonaGG: Record<string, number> = {
    IT: 1661,
    FR: 1800,
    BE: 1900,
    NL: 1800,
    DE: 2200,
    LU: 2000,
  };
  const gg = zonaGG[regionCode] || 1661;
  const superficieM2 = items.reduce((s, it) => s + (it.width / 1000) * (it.height / 1000) * it.quantity, 0);
  const uwReference = { IT: 3.2, FR: 2.8, BE: 2.8, NL: 2.8, DE: 2.8, LU: 2.8 }[regionCode] || 3.2;
  const deltaU = Math.max(uwReference - uw, 0);
  return Math.round(deltaU * superficieM2 * gg * 24 / 1000);
}

async function getTenantCatalog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  tenantId: string
): Promise<{ payload: CatalogPayload; version: number; configuratorId: string } | null> {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) return null;

  const configurators = await ctx.db
    .query("configurators")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter(
      (c: { status?: string; publishedCatalogVersion?: number }) =>
        c.status === "published" && c.publishedCatalogVersion !== undefined,
    )
    .collect();

  if (configurators.length === 0) return null;

  const configurator = configurators[0];
  const targetVersion = configurator.publishedCatalogVersion ?? 1;
const versionDoc = await ctx.db
    .query("catalogVersions")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_configurator_version", (q: any) =>
      q.eq("configuratorId", configurator._id).eq("version", targetVersion),
    )
    .unique();

  if (!versionDoc) return null;

  return {
    payload: versionDoc.payload as CatalogPayload,
    version: targetVersion,
    configuratorId: configurator._id,
  };
}

export const serverCalculate = mutation({
  args: {
    tenantId: v.id("tenants"),
    items: v.array(v.any()),
    options: v.object({
      regionCode: v.union(v.literal("IT"), v.literal("FR"), v.literal("BE"), v.literal("NL"), v.literal("DE"), v.literal("LU")),
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
    vatBreakdown: Array<{ rate: number; label: string; baseCents: number; vatCents: number; totalCents: number }>;
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
    calculatedAt: number;
    catalogVersion: number;
  }> => {
    await requireUser(ctx);
    await enforceForFiscalEngine(ctx, args.tenantId);

    const result = await ctx.runQuery(internal.calculations.calculateInternal, {
      tenantId: args.tenantId,
      items: args.items,
      options: args.options,
    });

    return result;
  },
});

export const getCalculationPreview = query({
  args: {
    tenantId: v.id("tenants"),
    items: v.array(v.any()),
    options: v.object({
      regionCode: v.union(v.literal("IT"), v.literal("FR"), v.literal("BE"), v.literal("NL"), v.literal("DE"), v.literal("LU")),
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
    vatBreakdown: Array<{ rate: number; label: string; baseCents: number; vatCents: number; totalCents: number }>;
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
    calculatedAt: number;
    catalogVersion: number;
  }> => {
    await requireUser(ctx);

    const result = await ctx.runQuery(internal.calculations.calculateInternal, {
      tenantId: args.tenantId,
      items: args.items,
      options: args.options,
    });

    return result;
  },
});
/** Shared internal calculation logic used by both serverCalculate and getCalculationPreview. */
export const calculateInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    items: v.array(v.any()),
    options: v.object({
      regionCode: v.union(v.literal("IT"), v.literal("FR"), v.literal("BE"), v.literal("NL"), v.literal("DE"), v.literal("LU")),
      buildingAge: v.number(),
      isEnergyRenovation: v.boolean(),
      deductionPercent: v.number(),
      uwAnte: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const catalogData = await getTenantCatalog(ctx, args.tenantId);
    if (!catalogData) throw new Error("NO_CATALOG");

    const { payload, version: catalogVersion } = catalogData;
    const items = args.items as ProjectItem[];
    const { regionCode, buildingAge, isEnergyRenovation, deductionPercent, uwAnte } = args.options;

    const baseCalc = calculatePrice(payload, items);
    const uwPerItem = items.map((item) => {
      const material = payload.materials.find((m) => m.key === item.material && m.enabled);
      const quality = payload.qualityTiers.find(
        (q) => q.materialKey === item.material && q.key === item.quality[item.material] && q.enabled
      );
      const glazing = payload.glazing.find((g) => g.key === item.glazing && g.enabled);

      if (!material || !quality || !glazing) return 0;

      const frameU = (material.uFrameBase || 1.3) + (quality.uAdjust || 0);
      const glassU = glazing.uGlass || 1.1;
      const glassToFrameRatio = 0.7;

      return glassToFrameRatio * glassU + (1 - glassToFrameRatio) * frameU;
    });
    const uwWeightedAverage = computeOverallUw(payload, items);
    const uwEligible = checkUwEligibility(regionCode, uwWeightedAverage);
    const energySavingsKwhYear = estimateEnergySavings(regionCode, uwWeightedAverage, items);

    const vatBreakdown = calculateVatBreakdown(regionCode, items, payload, baseCalc, isEnergyRenovation, buildingAge);
    const totalVatCents = vatBreakdown.reduce((sum, v) => sum + v.vatCents, 0);

    let beniSignificativi: BeniSignificativiBreakdown | null = null;
    if (regionCode === "IT") {
      let manoperaCents = 0;
      let beniCents = 0;
      let altriCents = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const ib = baseCalc.items[i];
        if (!ib) continue;

        const installationCost = item.installation
          ? (getHardwareOption(payload, "installation", item.installation)?.priceCents || 0)
          : 0;
        manoperaCents += installationCost * item.quantity;

        const materialCost = ib.materialCost + ib.profileCost;
        beniCents += materialCost * item.quantity;

        const optionsCost = ib.optionsCost - installationCost;
        altriCents += optionsCost * item.quantity;
      }

      beniSignificativi = calculateBeniSignificativi(manoperaCents, beniCents, altriCents);
    }

    const fundingDocParams = getFundingDocParams(
      regionCode,
      uwWeightedAverage,
      items,
      payload,
      baseCalc,
      deductionPercent,
      uwAnte
    );

    const monthlyRate24Months = calculateMonthlyRate(baseCalc.priceCents, 24, 0);
    const netAfterBonus50 = regionCode === "IT" ? calculateNetAfterBonus50(baseCalc.priceCents, deductionPercent) : 0;

    return {
      priceCents: baseCalc.priceCents,
      priceExVatCents: baseCalc.priceExVatCents,
      vatRatePercent: baseCalc.vatRatePercent,
      vatBreakdown,
      totalVatCents,
      beniSignificativi,
      uwPerItem,
      uwWeightedAverage: round2(uwWeightedAverage),
      uwEligible,
      energySavingsKwhYear,
      fundingDocParams,
      monthlyRate24Months,
      netAfterBonus50,
      items: baseCalc.items,
      calculatedAt: Date.now(),
      catalogVersion,
    };
  },
});

/** Option lists for the in-app Showroom configurator (FASE 3). */
export const getShowroomCatalog = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const tenant = await ctx.db.get(args.tenantId);
    const region = regionForCountry(tenant?.country);

    const cat = await getTenantCatalog(ctx, args.tenantId);
    if (!cat) return { regionCode: region.code, ready: false as const };

    const p = cat.payload;
    const lbl = (o: { key: string; labels?: Record<string, string> }) =>
      o.labels?.[region.primaryLocale] ?? o.labels?.it ?? o.labels?.en ?? o.key;

    const materials = p.materials.filter((m) => m.enabled);
    return {
      regionCode: region.code,
      ready: true as const,
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
    };
  },
});
