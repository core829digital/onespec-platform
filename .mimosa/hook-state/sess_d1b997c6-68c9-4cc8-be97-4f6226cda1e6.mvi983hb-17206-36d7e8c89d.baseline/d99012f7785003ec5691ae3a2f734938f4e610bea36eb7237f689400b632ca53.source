// Input validation and sanitisation shared by the browser and the server (the server always repeats the check).
// Rules: what is merely untidy (spaces, dots, lower case, a national "0") is normalised silently; what can never be right
// (a wrong check digit, a letter in a postal code, markup characters) is refused with a code the UI translates.

export const SUPPORTED_COUNTRIES = ["IT", "SM", "VA", "FR", "MC", "BE", "NL", "DE", "AT", "LU"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export const isCountryCode = (v: unknown): v is CountryCode => typeof v === "string" && (SUPPORTED_COUNTRIES as readonly string[]).includes(v);

export type Check<T> = { ok: true; value: T } | { ok: false; code: ValidationCode };

export type ValidationCode =
  | "REQUIRED"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARS"
  | "VAT_FORMAT"
  | "VAT_CHECKSUM"
  | "VAT_PREFIX"
  | "POSTAL_FORMAT"
  | "PHONE_FORMAT"
  | "EMAIL_FORMAT"
  | "URL_FORMAT"
  | "COUNTRY_UNSUPPORTED"
  | "BIRTHDATE_FORMAT"
  | "UNDERAGE"
  | "PASSWORD_WEAK"
  | "PASSWORD_TOO_LONG"
  | "DPA_REQUIRED"
  | "TERMS_REQUIRED";

const ok = <T,>(value: T): Check<T> => ({ ok: true, value });
const fail = (code: ValidationCode): Check<never> => ({ ok: false, code });

// ---------------------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------------------

// Control characters, zero-width and bidi override characters: never part of a name.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;
// Markup and scripting characters: refused, not silently stripped.
const MARKUP = /[<>`{}\\|^~]/;

/** Unicode-normalised text without invisible characters, single spaces, trimmed. Newlines survive only when `multiline`. */
export function cleanText(raw: unknown, multiline = false): string {
  if (typeof raw !== "string") return "";
  let s = raw.normalize("NFC");
  if (multiline) s = s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, "");
  else s = s.replace(INVISIBLE, " ");
  s = multiline ? s.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n") : s.replace(/\s+/g, " ");
  return s.trim();
}

interface TextRules {
  min?: number;
  max: number;
  required?: boolean;
  multiline?: boolean;
  /** Characters allowed (after cleaning). */
  allowed?: RegExp;
}

export function checkText(raw: unknown, rules: TextRules): Check<string> {
  const s = cleanText(raw, rules.multiline);
  if (s === "") return rules.required === false ? ok("") : fail("REQUIRED");
  if (MARKUP.test(s)) return fail("INVALID_CHARS");
  if (rules.allowed && !rules.allowed.test(s)) return fail("INVALID_CHARS");
  if (s.length < (rules.min ?? 1)) return fail("TOO_SHORT");
  if (s.length > rules.max) return fail("TOO_LONG");
  return ok(s);
}

const NAME_CHARS = /^[\p{L}\p{N} .,&'’\-/()+@!:;*#°]+$/u;
const PLACE_CHARS = /^[\p{L} .'’\-/()]+$/u;
const STREET_CHARS = /^[\p{L}\p{N} .,'’\-/()°#]+$/u;

/** Company / legal name: 2-120 characters, letters, digits and the usual punctuation. */
export const checkCompanyName = (raw: unknown) => checkText(raw, { min: 2, max: 120, allowed: NAME_CHARS });
/** Person name: 2-80 characters. */
export const checkPersonName = (raw: unknown) => checkText(raw, { min: 2, max: 80, allowed: NAME_CHARS });
/** Street and number: 4-120 characters, must contain a letter. */
export function checkStreet(raw: unknown): Check<string> {
  const r = checkText(raw, { min: 4, max: 120, allowed: STREET_CHARS });
  if (r.ok && !/\p{L}/u.test(r.value)) return fail("INVALID_CHARS");
  return r;
}
/** Town: 2-60 letters. */
export const checkCity = (raw: unknown) => checkText(raw, { min: 2, max: 60, allowed: PLACE_CHARS });

// ---------------------------------------------------------------------------------------------------------------------
// VAT identification numbers
// ---------------------------------------------------------------------------------------------------------------------

export interface VatRule {
  /** Prefix printed before the number. */
  prefix: string;
  /** Characters that follow the prefix, as the platform stores them. */
  body: RegExp;
  /** Number of characters after the prefix (for the input mask). */
  length: number;
  /** A valid example, shown as a placeholder. */
  example: string;
  /** The country has no VAT number of its own: the field is optional. */
  optional?: boolean;
}

export const VAT_RULES: Record<CountryCode, VatRule> = {
  IT: { prefix: "IT", body: /^\d{11}$/, length: 11, example: "IT00905811006" },
  SM: { prefix: "SM", body: /^\d{5}$/, length: 5, example: "SM12345" },
  VA: { prefix: "IT", body: /^\d{11}$/, length: 11, example: "IT00905811006", optional: true },
  FR: { prefix: "FR", body: /^[0-9A-HJ-NP-Z]{2}\d{9}$/, length: 11, example: "FR40303265045" },
  MC: { prefix: "FR", body: /^[0-9A-HJ-NP-Z]{2}\d{9}$/, length: 11, example: "FR40303265045" },
  BE: { prefix: "BE", body: /^[01]\d{9}$/, length: 10, example: "BE0403019261" },
  NL: { prefix: "NL", body: /^\d{9}B(?!00)\d{2}$/, length: 12, example: "NL820646660B01" },
  DE: { prefix: "DE", body: /^[1-9]\d{8}$/, length: 9, example: "DE136695976" },
  AT: { prefix: "AT", body: /^U\d{8}$/, length: 9, example: "ATU13585627" },
  LU: { prefix: "LU", body: /^\d{8}$/, length: 8, example: "LU15027442" },
};

const digits = (s: string) => s.split("").map(Number);

/** Italian partita IVA: 11 digits, Luhn-style check digit. */
function itChecksum(n: string): boolean {
  if (/^0{7}/.test(n)) return false;
  const d = digits(n);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let v = d[i];
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === d[10];
}

/** French SIREN (Luhn) + the two-character key (numeric keys are checked, the newer alphanumeric ones cannot be). */
function frChecksum(n: string): boolean {
  const key = n.slice(0, 2);
  const siren = n.slice(2);
  let sum = 0;
  const d = digits(siren).reverse();
  for (let i = 0; i < d.length; i++) {
    let v = d[i];
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  if (sum % 10 !== 0) return false;
  if (/^\d{2}$/.test(key)) return Number(key) === (12 + 3 * (Number(siren) % 97)) % 97;
  return true;
}

/** Belgian number: the last two digits are 97 - (the first eight mod 97). */
const beChecksum = (n: string) => Number(n.slice(8)) === 97 - (Number(n.slice(0, 8)) % 97);

/** German USt-IdNr: ISO 7064 MOD 11,10 on the first eight digits. */
function deChecksum(n: string): boolean {
  const d = digits(n);
  let product = 10;
  for (let i = 0; i < 8; i++) {
    let sum = (d[i] + product) % 10;
    if (sum === 0) sum = 10;
    product = (2 * sum) % 11;
  }
  let check = 11 - product;
  if (check === 10) check = 0;
  return check === d[8];
}

/** Austrian UID: ATU + 8 digits, weights 1,2 on the first seven digits (digit sums), check = (96 - sum) mod 10. */
function atChecksum(n: string): boolean {
  const d = digits(n.slice(1));
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const v = d[i] * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 10) + (v % 10);
  }
  return (96 - sum) % 10 === d[7];
}

/** Luxembourg: the last two digits are the first six mod 89. */
const luChecksum = (n: string) => Number(n.slice(6)) === Number(n.slice(0, 6)) % 89;

const CHECKSUM: Partial<Record<CountryCode, (body: string) => boolean>> = {
  IT: itChecksum,
  VA: itChecksum,
  FR: frChecksum,
  MC: frChecksum,
  BE: beChecksum,
  DE: deChecksum,
  AT: atChecksum,
  LU: luChecksum,
};

/** Letters and digits only, upper case: "it 00905.811.006" -> "IT00905811006". */
export const compactVat = (raw: unknown): string => (typeof raw === "string" ? raw.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "") : "");

/**
 * Validates a VAT number for a country. The prefix may be typed or left out; a wrong prefix is refused.
 * On success `value` is the number as stored, prefix included ("IT00905811006").
 */
export function checkVatId(country: unknown, raw: unknown): Check<string> {
  if (!isCountryCode(country)) return fail("COUNTRY_UNSUPPORTED");
  const rule = VAT_RULES[country];
  let s = compactVat(raw);
  if (s === "") return rule.optional ? ok("") : fail("REQUIRED");
  if (s.length === rule.prefix.length + rule.length) {
    // Typed with the prefix: it must be this country's.
    if (!s.startsWith(rule.prefix)) return fail("VAT_PREFIX");
    s = s.slice(rule.prefix.length);
  } else if (s.length !== rule.length) {
    // Wrong length: tell a foreign prefix from a plain format error. French keys may legitimately start with two letters.
    const foreign = /^[A-Z]{2}/.test(s) && !s.startsWith(rule.prefix) && !(rule.prefix === "FR") && !(country === "AT" && s.startsWith("U"));
    return fail(foreign ? "VAT_PREFIX" : "VAT_FORMAT");
  }
  if (!rule.body.test(s)) return fail("VAT_FORMAT");
  const checksum = CHECKSUM[country];
  if (checksum && !checksum(s)) return fail("VAT_CHECKSUM");
  return ok(rule.prefix + s);
}

/** Splits a stored VAT number into the pieces VIES wants: ISO country (EL for Greece) and the number without prefix. */
export function splitVat(stored: string): { prefix: string; number: string } {
  const prefix = stored.slice(0, 2);
  return { prefix, number: stored.slice(2) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Postal codes, phone, e-mail, web address
// ---------------------------------------------------------------------------------------------------------------------

export const POSTAL_RULES: Record<CountryCode, { pattern: RegExp; example: string; length: number }> = {
  IT: { pattern: /^\d{5}$/, example: "20121", length: 5 },
  SM: { pattern: /^4789\d$/, example: "47890", length: 5 },
  VA: { pattern: /^00120$/, example: "00120", length: 5 },
  FR: { pattern: /^(0[1-9]|[1-8]\d|9[0-5])\d{3}$/, example: "75001", length: 5 },
  MC: { pattern: /^980\d{2}$/, example: "98000", length: 5 },
  BE: { pattern: /^[1-9]\d{3}$/, example: "1000", length: 4 },
  NL: { pattern: /^[1-9]\d{3} (?!SA|SD|SS)[A-Z]{2}$/, example: "1011 AB", length: 7 },
  DE: { pattern: /^\d{5}$/, example: "10115", length: 5 },
  AT: { pattern: /^[1-9]\d{3}$/, example: "1010", length: 4 },
  LU: { pattern: /^\d{4}$/, example: "1009", length: 4 },
};

export function checkPostalCode(country: unknown, raw: unknown): Check<string> {
  if (!isCountryCode(country)) return fail("COUNTRY_UNSUPPORTED");
  let s = cleanText(raw).toUpperCase();
  if (s === "") return fail("REQUIRED");
  if (country === "LU") s = s.replace(/^L[- ]?/, "");
  if (country === "NL") s = s.replace(/^(\d{4})\s*([A-Z]{2})$/, "$1 $2");
  return POSTAL_RULES[country].pattern.test(s) ? ok(s) : fail("POSTAL_FORMAT");
}

const DIAL: Record<CountryCode, string> = { IT: "39", SM: "378", VA: "379", FR: "33", MC: "377", BE: "32", NL: "31", DE: "49", AT: "43", LU: "352" };
/** Digits allowed after the dial code (national significant number), by country. */
const NATIONAL_LENGTH: Record<CountryCode, [number, number]> = {
  IT: [6, 12], SM: [6, 10], VA: [6, 10], FR: [9, 9], MC: [8, 9], BE: [8, 9], NL: [9, 9], DE: [6, 13], AT: [6, 13], LU: [6, 11],
};

/** "+39 333 123 4567", "0039 333...", or a national number: E.164 without spaces ("+393331234567"). */
export function checkPhone(country: unknown, raw: unknown): Check<string> {
  if (!isCountryCode(country)) return fail("COUNTRY_UNSUPPORTED");
  const text = cleanText(raw);
  if (text === "") return fail("REQUIRED");
  if (/[^\d\s+().\-/]/.test(text)) return fail("PHONE_FORMAT");
  let s = text.replace(/[\s().\-/]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.includes("+") && !/^\+\d+$/.test(s)) return fail("PHONE_FORMAT");
  if (!s.startsWith("+")) {
    // National number: Italian numbers keep their leading 0, the others lose the trunk 0.
    if (country !== "IT" && country !== "SM" && country !== "VA" && s.startsWith("0")) s = s.slice(1);
    s = `+${DIAL[country]}${s}`;
  }
  const digitsOnly = s.slice(1);
  if (digitsOnly.length < 8 || digitsOnly.length > 15 || digitsOnly.startsWith("0")) return fail("PHONE_FORMAT");
  // A number of one of the supported countries must also have a plausible length (the longest matching dial code wins).
  const best = SUPPORTED_COUNTRIES.filter((c) => c !== "VA" && digitsOnly.startsWith(DIAL[c])).sort((x, y) => DIAL[y].length - DIAL[x].length)[0];
  if (best) {
    const national = digitsOnly.length - DIAL[best].length;
    const [min, max] = NATIONAL_LENGTH[best];
    if (national < min || national > max) return fail("PHONE_FORMAT");
  }
  return ok(s);
}

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;

export function checkEmail(raw: unknown, required = true): Check<string> {
  const s = cleanText(raw).toLowerCase();
  if (s === "") return required ? fail("REQUIRED") : ok("");
  if (s.length > 254) return fail("TOO_LONG");
  const [local] = s.split("@");
  if (!EMAIL.test(s) || local.length > 64 || s.includes("..") || local.startsWith(".") || local.endsWith(".")) return fail("EMAIL_FORMAT");
  return ok(s);
}

/** Web address: https only, a real host, no credentials; "example.com" is accepted and becomes "https://example.com". */
export function checkWebsite(raw: unknown, required = false): Check<string> {
  let s = cleanText(raw);
  if (s === "") return required ? fail("REQUIRED") : ok("");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  if (s.length > 2048) return fail("TOO_LONG");
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return fail("URL_FORMAT");
  }
  if (url.protocol !== "https:" || url.username || url.password || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return fail("URL_FORMAT");
  return ok(url.origin + (url.pathname === "/" ? "" : url.pathname) + url.search);
}

// ---------------------------------------------------------------------------------------------------------------------
// Input masks (what the user may still type)
// ---------------------------------------------------------------------------------------------------------------------

/** Longest VAT input for a country: prefix + number. Anything beyond is not accepted by the field. */
export const vatMaxLength = (country: CountryCode) => VAT_RULES[country].prefix.length + VAT_RULES[country].length;

/** Keeps only what a VAT field can hold: letters and digits, upper case, cut at the country's length. */
export function maskVat(country: CountryCode, raw: string): string {
  return compactVat(raw).slice(0, vatMaxLength(country));
}

/** Keeps only the characters of a postal code. */
export function maskPostal(country: CountryCode, raw: string): string {
  const allowed = country === "NL" ? /[^0-9A-Za-z ]/g : /[^0-9]/g;
  return raw.replace(allowed, "").toUpperCase().slice(0, POSTAL_RULES[country].length);
}

/** Keeps only the characters of a phone number. */
export const maskPhone = (raw: string): string => raw.replace(/[^\d\s+().\-/]/g, "").slice(0, 24);
