import { ConvexError } from "convex/values";
import { checkCompanyName, checkCity, checkEmail, checkPhone, checkPostalCode, checkStreet, checkVatId, checkWebsite, compactVat, isCountryCode, SUPPORTED_COUNTRIES, type CountryCode } from "../../src/shared/validation";
import { checkCustomerVat, isEuCountry } from "../../src/shared/tax";
import { must } from "./validate";

/** Company data of the installer, validated with the same rules as the forms (the server always repeats the check). */

export function companyName(raw: string): string {
  return must(checkCompanyName(raw));
}

/** Country of the installer: one of the markets the platform serves. */
export function supportedCountry(raw: string): CountryCode {
  const c = raw.trim().toUpperCase();
  if (!isCountryCode(c)) throw new ConvexError("VALIDATION_COUNTRY_UNSUPPORTED");
  return c;
}

/** The installer's own VAT number: full country check for the markets served, a shape check for any other EU country. */
export function companyVat(country: string | undefined, raw: string): string | undefined {
  const c = (country ?? "").toUpperCase();
  if (isCountryCode(c)) {
    const v = must(checkVatId(c, raw));
    return v === "" ? undefined : v;
  }
  if (raw.trim() === "") return undefined;
  if (isEuCountry(c)) {
    const r = checkCustomerVat(c, raw);
    if (!r.ok) throw new ConvexError(`VALIDATION_${r.code}`);
    return r.value;
  }
  const compact = compactVat(raw);
  if (compact.length < 3 || compact.length > 20) throw new ConvexError("VALIDATION_VAT_FORMAT");
  return compact;
}

export function companyAddress(country: CountryCode, raw: { street: string; postalCode: string; city: string }) {
  const street = must(checkStreet(raw.street));
  const postalCode = must(checkPostalCode(country, raw.postalCode));
  const city = must(checkCity(raw.city));
  return { street, postalCode, city, line: `${street}, ${postalCode} ${city}` };
}

export function companyContact(country: CountryCode, raw: { phone: string; email: string; website?: string }) {
  return {
    phone: must(checkPhone(country, raw.phone)),
    email: must(checkEmail(raw.email)),
    website: must(checkWebsite(raw.website ?? "")) || undefined,
  };
}

export { SUPPORTED_COUNTRIES };
