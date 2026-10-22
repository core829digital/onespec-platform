import { regionForCountry } from "./regions";
import { calculatePrice, computeOverallUw, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";
import { complianceForRegion } from "./compliance";
import { UW_LIMIT_BY_ZONE } from "./enea";

/**
 * The preview has no address, so Italy is judged for climate zone E (the most populated one, 1661 GG):
 * the eligibility badge and the ENEA document parameters read the SAME limit (DM 6/8/2020, Allegato E).
 */
const PREVIEW_IT_ZONE = "E" as const;

/**
 * Pure calculation behind the Showroom preview (price, VAT breakdown, Uw,
 * energy savings, funding parameters). No database access: the same function
 * runs on the server (calculations.calculateInternal) and in the public demo.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getHardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find((h) => h.kind === kind && h.key === key && h.enabled);
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

export interface BeniSignificativiBreakdown {
  beni10: number;
  beni22: number;
  imponibile10: number;
  iva10: number;
  imponibile22: number;
  iva22: number;
  totalCents: number;
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

export function checkUwEligibility(regionCode: string, uw: number): boolean {
  const limits: Record<string, number> = {
    IT: UW_LIMIT_BY_ZONE[PREVIEW_IT_ZONE],
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
}
