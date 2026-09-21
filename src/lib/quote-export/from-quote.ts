import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import type { ExportInput } from "./model";

export interface QuoteLike {
  offerNumber?: string;
  _creationTime: number;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  customerCity?: string;
  items: unknown;
  priceCents: number;
  vatRatePercent: number;
  installationPriceCents?: number;
  demolitionPriceCents?: number;
  regionalSurchargeCents?: number;
  discountPercent?: number;
  ecobonusPercent?: number;
  ecobonusDeductionCents?: number;
  maPrimeRenovPercent?: number;
  maPrimeRenovDeductionCents?: number;
  regionCode?: string;
  depositTerms?: string;
}

const LOCALE_BY_REGION: Record<string, string> = { IT: "it", FR: "fr", BE: "fr", DE: "de", NL: "nl", LU: "fr" };

export function localeForRegion(region?: string): string {
  return LOCALE_BY_REGION[region ?? "IT"] ?? "it";
}

/** Turn a saved quote (+ the catalogue version it was priced on) into export input. */
export function exportInputFromQuote(
  q: QuoteLike,
  payload: CatalogPayload,
  company: ExportInput["company"],
  opts: { locale?: string; drawings?: boolean } = {},
): ExportInput {
  const items = (Array.isArray(q.items) ? q.items : []) as ProjectItem[];
  const subsidyCents = q.ecobonusDeductionCents ?? q.maPrimeRenovDeductionCents;
  const subsidyPercent = q.ecobonusPercent ?? q.maPrimeRenovPercent;
  return {
    locale: opts.locale ?? localeForRegion(q.regionCode),
    offerNumber: q.offerNumber,
    dateMs: q._creationTime,
    company,
    client: { name: q.leadName, phone: q.leadPhone, city: q.customerCity, email: q.leadEmail },
    items,
    payload,
    money: {
      supplyExVatCents: calculatePrice(payload, items).priceExVatCents,
      installCents: q.installationPriceCents ?? 0,
      demolitionCents: q.demolitionPriceCents ?? 0,
      regionalCents: q.regionalSurchargeCents ?? 0,
      discountPercent: q.discountPercent ?? 0,
      vatPercent: q.vatRatePercent,
      grossCents: q.priceCents,
      subsidyPercent: subsidyCents ? subsidyPercent : undefined,
      subsidyCents: subsidyCents || undefined,
    },
    validityDays: 30,
    terms: q.depositTerms ? [q.depositTerms] : [],
    drawings: opts.drawings,
  };
}
