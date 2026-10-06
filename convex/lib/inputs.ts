import { ConvexError } from "convex/values";

/**
 * Shared input guards for tenant-authored catalogue data. Convex validators
 * only check TYPES (`v.any()`, `v.string()`, `v.number()` accept anything of
 * that type), so the bounds live here. Every failure throws the same
 * INVALID_INPUT code the UI already maps to a friendly message.
 */
const LABEL_LANGS = ["it", "en", "fr", "de", "nl", "ro"] as const;
// Control characters (incl. NUL, newline, tab): never legitimate in a label or key.
const CONTROL = /[\u0000-\u001f\u007f]/;

function invalid(): never {
  throw new ConvexError("INVALID_INPUT");
}

/** Catalogue row key: 1–40 chars (same cap as the public submission schema), no control characters. */
export function assertKey(key: string): void {
  if (key.length < 1 || key.length > 40 || CONTROL.test(key)) invalid();
}

/** Free short text (group names, categories): ≤ max chars, no control characters. */
export function assertShortText(value: string | undefined, max = 60): void {
  if (value === undefined) return;
  if (value.length > max || CONTROL.test(value)) invalid();
}

const CONTROL_EXCEPT_LINEBREAK = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Multi-line free text (notes, recommendations): ≤ max chars, line breaks and tabs allowed, other control characters refused. */
export function assertLongText(value: string | undefined, max = 5000): void {
  if (value === undefined) return;
  if (value.length > max || CONTROL_EXCEPT_LINEBREAK.test(value)) invalid();
}

/**
 * Multilingual label object: a plain object with at most one entry per
 * supported language, each a non-control string of ≤ 200 chars.
 */
export function assertLabels(labels: unknown): void {
  if (labels === null || typeof labels !== "object" || Array.isArray(labels)) invalid();
  const entries = Object.entries(labels as Record<string, unknown>);
  if (entries.length > LABEL_LANGS.length) invalid();
  for (const [lang, text] of entries) {
    if (!(LABEL_LANGS as readonly string[]).includes(lang)) invalid();
    if (typeof text !== "string" || text.length > 200 || CONTROL.test(text)) invalid();
  }
}

/** Finite number within [min, max]. */
export function assertRange(n: number | undefined, min: number, max: number): void {
  if (n === undefined) return;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) invalid();
}

/** Money in cents: finite, 0 … 100 000 000 (1 000 000 €). */
export const assertCents = (n: number | undefined) => assertRange(n, 0, 100_000_000);
/** Price multiplier. */
export const assertMultiplier = (n: number | undefined) => assertRange(n, 0, 50);
/** Sort position. */
export const assertSortOrder = (n: number) => assertRange(n, -100_000, 100_000);
/** Thermal values (U / psi) — can be negative adjustments, never huge. */
export const assertThermal = (n: number | undefined) => assertRange(n, -10, 10);
/** Colour swatch: #rgb / #rrggbb / #rrggbbaa. */
export function assertHex(hex: string | undefined): void {
  if (hex === undefined) return;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) invalid();
}
