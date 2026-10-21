// VAT treatment of a supply: when the rate is the national one and when it is 0%.
//
//  * Same country as the installer                      -> the national rate (domestic).
//  * Business customer in ANOTHER EU country whose VAT number is ACTIVE IN VIES -> 0%, intra-Community supply
//    (Directive 2006/112/EC art. 138): the customer accounts for the VAT in their own country (reverse charge).
//    Without a successful VIES check the 0% is NOT allowed: the supply stays taxable in the installer's country.
//  * Customer outside the EU (including San Marino and the Vatican) -> 0%, export (art. 146), with proof of export.
//  * Anything else at 0% is a manual exemption the installer must justify in writing.
//
// This is general information built into the calculator, not tax advice: the installer's accountant has the last word.

import { checkVatId, compactVat, isCountryCode, type CountryCode } from "./validation";

export const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;
export type EuCountry = (typeof EU_COUNTRIES)[number];

/** Countries a customer can be from in the quote form: the EU plus the ones next door that matter for the platform. */
export const CUSTOMER_COUNTRIES = [
  ...EU_COUNTRIES,
  "MC", "SM", "VA", "CH", "GB", "LI", "AL", "BA", "ME", "MK", "RS", "XK", "MD", "UA", "TR", "US", "OTHER",
] as const;
export type CustomerCountry = (typeof CUSTOMER_COUNTRIES)[number];

export const isEuCountry = (cc: string | undefined | null): cc is EuCountry => !!cc && (EU_COUNTRIES as readonly string[]).includes(cc);

/** The VAT territory a country belongs to: Monaco is inside the French one. */
export const vatTerritory = (cc: string): string => (cc === "MC" ? "FR" : cc);

/** The prefix VIES uses (Greece is "EL"). */
export const viesPrefix = (cc: string): string => (vatTerritory(cc) === "GR" ? "EL" : vatTerritory(cc));

export type VatKind = "domestic" | "intraEu" | "intraEuUnverified" | "export";

export interface VatDecision {
  kind: VatKind;
  /** 0% may be applied. */
  zeroAllowed: boolean;
  /** 0% is what the law prescribes in this case: the rate is set to 0 and cannot be raised. */
  zeroForced: boolean;
  /** A successful VIES check is still needed before 0% can apply. */
  needsVies: boolean;
}

export interface VatDecisionInput {
  sellerCountry: string | undefined;
  buyerCountry: string | undefined;
  /** A taxable person (company / professional); a private individual is never an intra-Community B2B customer. */
  buyerIsBusiness: boolean;
  /** The buyer's VAT number was found ACTIVE in VIES (see `viesChecks`). */
  viesValid: boolean;
}

export function decideVat(i: VatDecisionInput): VatDecision {
  const seller = i.sellerCountry ? vatTerritory(i.sellerCountry) : undefined;
  const buyer = i.buyerCountry && i.buyerCountry !== "OTHER" ? vatTerritory(i.buyerCountry) : i.buyerCountry;
  if (!buyer || !seller || buyer === seller) return { kind: "domestic", zeroAllowed: false, zeroForced: false, needsVies: false };
  if (isEuCountry(buyer)) {
    if (!i.buyerIsBusiness) return { kind: "domestic", zeroAllowed: false, zeroForced: false, needsVies: false };
    if (i.viesValid) return { kind: "intraEu", zeroAllowed: true, zeroForced: true, needsVies: false };
    return { kind: "intraEuUnverified", zeroAllowed: false, zeroForced: false, needsVies: true };
  }
  return { kind: "export", zeroAllowed: true, zeroForced: true, needsVies: false };
}

/** Why a quote carries the VAT it carries (stored on the quote, printed on the documents). */
export type VatReason = "domestic" | "intraEu" | "export" | "manualZero";

export function vatReasonFor(decision: VatDecision, ratePercent: number): VatReason {
  if (decision.kind === "intraEu") return "intraEu";
  if (decision.kind === "export") return "export";
  return ratePercent === 0 ? "manualZero" : "domestic";
}

/**
 * The rate the server applies. `requestedPercent` is what the installer chose; `manualZero` is their explicit "0%, exempt operation".
 * Returns an error code instead of silently overriding a 0% that the rules do not allow.
 */
export function effectiveVatRate(
  decision: VatDecision,
  requestedPercent: number,
  manualZero: { requested: boolean; reason: string },
): { ok: true; percent: number } | { ok: false; code: "VAT_ZERO_NOT_ALLOWED" | "VAT_MANUAL_REASON_REQUIRED" } {
  if (decision.zeroForced) return { ok: true, percent: 0 };
  if (requestedPercent > 0 && !manualZero.requested) return { ok: true, percent: requestedPercent };
  // Zero without a legal basis: only the explicit, justified manual exemption, and never while a VIES check is still owed.
  if (decision.needsVies) return { ok: false, code: "VAT_ZERO_NOT_ALLOWED" };
  return manualZero.requested && manualZero.reason.trim().length >= 5 ? { ok: true, percent: 0 } : { ok: false, code: "VAT_MANUAL_REASON_REQUIRED" };
}

