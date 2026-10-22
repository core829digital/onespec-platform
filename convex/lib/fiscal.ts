import type { calculatePrice, CatalogPayload, ProjectItem } from "../../src/shared/pricing";
import { UW_LIMIT_BY_ZONE } from "./enea";

/**
 * Per-region fiscal constants and the Italian "beni significativi" VAT split,
 * in one place. The region registry (regions.ts) holds VAT rates and labels;
 * this file holds the numbers the showroom preview and the VAT breakdown read,
 * so no consumer keeps its own copy (issue #53).
 */

type RegionCode = "IT" | "FR" | "BE" | "NL" | "DE" | "LU";

/** The preview has no address, so Italy is judged for climate zone E (the most populated one). */
export const PREVIEW_IT_ZONE = "E" as const;

export interface RegionFiscal {
  /** Uw (W/m²K) a window must not exceed to count as eligible for the region's incentive. */
  eligibilityUwLimit: number;
  /** Heating degree-days used for the energy-saving estimate. */
  gradiGiorno: number;
  /** Uw of the window being replaced, when the customer does not give one. */
  uwReference: number;
}

export const FISCAL: Record<RegionCode, RegionFiscal> = {
  // Badge and ENEA document read the same zone limit (DM 6/8/2020, Allegato E).
  IT: { eligibilityUwLimit: UW_LIMIT_BY_ZONE[PREVIEW_IT_ZONE], gradiGiorno: 1661, uwReference: 3.2 },
  FR: { eligibilityUwLimit: 1.3, gradiGiorno: 1800, uwReference: 2.8 },
  BE: { eligibilityUwLimit: 1.5, gradiGiorno: 1900, uwReference: 2.8 },
  NL: { eligibilityUwLimit: 1.5, gradiGiorno: 1800, uwReference: 2.8 },
  DE: { eligibilityUwLimit: 0.95, gradiGiorno: 2200, uwReference: 2.8 },
  LU: { eligibilityUwLimit: 1.0, gradiGiorno: 2000, uwReference: 2.8 },
};

export function fiscalFor(regionCode: string): RegionFiscal | undefined {
  return FISCAL[regionCode as RegionCode];
}

export interface ItSplit {
  manoperaCents: number;
  beniCents: number;
  altriCents: number;
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

/** Labour (posa), goods (frame + profile) and other options of the priced pieces. */
export function itSplitFromItems(
  payload: CatalogPayload,
  items: ProjectItem[],
  baseCalc: ReturnType<typeof calculatePrice>,
): ItSplit {
  let manoperaCents = 0;
  let beniCents = 0;
  let altriCents = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const ib = baseCalc.items[i];
    if (!ib) continue;
    const installationCost = item.installation
      ? (payload.hardware.find((h) => h.kind === "installation" && h.key === item.installation && h.enabled)?.priceCents || 0)
      : 0;
    manoperaCents += installationCost * item.quantity;
    beniCents += (ib.materialCost + ib.profileCost) * item.quantity;
    altriCents += (ib.optionsCost - installationCost) * item.quantity;
  }
  return { manoperaCents, beniCents, altriCents };
}

/** Beni significativi: 10% on labour, other options and goods up to their value; 22% on the goods above it. */
export function itBeniSignificativi(split: ItSplit): BeniSignificativiBreakdown {
  const limitaBeniLa10 = split.manoperaCents + split.altriCents;
  const beni10 = Math.min(split.beniCents, limitaBeniLa10);
  const beni22 = Math.max(0, split.beniCents - limitaBeniLa10);
  const imponibile10 = split.manoperaCents + split.altriCents + beni10;
  const iva10 = Math.round(imponibile10 * 0.1);
  const imponibile22 = beni22;
  const iva22 = Math.round(imponibile22 * 0.22);
  const totalCents = imponibile10 + iva10 + imponibile22 + iva22;
  return { beni10, beni22, imponibile10, iva10, imponibile22, iva22, totalCents };
}

/** The two VAT lines of the Italian split. */
export function itVatLines(b: BeniSignificativiBreakdown) {
  return [
    {
      rate: 0.1,
      label: "IVA 10% (manopera + beni fino a concorrenza manopera)",
      baseCents: b.imponibile10,
      vatCents: b.iva10,
      totalCents: b.imponibile10 + b.iva10,
    },
    {
      rate: 0.22,
      label: "IVA 22% (beni eccedenti)",
      baseCents: b.imponibile22,
      vatCents: b.iva22,
      totalCents: b.imponibile22 + b.iva22,
    },
  ];
}

/** A percentage the visitor's browser sent, or null when it is missing or outside 0-100. */
export function visitorPercent(n: number | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * The VAT rate a widget submission is judged at: the rate the visitor picked in the widget when it is a valid
 * percentage, else the configurator's rate. The single decision point for the visitor's VAT (issue #56); the
 * tamper check compares the price the visitor saw at this rate.
 */
export function resolveVisitorVat(clientVatPercent: number | undefined, configuratorRatePercent: number): number {
  return visitorPercent(clientVatPercent) ?? configuratorRatePercent;
}
