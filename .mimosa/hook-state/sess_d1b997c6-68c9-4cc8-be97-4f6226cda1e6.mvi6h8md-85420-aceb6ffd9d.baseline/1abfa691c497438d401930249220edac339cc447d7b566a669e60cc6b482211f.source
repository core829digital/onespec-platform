/**
 * What sits on top of the pieces' price in a B2B quote, in one place: the quote-level extras, the discount and the VAT.
 * The quote editor shows these figures and the server records them, so both read this file and can never differ by a cent.
 * (The pieces themselves are priced by `calculatePrice`, the same engine the public widget and the Showroom use.)
 */

export interface RegionalExtrasInput {
  hvlJointCount: number;
  isostoneSill: boolean;
  /** Paid measurement service, euros. */
  inmeetServiceEuros: number;
  rensonGrilleWidthMm: number;
  voletMonoblocHeightMm: number;
  ralMontage: boolean;
  rcSecurityLevel: string;
  pieceCount: number;
}

/** Country-specific lump sums the installer adds to a quote. All are zero until the installer asks for them. */
export function regionalExtrasCents(region: string, o: RegionalExtrasInput): number {
  let cents = 0;
  if (region === "NL") {
    cents += Math.max(0, o.hvlJointCount) * 4500; // HVL joint
    if (o.isostoneSill) cents += 9500;
    cents += Math.max(0, Math.round(o.inmeetServiceEuros * 100));
  } else if (region === "BE") {
    if (o.rensonGrilleWidthMm > 0) cents += Math.round((o.rensonGrilleWidthMm / 1000) * 8500); // Renson grille per metre
    if (o.voletMonoblocHeightMm > 0) cents += 22000;
  } else if (region === "DE" || region === "LU") {
    if (o.ralMontage) cents += o.pieceCount * 4500; // RAL fitting kit per piece
    if (o.rcSecurityLevel === "RC2") cents += o.pieceCount * 6500;
    if (o.rcSecurityLevel === "RC3") cents += o.pieceCount * 12000;
  }
  return cents;
}

export interface QuoteTotalsInput {
  /** The pieces, VAT excluded (calculatePrice().priceExVatCents). */
  supplyExVatCents: number;
  installCents: number;
  demolitionCents: number;
  regionalCents: number;
  /** 0..100 */
  discountPercent: number;
  /** The rate that is really applied (the fiscal rules may force 0). */
  vatPercent: number;
}

export function quoteTotals(i: QuoteTotalsInput): { subtotalExVatCents: number; discountedExVatCents: number; grossCents: number } {
  const subtotalExVatCents = i.supplyExVatCents + i.installCents + i.demolitionCents + i.regionalCents;
  const discountedExVatCents = Math.round(subtotalExVatCents * (1 - i.discountPercent / 100));
  const grossCents = Math.round(discountedExVatCents * (1 + i.vatPercent / 100));
  return { subtotalExVatCents, discountedExVatCents, grossCents };
}