/** A customer VAT number: for the platform's own countries the full country check, for the others a generic shape check. */
export function checkCustomerVat(country: string, raw: unknown): { ok: true; value: string; prefix: string; number: string } | { ok: false; code: "VAT_FORMAT" | "VAT_CHECKSUM" | "VAT_PREFIX" | "REQUIRED" | "COUNTRY_UNSUPPORTED" } {
  if (isCountryCode(country)) {
    const r = checkVatId(country as CountryCode, raw);
    if (!r.ok) return { ok: false, code: r.code === "VAT_FORMAT" || r.code === "VAT_CHECKSUM" || r.code === "VAT_PREFIX" || r.code === "REQUIRED" ? r.code : "VAT_FORMAT" };
    return { ok: true, value: r.value, prefix: r.value.slice(0, 2), number: r.value.slice(2) };
  }
  if (!isEuCountry(country)) return { ok: false, code: "COUNTRY_UNSUPPORTED" };
  const prefix = viesPrefix(country);
  let s = compactVat(raw);
  if (s === "") return { ok: false, code: "REQUIRED" };
  if (/^[A-Z]{2}/.test(s) && s.startsWith(prefix)) s = s.slice(2);
  else if (/^[A-Z]{2}\d/.test(s)) return { ok: false, code: "VAT_PREFIX" };
  if (!/^[A-Z0-9]{2,14}$/.test(s)) return { ok: false, code: "VAT_FORMAT" };
  return { ok: true, value: prefix + s, prefix, number: s };
}

type Lang = "it" | "en" | "fr" | "de" | "nl" | "ro";

/** The sentence printed on quotes and invoices for a VAT-free supply ("" for a normal one). {vat} = the customer's VAT number. */
export const VAT_NOTES: Record<Exclude<VatReason, "domestic">, Record<Lang, string>> = {
  intraEu: {
    it: "Operazione non imponibile: cessione intracomunitaria (art. 138 Direttiva 2006/112/CE). IVA a carico del cessionario (inversione contabile). Partita IVA del cliente: {vat}, verificata nel sistema VIES.",
    en: "VAT-exempt intra-Community supply (Art. 138, Directive 2006/112/EC). VAT to be accounted for by the customer (reverse charge). Customer VAT number: {vat}, verified in VIES.",
    fr: "Livraison intracommunautaire exonérée de TVA (art. 138, directive 2006/112/CE). TVA due par le preneur (autoliquidation). N° de TVA du client : {vat}, vérifié dans VIES.",
    de: "Steuerfreie innergemeinschaftliche Lieferung (Art. 138 Richtlinie 2006/112/EG). Die Steuer schuldet der Leistungsempfänger (Reverse Charge). USt-IdNr. des Kunden: {vat}, im VIES geprüft.",
    nl: "Van btw vrijgestelde intracommunautaire levering (art. 138 Richtlijn 2006/112/EG). Btw te verleggen naar de afnemer. Btw-nummer klant: {vat}, gecontroleerd in VIES.",
    ro: "Livrare intracomunitară scutită de TVA (art. 138 Directiva 2006/112/CE). TVA datorată de client (taxare inversă). Cod TVA client: {vat}, verificat în VIES.",
  },
  export: {
    it: "Operazione non imponibile: esportazione verso un paese terzo (art. 146 Direttiva 2006/112/CE). Si conserva la prova dell'uscita dei beni dall'Unione.",
    en: "VAT-exempt export to a third country (Art. 146, Directive 2006/112/EC). Proof of the goods leaving the Union is kept.",
    fr: "Exportation exonérée de TVA vers un pays tiers (art. 146, directive 2006/112/CE). La preuve de sortie des biens de l'Union est conservée.",
    de: "Steuerfreie Ausfuhrlieferung in ein Drittland (Art. 146 Richtlinie 2006/112/EG). Der Ausfuhrnachweis wird aufbewahrt.",
    nl: "Van btw vrijgestelde uitvoer naar een derde land (art. 146 Richtlijn 2006/112/EG). Het bewijs van uitvoer uit de Unie wordt bewaard.",
    ro: "Export scutit de TVA către o țară terță (art. 146 Directiva 2006/112/CE). Dovada ieșirii bunurilor din Uniune este păstrată.",
  },
  manualZero: {
    it: "Operazione con IVA allo 0%: {reason}",
    en: "Operation at 0% VAT: {reason}",
    fr: "Opération à 0 % de TVA : {reason}",
    de: "Vorgang mit 0 % MwSt.: {reason}",
    nl: "Handeling tegen 0% btw: {reason}",
    ro: "Operațiune cu TVA 0%: {reason}",
  },
};

export function vatNote(reason: VatReason | undefined, locale: string, vars: { vat?: string; reason?: string } = {}): string {
  if (!reason || reason === "domestic") return "";
  const lang = (["it", "en", "fr", "de", "nl", "ro"] as const).find((l) => l === locale) ?? "en";
  return VAT_NOTES[reason][lang].replace("{vat}", vars.vat ?? "").replace("{reason}", vars.reason ?? "").trim();
}
