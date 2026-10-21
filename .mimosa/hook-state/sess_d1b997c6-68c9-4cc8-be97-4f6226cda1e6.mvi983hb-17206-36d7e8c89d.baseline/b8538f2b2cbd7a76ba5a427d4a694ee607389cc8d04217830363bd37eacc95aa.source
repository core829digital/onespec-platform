export type DimensionParse = { ok: true; mm: number } | { ok: false; reason: "empty" | "number" | "range" };

/**
 * What a person typed into a dimension box, as whole millimetres. Accepts "1200", "1 200", "1.200" (thousands
 * grouping), "1200,4" and "1200.4" (decimals are rounded); refuses anything outside [min, max].
 */
export function parseDimensionInput(raw: string, min: number, max: number): DimensionParse {
  const text = raw.trim().replace(/\s*mm$/i, "");
  if (text === "") return { ok: false, reason: "empty" };
  // "1.200" / "1 200" / "12.000" are thousands groups, not decimals.
  const grouped = /^\d{1,3}([.\s]\d{3})+$/.test(text) ? text.replace(/[.\s]/g, "") : text;
  const n = Number(grouped.replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, reason: "number" };
  const mm = Math.round(n);
  if (mm < min || mm > max) return { ok: false, reason: "range" };
  return { ok: true, mm };
}
