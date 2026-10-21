/**
 * Fiscal registry (#53): the single home for per-region fiscal policy — the
 * constants and the IT "beni significativi" arithmetic that used to exist as
 * four hand-rolled copies (regions.calculateVAT, calcPreview's breakdown, an
 * inline twin inside computeCalculationPreview, and the dead module removed
 * by #37).
 *
 * The registry deliberately preserves today's values — including known
 * historical divergences, each kept as differently-named fields so aligning
 * them is a one-field edit (the former IT badge-vs-funding 1.4/1.3 split was
 * folded into one limit by #43).
 */
import type { RegionCode } from "./regions";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "../../src/shared/pricing";

export interface FiscalPolicy {
  /** The region's Uw limit for window replacement (IT: 1.4, DM 6 agosto 2020). Used by BOTH the eligibility badge and the funding document (#43: they used to disagree at 1.4 vs 1.3). */
  eligibilityUwLimit: number;
  /** Climate zone printed on the IT funding document. */
  climateZone?: string;
  /** Degree-days of the region's reference climate, used by savings estimates and the funding doc. */
  gradiGiorno: number;
  /** Uw of the window being replaced, the savings baseline. */
  uwReference: number;
}

export const FISCAL: Record<RegionCode, FiscalPolicy> = {
  IT: { eligibilityUwLimit: 1.4, climateZone: "E", gradiGiorno: 1661, uwReference: 3.2 },
  FR: { eligibilityUwLimit: 1.3, gradiGiorno: 1800, uwReference: 2.8 },
  BE: { eligibilityUwLimit: 1.5, gradiGiorno: 1900, uwReference: 2.8 },
  NL: { eligibilityUwLimit: 1.5, gradiGiorno: 1800, uwReference: 2.8 },
  DE: { eligibilityUwLimit: 0.95, gradiGiorno: 2200, uwReference: 2.8 },
  LU: { eligibilityUwLimit: 1.0, gradiGiorno: 2000, uwReference: 2.8 },
};

/** The IT beni-significativi split: manopera/beni/altri → the two VAT bases. */
export interface BeniSignificativiBreakdown {
  beni10: number;
  beni22: number;
  imponibile10: number;
  iva10: number;
  imponibile22: number;
  iva22: number;
  totalCents: number;
}

/** IT "beni significativi" arithmetic (character-identical to the four former copies). */
export function beniSignificativi(manoperaCents: number, beniCents: number, altriCents: number): BeniSignificativiBreakdown {
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

function hardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find((h) => h.kind === kind && h.key === key && h.enabled);
}

/** How an item's priced cost splits into the IT manopera / beni / altri buckets. */
export function itCostSplit(
  payload: CatalogPayload,
  items: ProjectItem[],
  baseCalc: ReturnType<typeof calculatePrice>,
): { manoperaCents: number; beniCents: number; altriCents: number } {
  let manoperaCents = 0;
  let beniCents = 0;
  let altriCents = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const ib = baseCalc.items[i];
    if (!ib) continue;

    const installationCost = item.installation
      ? (hardwareOption(payload, "installation", item.installation)?.priceCents || 0)
      : 0;
    manoperaCents += installationCost * item.quantity;

    const materialCost = ib.materialCost + ib.profileCost;
    beniCents += materialCost * item.quantity;

    const optionsCost = ib.optionsCost - installationCost;
    altriCents += optionsCost * item.quantity;
  }

  return { manoperaCents, beniCents, altriCents };
}

/**
 * Which catalogue VAT key applies for a region (the selection only — each
 * caller keeps its own amount arithmetic, which genuinely differs).
 * `null` key = use the region's `defaultVatKey`.
 */
export function vatKeyForRegion(
  code: RegionCode,
  isEnergyRenovation: boolean,
  buildingAge: number,
): { key: string | null; fallback: 0 | 1 } {
  switch (code) {
    case "FR":
      return { key: isEnergyRenovation ? "renovation_energetique" : "renovation", fallback: 1 };
    case "BE":
      return { key: buildingAge > 10 ? "renovation" : "standard", fallback: 0 };
    case "LU":
      return { key: isEnergyRenovation && buildingAge > 10 ? "super_reduit" : "standard", fallback: 1 };
    default:
      return { key: null, fallback: 0 };
  }
}
