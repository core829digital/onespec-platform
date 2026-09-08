import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import {
  calculatePrice as baseCalculatePrice,
  computeUw,
  computeOverallUw,
} from "@/shared/pricing";
import type { RegionCode } from "@/convex/lib/regions";
import { REGIONS } from "@/convex/lib/regions";
import { complianceForRegion } from "@/convex/lib/compliance";

export interface VatBreakdown {
  rate: number;
  label: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
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
  region: RegionCode;
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

export interface MonthlyRateParams {
  totalCents: number;
  months: number;
  ratePercent: number;
}

export interface CalculationResult {
  priceCents: number;
  priceExVatCents: number;
  vatRatePercent: number;
  vatBreakdown: VatBreakdown[];
  totalVatCents: number;
  beniSignificativi: BeniSignificativiBreakdown | null;
  uwPerItem: number[];
  uwWeightedAverage: number;
  uwEligible: boolean;
  energySavingsKwhYear: number;
  fundingDocParams: FundingDocParams | null;
  monthlyRate24Months: number;
  netAfterBonus50: number;
  items: Array<{
    areaM2: number;
    perimeterM: number;
    materialCost: number;
    profileCost: number;
    optionsCost: number;
    unitPrice: number;
    quantity: number;
    itemTotalCents: number;
  }>;
  calculatedAt: number;
  catalogVersion: number;
}

function getHardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find((h) => h.kind === kind && h.key === key && h.enabled);
}

export function calculatePrice(payload: CatalogPayload, items: ProjectItem[]) {
  return baseCalculatePrice(payload, items);
}

export function calculateUw(payload: CatalogPayload, item: ProjectItem): number {
  return computeUw(payload, item);
}

export function calculateOverallUw(payload: CatalogPayload, items: ProjectItem[]): number {
  return computeOverallUw(payload, items);
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
  regionCode: RegionCode,
  items: ProjectItem[],
  payload: CatalogPayload,
  baseCalc: ReturnType<typeof baseCalculatePrice>,
  isEnergyRenovation: boolean,
  buildingAge: number
): VatBreakdown[] {
  const regionPolicy = REGIONS[regionCode];
  const breakdown: VatBreakdown[] = [];

  if (regionCode === "IT") {
    let manoperaCents = 0;
    let beniCents = 0;
    let altriCents = 0;

    for (const item of items) {
      const itemBreakdown = baseCalc.items.find((ib) => ib.unitPrice > 0);
      if (!itemBreakdown) continue;

      const installationCost = item.installation
        ? (getHardwareOption(payload, "installation", item.installation)?.priceCents || 0)
        : 0;
      manoperaCents += installationCost * item.quantity;

      const materialCost = itemBreakdown.materialCost + itemBreakdown.profileCost;
      beniCents += materialCost * item.quantity;

      const optionsCost = itemBreakdown.optionsCost - installationCost;
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

  if (regionCode === "FR") {
    let vatKey = "renovation";
    if (isEnergyRenovation) vatKey = "renovation_energetique";
    const vatRate = regionPolicy.vatRates.find((v) => v.key === vatKey) || regionPolicy.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  if (regionCode === "BE") {
    const vatKey = buildingAge > 10 ? "renovation" : "standard";
    const vatRate = regionPolicy.vatRates.find((v) => v.key === vatKey) || regionPolicy.vatRates[0];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  if (regionCode === "LU") {
    const vatKey = isEnergyRenovation && buildingAge > 10 ? "super_reduit" : "standard";
    const vatRate = regionPolicy.vatRates.find((v) => v.key === vatKey) || regionPolicy.vatRates[1];
    breakdown.push({
      rate: vatRate.percent / 100,
      label: vatRate.label,
      baseCents: baseCalc.priceExVatCents,
      vatCents: baseCalc.priceCents - baseCalc.priceExVatCents,
      totalCents: baseCalc.priceCents,
    });
    return breakdown;
  }

  const vatRate = regionPolicy.vatRates.find((v) => v.key === regionPolicy.defaultVatKey) || regionPolicy.vatRates[0];
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
  regionCode: RegionCode,
  uwPost: number,
  items: ProjectItem[],
  payload: CatalogPayload,
  baseCalc: ReturnType<typeof baseCalculatePrice>,
  deductionPercent: number,
  uwAnte?: number
): FundingDocParams | null {
  const funding = complianceForRegion(regionCode).funding;
  const superficieM2 = items.reduce(
    (s, it) => s + (it.width / 1000) * (it.height / 1000) * it.quantity,
    0
  );
  const costoCents = baseCalc.priceCents;

  if (regionCode === "IT") {
    const zone = "E";
    const uwLimit = 1.3;
    return {
      region: regionCode,
      title: funding.title,
      programme: funding.programme,
      hasXml: funding.hasPortalXml,
      preamble: funding.preamble,
      uwPost: Math.round(uwPost * 100) / 100,
      uwAnte: uwAnte ? Math.round(uwAnte * 100) / 100 : undefined,
      deltaU: uwAnte ? Math.round((uwAnte - uwPost) * 100) / 100 : undefined,
      superficieM2: Math.round(superficieM2 * 100) / 100,
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
    region: regionCode,
    title: funding.title,
    programme: funding.programme,
    hasXml: funding.hasPortalXml,
    preamble: funding.preamble,
    uwPost: Math.round(uwPost * 100) / 100,
    uwAnte: uwAnte ? Math.round(uwAnte * 100) / 100 : undefined,
    deltaU: uwAnte ? Math.round((uwAnte - uwPost) * 100) / 100 : undefined,
    superficieM2: Math.round(superficieM2 * 100) / 100,
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

function checkUwEligibility(regionCode: RegionCode, uw: number): boolean {
  const limits: Record<RegionCode, number> = {
    IT: 1.4,
    FR: 1.3,
    BE: 1.5,
    NL: 1.5,
    DE: 0.95,
    LU: 1.0,
  };
  return uw <= (limits[regionCode] || 999);
}

function estimateEnergySavings(regionCode: RegionCode, uw: number, items: ProjectItem[]): number {
  const zonaGG: Record<RegionCode, number> = {
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

export function serverCalculate(
  payload: CatalogPayload,
  items: ProjectItem[],
  options: {
    regionCode: RegionCode;
    buildingAge: number;
    isEnergyRenovation: boolean;
    deductionPercent: number;
    uwAnte?: number;
  }
): CalculationResult {
  const { regionCode, buildingAge, isEnergyRenovation, deductionPercent, uwAnte } = options;

  const baseCalc = baseCalculatePrice(payload, items);
  const uwPerItem = items.map((item) => calculateUw(payload, item));
  const uwWeightedAverage = calculateOverallUw(payload, items);
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
    uwWeightedAverage: Math.round(uwWeightedAverage * 1000) / 1000,
    uwEligible,
    energySavingsKwhYear,
    fundingDocParams,
    monthlyRate24Months,
    netAfterBonus50,
    items: baseCalc.items,
    calculatedAt: Date.now(),
    catalogVersion: 0,
  };
}