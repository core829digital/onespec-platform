export interface CatalogPayload {
  configurator: {
    publicId: string;
    name: string;
    defaultLocale: string;
    defaultTheme: "light" | "dark" | "auto";
    vatRatePercent: number;
    priceRoundingStep: number;
    showPricesToEndUser: boolean;
    currency: "EUR";
  };
  branding: {
    whiteLabel: boolean;
    colorAccent: string;
    colorAccentInk: string;
    colorBg?: string;
    colorBgDark?: string;
    fontFamily: "space-grotesk" | "inter" | "geist" | "system";
    copy: Record<string, any>;
    companyInfo: {
      name: string;
      vatId?: string;
      address?: string;
      phone?: string;
      email?: string;
    };
  };
  materials: Array<{
    key: string;
    labels: Record<string, string>;
    basePerM2Cents: number;
    profilePerMlCents: number;
    uFrameBase?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  qualityTiers: Array<{
    materialKey: string;
    key: string;
    labels: Record<string, string>;
    multiplier: number;
    uAdjust?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  sizeConstraints: Array<{
    productType: "window" | "balconyDoor";
    sashCount: number;
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  }>;
  glazing: Array<{
    key: string;
    labels: Record<string, string>;
    priceCents: number;
    uGlass?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  finish: Array<{
    key: string;
    labels: Record<string, string>;
    swatchHex?: string;
    priceCents: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  hardware: Array<{
    kind: "hardware" | "hardwareColor" | "sashType" | "screen" | "threshold" | "misc";
    key: string;
    labels: Record<string, string>;
    priceCents: number;
    appliesToOperableOnly: boolean;
    sortOrder: number;
    enabled: boolean;
  }>;
}

export interface ProjectItem {
  productType: "window" | "balconyDoor";
  material: string;
  quality: Record<string, string>;
  width: number;
  height: number;
  quantity: number;
  sashes: Array<{
    type: "fix" | "classic" | "tiltturn" | "sliding";
    direction: "left" | "right";
    active: boolean;
    hardware: string;
    hardwareColor: string;
  }>;
  glazing: string;
  color: string;
  insectScreen: boolean;
}

export interface ItemBreakdown {
  areaM2: number;
  perimeterM: number;
  materialCost: number;
  profileCost: number;
  optionsCost: number;
  unitPrice: number;
  quantity: number;
  itemTotalCents: number;
}

export interface PriceBreakdown {
  /** Gross grand total in eurocents, VAT included, after rounding. THE price. */
  priceCents: number;
  /** Grand total ex-VAT in eurocents, after rounding. */
  priceExVatCents: number;
  vatRatePercent: number;
  /** Convenience alias of priceCents (legacy callers). */
  totalPrice: number;
  /** Per-item breakdowns, index-aligned with the input items array. */
  items: ItemBreakdown[];
  uwValue?: number;
}

function getMaterialConfig(payload: CatalogPayload, materialKey: string) {
  return payload.materials.find(m => m.key === materialKey && m.enabled);
}

function getQualityTier(payload: CatalogPayload, materialKey: string, qualityKey: string) {
  return payload.qualityTiers.find(q => q.materialKey === materialKey && q.key === qualityKey && q.enabled);
}

function getGlazingOption(payload: CatalogPayload, key: string) {
  return payload.glazing.find(g => g.key === key && g.enabled);
}

function getFinishOption(payload: CatalogPayload, key: string) {
  return payload.finish.find(f => f.key === key && f.enabled);
}

function getHardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find(h => h.kind === kind && h.key === key && h.enabled);
}

function getSizeConstraint(payload: CatalogPayload, productType: "window" | "balconyDoor", sashCount: number) {
  return payload.sizeConstraints.find(s => s.productType === productType && s.sashCount === sashCount);
}

export function calculatePrice(payload: CatalogPayload, items: ProjectItem[]): PriceBreakdown {
  const vatRate = payload.configurator.vatRatePercent;
  const roundingStep = payload.configurator.priceRoundingStep;

  let totalPriceCents = 0;
  let totalExVatCents = 0;
  const itemBreakdowns: ItemBreakdown[] = [];

  for (const item of items) {
    const material = getMaterialConfig(payload, item.material);
    const quality = getQualityTier(payload, item.material, item.quality[item.material]);
    const glazing = getGlazingOption(payload, item.glazing);
    const finish = getFinishOption(payload, item.color);

    if (!material || !quality) {
      itemBreakdowns.push({
        areaM2: 0, perimeterM: 0, materialCost: 0, profileCost: 0,
        optionsCost: 0, unitPrice: 0, quantity: item.quantity, itemTotalCents: 0,
      });
      continue;
    }

    const widthM = item.width / 1000;
    const heightM = item.height / 1000;
    const areaM2 = widthM * heightM;
    const perimeterM = 2 * (widthM + heightM);

    const materialCost = Math.round(material.basePerM2Cents * quality.multiplier * areaM2);
    const profileCost = Math.round(material.profilePerMlCents * perimeterM);

    let sashCost = 0;
    let hardwareCost = 0;
    for (const sash of item.sashes) {
      if (!sash.active) continue;
      const sashType = getHardwareOption(payload, "sashType", sash.type);
      if (sashType) sashCost += sashType.priceCents;
      if (sash.type !== "fix") {
        const hardware = getHardwareOption(payload, "hardware", sash.hardware);
        const hwColor = getHardwareOption(payload, "hardwareColor", sash.hardwareColor);
        if (hardware) hardwareCost += hardware.priceCents;
        if (hwColor) hardwareCost += hwColor.priceCents;
      }
    }

    const thresholdCost = item.productType === "balconyDoor"
      ? (getHardwareOption(payload, "threshold", "balconyDoorThreshold")?.priceCents || 0)
      : 0;

    const screenCost = item.insectScreen
      ? (getHardwareOption(payload, "screen", "insectScreen")?.priceCents || 0)
      : 0;

    const optionsCost = sashCost + hardwareCost + thresholdCost + (glazing?.priceCents || 0) + (finish?.priceCents || 0) + screenCost;

    const unitPrice = materialCost + profileCost + optionsCost;
    const itemTotal = unitPrice * item.quantity;

    totalPriceCents += itemTotal;
    totalExVatCents += Math.round(itemTotal / (1 + vatRate / 100));

    itemBreakdowns.push({
      areaM2, perimeterM, materialCost, profileCost, optionsCost,
      unitPrice, quantity: item.quantity, itemTotalCents: itemTotal,
    });
  }

  const step = roundingStep && roundingStep > 0 ? roundingStep : 1;
  const roundedTotal = Math.round(totalPriceCents / step) * step;
  const roundedExVat = Math.round(totalExVatCents / step) * step;

  return {
    priceCents: roundedTotal,
    priceExVatCents: roundedExVat,
    vatRatePercent: vatRate,
    totalPrice: roundedTotal,
    items: itemBreakdowns,
  };
}

export function computeUw(payload: CatalogPayload, item: ProjectItem): number {
  const material = getMaterialConfig(payload, item.material);
  const quality = getQualityTier(payload, item.material, item.quality[item.material]);
  const glazing = getGlazingOption(payload, item.glazing);

  if (!material || !quality || !glazing) return 0;

  const frameU = (material.uFrameBase || 1.3) + (quality.uAdjust || 0);
  const glassU = glazing.uGlass || 1.1;
  const glassToFrameRatio = 0.7;

  return glassToFrameRatio * glassU + (1 - glassToFrameRatio) * frameU;
}

export function computeOverallUw(payload: CatalogPayload, items: ProjectItem[]): number {
  let weightedSum = 0;
  let totalArea = 0;

  for (const item of items) {
    const areaM2 = (item.width / 1000) * (item.height / 1000) * item.quantity;
    const uw = computeUw(payload, item);
    weightedSum += uw * areaM2;
    totalArea += areaM2;
  }

  return totalArea > 0 ? weightedSum / totalArea : 0;
}