import { checkCompanyName, checkCity, checkEmail, checkPersonName, checkPostalCode, checkStreet, checkVatId, compactVat, isCountryCode, type Check, type CountryCode } from "./validation";
import { DPA_VERSION } from "./dpa";

/**
 * Registration rules, shared by the form (instant feedback) and the server (the only check that counts).
 *
 * Age: the platform is a professional (B2B) tool; a contract and the data-processing agreement can only be entered by a person with
 * legal capacity, so the minimum is 18. This is stricter than — and therefore also satisfies — the GDPR Art. 8 digital-consent
 * threshold (13–16 depending on the Member State: IT 14, FR 15, DE/NL/RO/BE-LU 16 or 13–16), which applies when consent is the legal
 * basis for a service offered to a child. No EU rule obliges every sign-up form to ask for the age; we ask for the date of birth
 * because we must be able to show that nobody under age is contracting.
 */
export const MIN_AGE = 18;
export const MAX_AGE = 110;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const ok = <T,>(value: T): Check<T> => ({ ok: true, value });
const fail = (code: Extract<Check<never>, { ok: false }>["code"]): Check<never> => ({ ok: false, code });

/** Whole years between an ISO date (YYYY-MM-DD) and `now`, or null when the date does not exist. */
export function ageOn(iso: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  const before = now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d);
  if (before) age -= 1;
  return age;
}

export function checkBirthDate(raw: unknown, now: Date = new Date()): Check<string> {
  if (typeof raw !== "string" || raw.trim() === "") return fail("REQUIRED");
  const s = raw.trim();
  const age = ageOn(s, now);
  if (age === null || age < 0 || age > MAX_AGE) return fail("BIRTHDATE_FORMAT");
  if (age < MIN_AGE) return fail("UNDERAGE");
  return ok(s);
}

/** Length, one letter and one digit; not the e-mail. Never trimmed or normalised: what the person typed is what is hashed. */
export function checkPassword(raw: unknown, email?: string): Check<string> {
  if (typeof raw !== "string" || raw === "") return fail("REQUIRED");
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fail("INVALID_CHARS");
  if (raw.length < PASSWORD_MIN) return fail("PASSWORD_WEAK");
  if (raw.length > PASSWORD_MAX) return fail("PASSWORD_TOO_LONG");
  if (!/\p{L}/u.test(raw) || !/\d/.test(raw)) return fail("PASSWORD_WEAK");
  if (email && raw.toLowerCase() === email.toLowerCase()) return fail("PASSWORD_WEAK");
  return ok(raw);
}

export interface SignupCompany {
  companyName: string;
  country: CountryCode;
  vatId?: string;
  street?: string;
  postalCode?: string;
  city?: string;
}

export interface SignupDpa {
  version: string;
  acceptedAt: number;
  signerName: string;
}

export interface SignupInput {
  name: string;
  email: string;
  birthDate: string;
  company?: SignupCompany;
  dpa?: SignupDpa;
}

type Raw = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const flag = (v: unknown) => v === true || v === "true";

/**
 * Validates everything the registration form sends. Returns the cleaned values or the first failing code (the form shows it
 * next to the field; the server throws it as VALIDATION_<CODE>).
 */
export function checkSignup(raw: Raw, now: Date = new Date()): { ok: true; value: SignupInput } | { ok: false; code: Extract<Check<never>, { ok: false }>["code"]; field: string } {
  const bad = (field: string, c: Check<unknown>) => ({ ok: false as const, field, code: (c as { code: Extract<Check<never>, { ok: false }>["code"] }).code });
  const name = checkPersonName(raw.name);
  if (!name.ok) return bad("name", name);
  const email = checkEmail(raw.email);
  if (!email.ok) return bad("email", email);
  const pw = checkPassword(raw.password, email.value);
  if (!pw.ok) return bad("password", pw);
  const birth = checkBirthDate(raw.birthDate, now);
  if (!birth.ok) return bad("birthDate", birth);
  if (!flag(raw.termsAccepted)) return { ok: false, field: "terms", code: "TERMS_REQUIRED" };

  const value: SignupInput = { name: name.value, email: email.value, birthDate: birth.value };

  if (text(raw.companyName).trim() !== "") {
    const country = text(raw.country).trim().toUpperCase();
    if (!isCountryCode(country)) return { ok: false, field: "country", code: "COUNTRY_UNSUPPORTED" };
    const cn = checkCompanyName(raw.companyName);
    if (!cn.ok) return bad("companyName", cn);
    const company: SignupCompany = { companyName: cn.value, country };
    if (text(raw.vatId).trim() !== "") {
      const vat = checkVatId(country, raw.vatId);
      if (!vat.ok) return bad("vatId", vat);
      company.vatId = vat.value || undefined;
    }
    const anyAddress = [raw.street, raw.postalCode, raw.city].some((x) => text(x).trim() !== "");
    if (anyAddress) {
      const street = checkStreet(raw.street);
      if (!street.ok) return bad("street", street);
      const postal = checkPostalCode(country, raw.postalCode);
      if (!postal.ok) return bad("postalCode", postal);
      const city = checkCity(raw.city);
      if (!city.ok) return bad("city", city);
      Object.assign(company, { street: street.value, postalCode: postal.value, city: city.value });
    }
    value.company = company;

    // The agreement is signed by whoever registers the company, and only once the data it needs exists.
    if (flag(raw.dpaAccepted)) {
      if (!company.vatId || !company.street) return { ok: false, field: "dpa", code: "DPA_REQUIRED" };
      value.dpa = { version: DPA_VERSION, acceptedAt: now.getTime(), signerName: name.value };
    }
  } else if (flag(raw.dpaAccepted)) {
    return { ok: false, field: "dpa", code: "DPA_REQUIRED" };
  }
  return { ok: true, value };
}

export { compactVat };
