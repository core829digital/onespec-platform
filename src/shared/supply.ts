// Supply (Fornitura): one process per quote, from the offer to the delivery of the windows.
//
//   quote -> order -> production -> delivery -> delivered
//
//  * quote       the offer sent to the customer.
//  * order       the customer paid / signed: the deal is closed (the quote is "won").
//  * production  the order went to the factory; the installer owes the factory its price (factory cost).
//  * delivery    the goods travel to the site (transport cost of the deliverer).
//  * delivered   done: from here the supply counts in the net profit.
//
// Net profit = what the customer pays WITHOUT VAT, minus what the installer pays the factory, the deliverer and the other
// costs (all entered without VAT). Income taxes are never subtracted: the figure is before taxes and without VAT.

export const SUPPLY_STAGES = ["quote", "order", "production", "delivery", "delivered"] as const;
export type SupplyStage = (typeof SUPPLY_STAGES)[number];

export const PARTNER_ROLES = ["producer", "deliverer"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

/** Largest amount accepted for a single cost: 10,000,000 €. */
export const MAX_SUPPLY_AMOUNT_CENTS = 1_000_000_000;

export const nextStage = (s: SupplyStage): SupplyStage | null => SUPPLY_STAGES[SUPPLY_STAGES.indexOf(s) + 1] ?? null;
export const previousStage = (s: SupplyStage): SupplyStage | null => SUPPLY_STAGES[SUPPLY_STAGES.indexOf(s) - 1] ?? null;

export type MoneyCheck = { ok: true; cents: number } | { ok: false; code: "REQUIRED" | "NOT_A_NUMBER" | "TOO_MANY_DECIMALS" | "NEGATIVE" | "TOO_LARGE" };

/** Validates an amount in cents coming from a client (integer, 0 … MAX). */
export function checkAmountCents(raw: unknown): MoneyCheck {
  if (raw === undefined || raw === null) return { ok: false, code: "REQUIRED" };
  if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) return { ok: false, code: "NOT_A_NUMBER" };
  if (raw < 0) return { ok: false, code: "NEGATIVE" };
  if (raw > MAX_SUPPLY_AMOUNT_CENTS) return { ok: false, code: "TOO_LARGE" };
  return { ok: true, cents: raw };
}

/** Parses what an installer types in an euro field ("1234,5", "1234.50"): at most two decimals, no thousands separators. */
export function parseEuroInput(raw: string): MoneyCheck {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return { ok: false, code: "REQUIRED" };
  if (s.startsWith("-")) return { ok: false, code: "NEGATIVE" };
  if (!/^\d+([.,]\d*)?$/.test(s)) return { ok: false, code: "NOT_A_NUMBER" };
  const [whole, frac = ""] = s.split(/[.,]/);
  if (frac.length > 2) return { ok: false, code: "TOO_MANY_DECIMALS" };
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return checkAmountCents(cents);
}

export interface ProfitInput {
  revenueExVatCents: number;
  factoryCostCents?: number;
  transportCostCents?: number;
  otherCostsCents?: number;
}

export const supplyCostCents = (s: ProfitInput): number => (s.factoryCostCents ?? 0) + (s.transportCostCents ?? 0) + (s.otherCostsCents ?? 0);
export const supplyProfitCents = (s: ProfitInput): number => s.revenueExVatCents - supplyCostCents(s);

/** Net profit windows, in months: month, quarter, semester, year, 2, 3, 5 and 10 years. */
export const PROFIT_WINDOWS_MONTHS = [1, 3, 6, 12, 24, 36, 60, 120] as const;
export type ProfitWindowMonths = (typeof PROFIT_WINDOWS_MONTHS)[number];

/** `months` calendar months before `now` (UTC), clamping the day (31 March − 1 month = 28/29 February). */
export function windowStart(now: number, months: number): number {
  const d = new Date(now);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.getTime();
}

export interface ProfitWindow {
  months: ProfitWindowMonths;
  from: number;
  to: number;
  count: number;
  revenueExVatCents: number;
  costCents: number;
  netProfitCents: number;
}

export interface DeliveredSupply extends ProfitInput {
  deliveredAt: number;
}

/** Net profit of the supplies delivered inside each window ((from, to], so a supply is never counted twice in one window). */
export function summarizeProfit(delivered: DeliveredSupply[], now: number): ProfitWindow[] {
  return PROFIT_WINDOWS_MONTHS.map((months) => {
    const from = windowStart(now, months);
    let count = 0;
    let revenue = 0;
    let cost = 0;
    for (const s of delivered) {
      if (s.deliveredAt <= from || s.deliveredAt > now) continue;
      count += 1;
      revenue += s.revenueExVatCents;
      cost += supplyCostCents(s);
    }
    return { months, from, to: now, count, revenueExVatCents: revenue, costCents: cost, netProfitCents: revenue - cost };
  });
}

/** What the supplies still open are expected to earn (revenue minus the costs already known). */
export function expectedProfit(open: ProfitInput[]): { count: number; revenueExVatCents: number; costCents: number; netProfitCents: number } {
  let revenue = 0;
  let cost = 0;
  for (const s of open) {
    revenue += s.revenueExVatCents;
    cost += supplyCostCents(s);
  }
  return { count: open.length, revenueExVatCents: revenue, costCents: cost, netProfitCents: revenue - cost };
}
