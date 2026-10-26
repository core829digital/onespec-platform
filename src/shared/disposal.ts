/**
 * Disposal (smaltimento) of the old windows, in one place.
 *
 * The installer sets ONE price per configurator and says how it is charged:
 *   - "perPiece": the price for every piece (× its quantity) that has the disposal;
 *   - "perJob":   one flat price for the whole job, however many pieces have it.
 * Like the fitting (posa), the price is charged as entered (VAT excluded, no margin on top) and the customer or the
 * installer chooses, piece by piece, whether it applies. It exists in every market: the engine, the widget, the
 * Showroom and the B2B quote all read this file, so they can never disagree by a cent.
 */

export type DisposalModel = "perPiece" | "perJob";

export const DISPOSAL_MODELS: readonly DisposalModel[] = ["perPiece", "perJob"];

/** Highest disposal price accepted: 10 000 EUR, in cents (a flat price per job can be a large one). */
export const MAX_DISPOSAL_PRICE_CENTS = 1_000_000;

export interface DisposalSettings {
  disposalModel?: DisposalModel;
  /** Cents, VAT excluded. 0 / absent = not offered. */
  disposalPriceCents?: number;
  /** Whether a piece has the disposal when it does not say so itself. Absent = no: the customer opts in. */
  disposalDefault?: "with" | "without";
}

export interface DisposalItem {
  quantity: number;
  withDisposal?: boolean;
}

export interface DisposalCharge {
  model: DisposalModel;
  /** The configured price, cents (per piece or per job, as `model` says). */
  priceCents: number;
  /** How many pieces (quantity counted) have the disposal. */
  pieces: number;
  /** What is added to the net total, cents. 0 when no piece has it. */
  includedCents: number;
}

/** The price is a whole, positive number of cents within the limit; anything else means "not offered". */
export function disposalPriceOf(cfg: DisposalSettings | undefined): number {
  const c = cfg?.disposalPriceCents;
  return typeof c === "number" && Number.isInteger(c) && c > 0 && c <= MAX_DISPOSAL_PRICE_CENTS ? c : 0;
}

export function disposalOffered(cfg: DisposalSettings | undefined): boolean {
  return disposalPriceOf(cfg) > 0;
}

export function disposalModelOf(cfg: DisposalSettings | undefined): DisposalModel {
  return cfg?.disposalModel === "perJob" ? "perJob" : "perPiece";
}

/** Whether a piece has the disposal: its own choice, else the configurator's default (opt-in unless set to "with"). */
export function itemHasDisposal(cfg: DisposalSettings | undefined, item: Pick<DisposalItem, "withDisposal">): boolean {
  return disposalOffered(cfg) && (item.withDisposal ?? cfg?.disposalDefault === "with");
}

/** The disposal of a project: undefined when the configurator does not offer it. */
export function disposalCharge(cfg: DisposalSettings | undefined, items: DisposalItem[]): DisposalCharge | undefined {
  const price = disposalPriceOf(cfg);
  if (price <= 0) return undefined;
  const model = disposalModelOf(cfg);
  let pieces = 0;
  for (const item of items) {
    if (itemHasDisposal(cfg, item)) pieces += Math.max(1, Math.trunc(item.quantity) || 1);
  }
  const includedCents = pieces === 0 ? 0 : model === "perJob" ? price : price * pieces;
  return { model, priceCents: price, pieces, includedCents };
}

/** Euros typed by the installer ("35", "35,50", "1200,5") -> whole cents, or null when it is not an amount of 0 - 10 000 with at most two decimals. */
export function parseDisposalPriceInput(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return cents <= MAX_DISPOSAL_PRICE_CENTS ? cents : null;
}
