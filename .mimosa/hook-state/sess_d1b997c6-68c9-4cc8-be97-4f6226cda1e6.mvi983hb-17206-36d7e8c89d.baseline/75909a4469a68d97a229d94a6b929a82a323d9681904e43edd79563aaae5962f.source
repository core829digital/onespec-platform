// The lead model shared by the browser (preview of an import, before anything is sent) and the server (which repeats every check).
// A list of leads that comes from a spreadsheet is messy: a field that is wrong is dropped and reported as a warning, a row with no way to
// identify a person or a company is refused, and anything that looks like markup is refused outright (never silently "cleaned").

import { checkEmail, checkPhone, checkPostalCode, checkVatId, checkWebsite, cleanText, isCountryCode, type CountryCode } from "./validation";

/** The fields an imported column can be mapped to ("firstName" + "lastName" are joined into the name). */
export const LEAD_FIELDS = [
  "name", "firstName", "lastName", "company", "email", "phone", "phone2", "vatNumber", "fiscalCode", "address", "city", "postalCode",
  "province", "country", "website", "notes", "tags", "source",
] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

/** What an import row looks like when it reaches normalisation: field → raw cell text, plus the columns kept as "other data". */
export type RawLeadRow = Partial<Record<LeadField, string>> & { extra?: Record<string, string> };

export interface LeadData {
  name: string;
  contactName?: string;
  company?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  vatNumber?: string;
  fiscalCode?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  website?: string;
  notes?: string;
  tags: string[];
  source?: string;
  extra?: Record<string, string>;
}

export type LeadWarning = { field: LeadField; code: string };
export type LeadRowCheck = { ok: true; lead: LeadData; warnings: LeadWarning[] } | { ok: false; code: LeadRowError };
export type LeadRowError = "EMPTY_ROW" | "NO_IDENTITY" | "INVALID_CHARS" | "TOO_MANY_EXTRA";

