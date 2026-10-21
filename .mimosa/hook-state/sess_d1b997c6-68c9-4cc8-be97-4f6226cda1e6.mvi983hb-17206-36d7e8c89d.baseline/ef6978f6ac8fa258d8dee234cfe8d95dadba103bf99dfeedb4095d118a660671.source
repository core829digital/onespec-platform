/**
 * Keeps a string inside what the built-in PDF fonts can draw.
 *
 * Helvetica and Courier only cover Windows-1252: anything else (Romanian ș ț ă, Polish ł, the narrow no-break space
 * fr-FR number formatting uses, emoji) prints as garbage. Text that reaches a PDF at runtime (customer names,
 * addresses, notes, translations) goes through here: accents outside the range drop their mark (ș → s), a few
 * symbols get an ASCII stand-in, other letters become "?" and the remaining symbols and emoji are left out.
 */

const WIN1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const STAND_IN: Record<string, string> = {
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ħ: "h",
  Ħ: "H",
  ı: "i",
  ŀ: "l",
  Ŀ: "L",
  ŧ: "t",
  Ŧ: "T",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "−": "-",
  "′": "'",
  "″": '"',
  "←": "<-",
  "→": "->",
  "↔": "<->",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "…": "…",
  // Spaces Intl.NumberFormat and word processors insert (fr-FR groups thousands with U+202F).
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
};

const COMBINING_MARK = /[̀-ͯ]/g;

const drawable = (c: string) => c.codePointAt(0)! <= 0xff || WIN1252_EXTRA.has(c);

function toDrawable(c: string): string {
  if (drawable(c)) return c;
  const standIn = STAND_IN[c];
  if (standIn !== undefined) return standIn;
  const base = c.normalize("NFD").replace(COMBINING_MARK, "");
  if (base && [...base].every(drawable)) return base;
  return /\p{L}/u.test(c) ? "?" : "";
}

export function toPdfText(s: string): string {
  let out = "";
  for (const c of s.normalize("NFC")) out += toDrawable(c);
  return out;
}
