/**
 * Euro amounts as people type them in price lists and price cells -> whole cents.
 * Accepts it-IT and en grouping ("1.234,50", "1,234.50", "1 234,50", "1'234.50"), a leading or trailing "€",
 * and a single decimal separator with one or two digits ("12,5", "12.50"). A lone separator followed by exactly
 * three digits is grouping, not decimals ("1.234" is €1,234 — no price has three decimals).
 * Returns null for blank, negative, malformed or absurd (> €10,000,000) input, so callers can reject the row
 * instead of storing a wrong price.
 */
export const MAX_IMPORT_EURO_CENTS = 1_000_000_000;

export function parseEuroAmountToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    const cents = Math.round(raw * 100);
    return cents <= MAX_IMPORT_EURO_CENTS ? cents : null;
  }
  const s = raw.replace(/[\s  '€]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let intPart: string;
  let frac = "";
  if (dots && commas) {
    // Both present: the last one is the decimal separator, the other one groups thousands.
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const grp = dec === "." ? "," : ".";
    const [i, f, ...rest] = s.split(dec);
    if (rest.length || f === undefined || !/^\d{1,2}$/.test(f)) return null;
    if (!isGrouped(i, grp)) return null;
    intPart = i.split(grp).join("");
    frac = f;
  } else if (dots || commas) {
    const sep = dots ? "." : ",";
    const parts = s.split(sep);
    if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) {
      intPart = parts[0];
      frac = parts[1];
    } else if (isGrouped(s, sep)) {
      intPart = parts.join("");
    } else return null;
  } else intPart = s;
  if (!/^\d+$/.test(intPart)) return null;
  const cents = Number(intPart) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= MAX_IMPORT_EURO_CENTS ? cents : null;
}

/** "1.234.567" with "." -> true; every group after the first has exactly three digits. */
function isGrouped(s: string, sep: string): boolean {
  const g = s.split(sep);
  if (g.length === 1) return /^\d+$/.test(s);
  return /^\d{1,3}$/.test(g[0]) && g.slice(1).every((x) => /^\d{3}$/.test(x));
}
