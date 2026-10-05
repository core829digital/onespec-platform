import { describe, expect, it } from "vitest";
import { checkCustomerVat, decideVat, effectiveVatRate, isEuCountry, vatNote, vatReasonFor, viesPrefix } from "@/shared/tax";

const base = { sellerCountry: "IT", buyerCountry: "IT", buyerIsBusiness: true, viesValid: false };

describe("which VAT applies", () => {
  it("same country (or no country): the national rate, 0% never forced", () => {
    expect(decideVat(base)).toEqual({ kind: "domestic", zeroAllowed: false, zeroForced: false, needsVies: false });
    expect(decideVat({ ...base, buyerCountry: undefined }).kind).toBe("domestic");
  });

  it("a business in another EU country: 0% only once VIES says the number is active", () => {
    const unverified = decideVat({ ...base, buyerCountry: "DE" });
    expect(unverified).toEqual({ kind: "intraEuUnverified", zeroAllowed: false, zeroForced: false, needsVies: true });
    const verified = decideVat({ ...base, buyerCountry: "DE", viesValid: true });
    expect(verified).toEqual({ kind: "intraEu", zeroAllowed: true, zeroForced: true, needsVies: false });
  });

  it("a private individual in another EU country never gets the intra-Community 0%", () => {
    expect(decideVat({ ...base, buyerCountry: "FR", buyerIsBusiness: false, viesValid: true }).kind).toBe("domestic");
  });

  it("outside the EU (Switzerland, UK, San Marino, Vatican): export, 0%", () => {
    for (const cc of ["CH", "GB", "SM", "VA", "US", "OTHER"]) expect(decideVat({ ...base, buyerCountry: cc })).toEqual({ kind: "export", zeroAllowed: true, zeroForced: true, needsVies: false });
  });

  it("Monaco is inside the French VAT territory", () => {
    expect(decideVat({ ...base, sellerCountry: "FR", buyerCountry: "MC" }).kind).toBe("domestic");
    expect(decideVat({ ...base, sellerCountry: "MC", buyerCountry: "FR" }).kind).toBe("domestic");
    expect(decideVat({ ...base, buyerCountry: "MC" }).kind).toBe("intraEuUnverified");
  });

  it("knows the EU and the VIES prefixes (Greece is EL)", () => {
    expect(isEuCountry("RO")).toBe(true);
    expect(isEuCountry("CH")).toBe(false);
    expect(isEuCountry("SM")).toBe(false);
    expect(viesPrefix("GR")).toBe("EL");
    expect(viesPrefix("MC")).toBe("FR");
    expect(viesPrefix("DE")).toBe("DE");
  });
});

describe("the rate the server applies", () => {
  const dom = decideVat(base);
  const unv = decideVat({ ...base, buyerCountry: "DE" });
  const ver = decideVat({ ...base, buyerCountry: "DE", viesValid: true });
  const exp = decideVat({ ...base, buyerCountry: "CH" });
  const noManual = { requested: false, reason: "" };

  it("VIES-verified intra-EU and export are forced to 0%, whatever was typed", () => {
    expect(effectiveVatRate(ver, 22, noManual)).toEqual({ ok: true, percent: 0 });
    expect(effectiveVatRate(exp, 22, noManual)).toEqual({ ok: true, percent: 0 });
  });

  it("an ordinary rate passes; domestic 0% needs an explicit, justified manual exemption", () => {
    expect(effectiveVatRate(dom, 22, noManual)).toEqual({ ok: true, percent: 22 });
    expect(effectiveVatRate(dom, 0, noManual)).toEqual({ ok: false, code: "VAT_MANUAL_REASON_REQUIRED" });
    expect(effectiveVatRate(dom, 0, { requested: true, reason: "no" })).toEqual({ ok: false, code: "VAT_MANUAL_REASON_REQUIRED" });
    expect(effectiveVatRate(dom, 0, { requested: true, reason: "Operazione esente art. 10" })).toEqual({ ok: true, percent: 0 });
    expect(effectiveVatRate(dom, 22, { requested: true, reason: "Operazione esente art. 10" })).toEqual({ ok: true, percent: 0 });
  });

  it("VIES is mandatory: a foreign business that is not verified cannot get 0%, not even by hand; it pays the national rate", () => {
    expect(effectiveVatRate(unv, 0, noManual)).toEqual({ ok: false, code: "VAT_ZERO_NOT_ALLOWED" });
    expect(effectiveVatRate(unv, 0, { requested: true, reason: "Operazione esente art. 10" })).toEqual({ ok: false, code: "VAT_ZERO_NOT_ALLOWED" });
    expect(effectiveVatRate(unv, 22, noManual)).toEqual({ ok: true, percent: 22 });
  });

  it("the reason stored on the quote", () => {
    expect(vatReasonFor(ver, 0)).toBe("intraEu");
    expect(vatReasonFor(exp, 0)).toBe("export");
    expect(vatReasonFor(dom, 0)).toBe("manualZero");
    expect(vatReasonFor(dom, 22)).toBe("domestic");
    expect(vatReasonFor(unv, 22)).toBe("domestic");
  });
});

describe("customer VAT numbers", () => {
  it("the platform's countries use the full check; other EU countries a shape check with their VIES prefix", () => {
    expect(checkCustomerVat("DE", "DE136695976")).toEqual({ ok: true, value: "DE136695976", prefix: "DE", number: "136695976" });
    expect(checkCustomerVat("DE", "DE136695977")).toEqual({ ok: false, code: "VAT_CHECKSUM" });
    expect(checkCustomerVat("ES", "es b-12345678")).toEqual({ ok: true, value: "ESB12345678", prefix: "ES", number: "B12345678" });
    expect(checkCustomerVat("GR", "EL123456789")).toEqual({ ok: true, value: "EL123456789", prefix: "EL", number: "123456789" });
    expect(checkCustomerVat("PL", "DE136695976")).toEqual({ ok: false, code: "VAT_PREFIX" });
    expect(checkCustomerVat("PL", "")).toEqual({ ok: false, code: "REQUIRED" });
    expect(checkCustomerVat("PL", "12")).toEqual({ ok: true, value: "PL12", prefix: "PL", number: "12" });
    expect(checkCustomerVat("CH", "CHE123456789")).toEqual({ ok: false, code: "COUNTRY_UNSUPPORTED" });
  });
});

describe("the sentence on the documents", () => {
  it("is empty for a normal supply and translated otherwise", () => {
    expect(vatNote("domestic", "it")).toBe("");
    expect(vatNote(undefined, "it")).toBe("");
    expect(vatNote("intraEu", "it", { vat: "DE136695976" })).toContain("art. 138");
    expect(vatNote("intraEu", "it", { vat: "DE136695976" })).toContain("DE136695976");
    expect(vatNote("export", "de")).toContain("Art. 146");
    expect(vatNote("manualZero", "fr", { reason: "exonération X" })).toBe("Opération à 0 % de TVA : exonération X");
    expect(vatNote("export", "xx")).toContain("Art. 146");
    for (const l of ["it", "en", "fr", "de", "nl", "ro"]) for (const r of ["intraEu", "export", "manualZero"] as const) expect(vatNote(r, l, { vat: "X", reason: "Y" })).not.toMatch(/\{/);
  });
});
