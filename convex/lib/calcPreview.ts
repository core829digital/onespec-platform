import { regionForCountry } from "./regions";
import { calculatePrice, computeOverallUw, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { complianceForRegion } from "./compliance";
import { UW_LIMIT_BY_ZONE } from "./enea";
import { FISCAL, PREVIEW_IT_ZONE, fiscalFor, itBeniSignificativi, itSplitFromItems, itVatLines, type BeniSignificativiBreakdown } from "./fiscal";

export type { BeniSignificativiBreakdown };

/**
 * Pure calculation behind the Showroom preview (price, VAT breakdown, Uw,
 * energy savings, funding parameters). No database access: the same function
 * runs on the server (calculations.calculateInternal) and in the public demo.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface VatBreakdown {
  rate: number;
  label: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  /** The rate the country's rules point to for this job, when it differs from the rate applied (the configurator's). */
  suggested?: { rate: number; label: string };
}

export interface FundingDocParams {
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

/** The tax's own name per market, for a configurator rate the region's list does not name. */
const VAT_NAME: Record<string, string> = { IT: "IVA", FR: "TVA", BE: "TVA", LU: "TVA", NL: "btw", DE: "MwSt." };

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
    breakdown.push(...itVatLines(itBeniSignificativi(itSplitFromItems(payload, items, baseCalc))));
    return breakdown;
  }

  // FR / BE / LU pick a rate from the job (energy renovation, building age); the amounts, the headline price, the
  // PDF and the saved quote all use the configurator's rate. The line shows the rate actually applied, and the
  // policy rate only as a suggestion when it differs, never a policy label next to an amount it did not produce (issue #34).
  let policyKey = region.defaultVatKey;
  if (region.code === "FR") policyKey = isEnergyRenovation ? "renovation_energetique" : "renovation";
  if (region.code === "BE") policyKey = buildingAge > 10 ? "renovation" : "standard";
  if (region.code === "LU") policyKey = isEnergyRenovation && buildingAge > 10 ? "super_reduit" : "standard";
  const policy = region.vatRates.find((v) => v.key === policyKey);
  const appliedPercent = baseCalc.vatRatePercent;
  const applied = region.vatRates.find((v) => v.percent === appliedPercent);
  breakdown.push({
    rate: appliedPercent / 100,
    label: applied?.label ?? `${VAT_NAME[region.code]} ${appliedPercent}%`,
    baseCents: baseCalc.priceExVatCents,
    vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
    totalCents: baseCalc.priceCents,
    ...(policy && policy.percent !== appliedPercent ? { suggested: { rate: policy.percent / 100, label: policy.label } } : {}),
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
    const zone = PREVIEW_IT_ZONE;
    const uwLimit = UW_LIMIT_BY_ZONE[zone];
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
      gradiGiorno: FISCAL.IT.gradiGiorno,
      risparmioKwhAnno: Math.round(Math.max((uwAnte ?? FISCAL.IT.uwReference) - uwPost, 0) * superficieM2 * FISCAL.IT.gradiGiorno * 24 / 1000),
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

export function checkUwEligibility(regionCode: string, uw: number): boolean {
  return uw <= (fiscalFor(regionCode)?.eligibilityUwLimit || 999);
}

function estimateEnergySavings(regionCode: string, uw: number, items: ProjectItem[]): number {
  const fiscal = fiscalFor(regionCode) ?? FISCAL.IT;
  const superficieM2 = items.reduce((s, it) => s + (it.width / 1000) * (it.height / 1000) * it.quantity, 0);
  const deltaU = Math.max(fiscal.uwReference - uw, 0);
  return Math.round(deltaU * superficieM2 * fiscal.gradiGiorno * 24 / 1000);
}

export interface CalculationOptions {
  regionCode: "IT" | "FR" | "BE" | "NL" | "DE" | "LU";
  buildingAge: number;
  isEnergyRenovation: boolean;
  deductionPercent: number;
  uwAnte?: number;
}

export function computeCalculationPreview(
  payload: CatalogPayload,
  catalogVersion: number,
  items: ProjectItem[],
  options: CalculationOptions,
) {
  const { regionCode, buildingAge, isEnergyRenovation, deductionPercent, uwAnte } = options;

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
    beniSignificativi = itBeniSignificativi(itSplitFromItems(payload, items, baseCalc));
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
}