export const MAX_EXTRA_FIELDS = 20;
export const MAX_TAGS = 10;
const MARKUP = /[<>`{}\\|^~]/;
// Spreadsheet formula starters: a cell that begins with one would run as a formula if the data is ever exported back to a spreadsheet.
const FORMULA_START = /^[=@]|^[+-](?![\d\s().-]*$)/;

/** Text from a cell: Unicode-normalised, invisible characters gone, single spaces, formula starters neutralised, capped. */
export function cellText(raw: unknown, max: number): string {
  let s = cleanText(typeof raw === "number" ? String(raw) : raw);
  if (FORMULA_START.test(s)) s = s.replace(/^[=@+-]+\s*/, "");
  return s.length > max ? s.slice(0, max).trim() : s;
}

const COUNTRY_NAMES: Record<string, CountryCode> = {
  italia: "IT", italy: "IT", italie: "IT", italien: "IT", italië: "IT", it: "IT",
  francia: "FR", france: "FR", frankreich: "FR", frankrijk: "FR", franta: "FR", franța: "FR", fr: "FR",
  belgio: "BE", belgium: "BE", belgique: "BE", belgien: "BE", belgië: "BE", belgia: "BE", be: "BE",
  olanda: "NL", paesibassi: "NL", "paesi bassi": "NL", netherlands: "NL", "pays-bas": "NL", niederlande: "NL", nederland: "NL", "tarile de jos": "NL", nl: "NL",
  germania: "DE", germany: "DE", allemagne: "DE", deutschland: "DE", duitsland: "DE", de: "DE",
  austria: "AT", autriche: "AT", österreich: "AT", oostenrijk: "AT", at: "AT",
  lussemburgo: "LU", luxembourg: "LU", luxemburg: "LU", lu: "LU",
  "san marino": "SM", sm: "SM", monaco: "MC", mc: "MC", vaticano: "VA", va: "VA",
};

/** "Italia", "Italy", "it" → "IT"; anything not recognised → null (the default country applies). */
export function countryFromText(raw: unknown): CountryCode | null {
  const k = cellText(raw, 40).toLowerCase();
  if (!k) return null;
  const hit = COUNTRY_NAMES[k] ?? (isCountryCode(k.toUpperCase()) ? (k.toUpperCase() as CountryCode) : null);
  return hit ?? null;
}

/** Italian codice fiscale (16 characters, or the 11 digits of a company's) — format only, no registry lookup. */
export function checkFiscalCode(raw: unknown): { ok: true; value: string } | { ok: false } {
  const s = cellText(raw, 40).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s === "") return { ok: true, value: "" };
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(s) || /^\d{11}$/.test(s) ? { ok: true, value: s } : { ok: false };
}

function splitTags(raw: unknown): string[] {
  const text = typeof raw === "string" ? raw : "";
  const out: string[] = [];
  for (const piece of text.split(/[,;|/]/)) {
    const t = cellText(piece, 40);
    if (t && !MARKUP.test(t) && !out.includes(t.toLowerCase())) out.push(t.toLowerCase());
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Cleans one imported row into a lead, or refuses it. `defaultCountry` is the workspace's country (used for phones, postal codes, VAT). */
export function normalizeLeadRow(raw: RawLeadRow, defaultCountry: CountryCode): LeadRowCheck {
  const warnings: LeadWarning[] = [];
  const get = (f: LeadField, max: number) => cellText(raw[f], max);

  const first = get("firstName", 80);
  const last = get("lastName", 80);
  const fullName = get("name", 120) || [first, last].filter(Boolean).join(" ");
  const company = get("company", 120);
  const emailRaw = get("email", 320);
  const phoneRaw = get("phone", 40);
  const textFields: Array<[LeadField, string]> = [["name", fullName], ["company", company], ["address", get("address", 200)], ["city", get("city", 80)], ["notes", cellText(raw.notes, 2000)], ["source", get("source", 80)]];

  const hasAnything = LEAD_FIELDS.some((f) => get(f, 2000) !== "") || Object.values(raw.extra ?? {}).some((x) => cellText(x, 300) !== "");
  if (!hasAnything) return { ok: false, code: "EMPTY_ROW" };
  // Markup in a name or address is never a real value: the row is refused (not "cleaned"), so a pasted payload cannot sneak in.
  for (const [, value] of textFields) if (MARKUP.test(value)) return { ok: false, code: "INVALID_CHARS" };
  const extraEntries = Object.entries(raw.extra ?? {});
  if (extraEntries.length > MAX_EXTRA_FIELDS) return { ok: false, code: "TOO_MANY_EXTRA" };

  const country = countryFromText(raw.country) ?? defaultCountry;
  const lead: LeadData = { name: "", tags: splitTags(raw.tags) };

  if (emailRaw) {
    const e = checkEmail(emailRaw, false);
    if (e.ok && e.value) lead.email = e.value;
    else warnings.push({ field: "email", code: "EMAIL_FORMAT" });
  }
  for (const [field, text] of [["phone", phoneRaw], ["phone2", get("phone2", 40)]] as const) {
    if (!text) continue;
    const p = checkPhone(country, text);
    if (p.ok) lead[field] = p.value;
    else warnings.push({ field, code: "PHONE_FORMAT" });
  }
  const vatRaw = get("vatNumber", 40);
  if (vatRaw) {
    const vat = checkVatId(country, vatRaw);
    if (vat.ok && vat.value) lead.vatNumber = vat.value;
    else warnings.push({ field: "vatNumber", code: vat.ok ? "VAT_FORMAT" : vat.code });
  }
  const cf = checkFiscalCode(raw.fiscalCode);
  if (cf.ok && cf.value) lead.fiscalCode = cf.value;
  else if (!cf.ok) warnings.push({ field: "fiscalCode", code: "FISCAL_FORMAT" });
  const postal = get("postalCode", 20);
  if (postal) {
    const pc = checkPostalCode(country, postal);
    if (pc.ok) lead.postalCode = pc.value;
    else warnings.push({ field: "postalCode", code: "POSTAL_FORMAT" });
  }
  const province = get("province", 40).toUpperCase();
  if (province) {
    if (/^[A-Z]{2}$/.test(province)) lead.province = province;
    else warnings.push({ field: "province", code: "PROVINCE_FORMAT" });
  }
  const site = get("website", 300);
  if (site) {
    const w = checkWebsite(site, false);
    if (w.ok && w.value) lead.website = w.value;
    else warnings.push({ field: "website", code: "URL_FORMAT" });
  }

  if (company) lead.company = company;
  if (fullName) lead.contactName = fullName;
  const address = get("address", 200);
  if (address) lead.address = address;
  const city = get("city", 80);
  if (city) lead.city = city;
  const notes = cellText(raw.notes, 2000);
  if (notes) lead.notes = notes;
  const source = get("source", 80);
  if (source) lead.source = source;
  lead.country = country;

  // The list shows one name: the company when there is one, else the person, else the e-mail or phone.
  lead.name = company || fullName || lead.email || lead.phone || lead.phone2 || "";
  if (!lead.name) return { ok: false, code: "NO_IDENTITY" };
  if (lead.contactName === lead.name) delete lead.contactName;

  if (extraEntries.length > 0) {
    const extra: Record<string, string> = {};
    for (const [k, v] of extraEntries) {
      const key = cellText(k, 40);
      const val = cellText(v, 300);
      if (key && val && !MARKUP.test(key) && !MARKUP.test(val) && /^[\p{L}\p{N} _.\-/()]+$/u.test(key)) extra[key] = val;
    }
    if (Object.keys(extra).length > 0) lead.extra = extra;
  }
  return { ok: true, lead, warnings };
}

/** Key that two leads share when they are the same contact: the e-mail, else the phone — compared after normalisation. */
export function leadDedupeKeys(lead: Pick<LeadData, "email" | "phone" | "phone2">): string[] {
  const keys: string[] = [];
  if (lead.email) keys.push(`e:${lead.email}`);
  for (const p of [lead.phone, lead.phone2]) if (p) keys.push(`p:${p}`);
  return keys;
}

/** The text a search matches against (lower case, one line): name, company, contact, e-mail, phone, city. */
export function leadSearchText(lead: Pick<LeadData, "name" | "company" | "contactName" | "email" | "phone" | "city" | "vatNumber">): string {
  return [lead.name, lead.company, lead.contactName, lead.email, lead.phone, lead.city, lead.vatNumber].filter(Boolean).join(" ").toLowerCase().slice(0, 600);
}
