import { describe, expect, it } from "vitest";
import {
  checkCity,
  checkCompanyName,
  checkEmail,
  checkPhone,
  checkPostalCode,
  checkStreet,
  checkText,
  checkVatId,
  checkWebsite,
  cleanText,
  maskPostal,
  maskVat,
  vatMaxLength,
} from "@/shared/validation";

const code = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

describe("VAT numbers, country by country (real, publicly known numbers)", () => {
  it.each([
    ["IT", "IT00905811006", "IT00905811006"], // Eni
    ["IT", "00159560366", "IT00159560366"], // Ferrari, typed without the prefix
    ["IT", "it 00743.110.157", "IT00743110157"], // lower case and separators are tidied
    ["FR", "FR40303265045", "FR40303265045"],
    ["FR", "44 732829320", "FR44732829320"],
    ["MC", "FR 40 303 265 045", "FR40303265045"], // Monaco uses the French number
    ["BE", "BE 0403.019.261", "BE0403019261"], // Delhaize
    ["BE", "0202239951", "BE0202239951"], // Proximus
    ["DE", "DE136695976", "DE136695976"],
    ["DE", "811569869", "DE811569869"],
    ["AT", "ATU13585627", "ATU13585627"],
    ["AT", "U13585627", "ATU13585627"],
    ["LU", "LU15027442", "LU15027442"],
    ["LU", "10000356", "LU10000356"],
    ["NL", "NL820646660B01", "NL820646660B01"],
    ["NL", "nl 8206.46.660 b01", "NL820646660B01"],
    ["SM", "SM12345", "SM12345"],
  ] as const)("%s accepts %s", (country, input, stored) => {
    const r = checkVatId(country, input);
    expect(r).toEqual({ ok: true, value: stored });
  });

  it("an extra digit, a missing digit or letters in the number are refused", () => {
    expect(code(checkVatId("IT", "IT009058110061"))).toBe("VAT_FORMAT");
    expect(code(checkVatId("IT", "0090581100"))).toBe("VAT_FORMAT");
    expect(code(checkVatId("IT", "IT0090581100A"))).toBe("VAT_FORMAT");
    expect(code(checkVatId("DE", "DE1366959760"))).toBe("VAT_FORMAT");
    expect(code(checkVatId("DE", "DE036695976"))).toBe("VAT_FORMAT"); // cannot start with 0
    expect(code(checkVatId("BE", "BE2403019261"))).toBe("VAT_FORMAT"); // starts with 0 or 1
    expect(code(checkVatId("AT", "AT13585627"))).toBe("VAT_FORMAT"); // the U is missing
    expect(code(checkVatId("NL", "NL820646660B00"))).toBe("VAT_FORMAT");
    expect(code(checkVatId("NL", "NL820646660C01"))).toBe("VAT_FORMAT");
  });

  it("a wrong check digit is refused", () => {
    expect(code(checkVatId("IT", "IT00905811007"))).toBe("VAT_CHECKSUM");
    expect(code(checkVatId("FR", "FR41303265045"))).toBe("VAT_CHECKSUM");
    expect(code(checkVatId("BE", "BE0403019262"))).toBe("VAT_CHECKSUM");
    expect(code(checkVatId("DE", "DE136695977"))).toBe("VAT_CHECKSUM");
    expect(code(checkVatId("AT", "ATU13585628"))).toBe("VAT_CHECKSUM");
    expect(code(checkVatId("LU", "LU15027443"))).toBe("VAT_CHECKSUM");
  });

  it("the prefix of another country is refused", () => {
    expect(code(checkVatId("IT", "FR40303265045"))).toBe("VAT_PREFIX");
    expect(code(checkVatId("DE", "AT13585627"))).toBe("VAT_PREFIX");
    expect(code(checkVatId("FR", "IT00905811006"))).toBe("VAT_PREFIX");
  });

  it("required, except where the country has no VAT number of its own (Vatican)", () => {
    expect(code(checkVatId("IT", "  "))).toBe("REQUIRED");
    expect(checkVatId("VA", "")).toEqual({ ok: true, value: "" });
    expect(code(checkVatId("XX", "123"))).toBe("COUNTRY_UNSUPPORTED");
  });

  it("the input mask keeps letters and digits only and stops at the country's length", () => {
    expect(vatMaxLength("IT")).toBe(13);
    expect(maskVat("IT", "it 0090-5811.006 99999")).toBe("IT00905811006".slice(0, 13));
    expect(maskVat("DE", "de136695976xyz").length).toBe(11);
    expect(maskVat("AT", "atu1358562711")).toBe("ATU13585627");
  });
});

describe("postal codes", () => {
  it.each([
    ["IT", "20121", "20121"], ["SM", "47890", "47890"], ["VA", "00120", "00120"], ["FR", "75001", "75001"], ["MC", "98000", "98000"],
    ["BE", "1000", "1000"], ["NL", "1011ab", "1011 AB"], ["NL", "1011 AB", "1011 AB"], ["DE", "10115", "10115"], ["AT", "1010", "1010"], ["LU", "L-1009", "1009"], ["LU", "1009", "1009"],
  ] as const)("%s accepts %s", (country, input, stored) => expect(checkPostalCode(country, input)).toEqual({ ok: true, value: stored }));

  it("wrong lengths, letters and invalid ranges are refused", () => {
    expect(code(checkPostalCode("IT", "2012"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("IT", "201210"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("IT", "2012A"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("FR", "00100"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("BE", "0123"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("NL", "1011 SS"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("NL", "0111 AB"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("MC", "75001"))).toBe("POSTAL_FORMAT");
    expect(code(checkPostalCode("IT", ""))).toBe("REQUIRED");
  });

  it("the mask cuts at the length", () => {
    expect(maskPostal("IT", "20121-99")).toBe("20121");
    expect(maskPostal("NL", "1011abxx")).toBe("1011ABX".slice(0, 7));
  });
});

describe("phone numbers", () => {
  it("national and international forms become E.164", () => {
    expect(checkPhone("IT", "333 123 4567")).toEqual({ ok: true, value: "+393331234567" });
    expect(checkPhone("IT", "06 1234 5678")).toEqual({ ok: true, value: "+390612345678" }); // the Italian landline 0 stays
    expect(checkPhone("IT", "+39 (333) 123-4567")).toEqual({ ok: true, value: "+393331234567" });
    expect(checkPhone("IT", "0039 333 1234567")).toEqual({ ok: true, value: "+393331234567" });
    expect(checkPhone("FR", "06 12 34 56 78")).toEqual({ ok: true, value: "+33612345678" }); // trunk 0 dropped
    expect(checkPhone("DE", "0171 1234567")).toEqual({ ok: true, value: "+491711234567" });
    expect(checkPhone("IT", "+33 6 12 34 56 78")).toEqual({ ok: true, value: "+33612345678" }); // a foreign contact number is fine
  });

  it("letters, too short, too long and wrong national lengths are refused", () => {
    expect(code(checkPhone("IT", "333-ABC-4567"))).toBe("PHONE_FORMAT");
    expect(code(checkPhone("IT", "12345"))).toBe("PHONE_FORMAT");
    expect(code(checkPhone("IT", "+39 333 123 4567 8901"))).toBe("PHONE_FORMAT");
    expect(code(checkPhone("FR", "+33 6 12 34 56"))).toBe("PHONE_FORMAT"); // 8 digits: French numbers have 9
    expect(code(checkPhone("IT", "+0 333 123 4567"))).toBe("PHONE_FORMAT");
    expect(code(checkPhone("IT", "+39+333 1234567"))).toBe("PHONE_FORMAT");
    expect(code(checkPhone("IT", ""))).toBe("REQUIRED");
  });
});

describe("e-mail and web address", () => {
  it("accepts ordinary addresses and lower-cases them", () => {
    expect(checkEmail("  Info@Acme-Serramenti.IT ")).toEqual({ ok: true, value: "info@acme-serramenti.it" });
    expect(checkEmail("mario.rossi+prev@sub.example.co.uk").ok).toBe(true);
  });
  it("refuses the malformed", () => {
    for (const bad of ["info", "info@", "@acme.it", "info@acme", "info@acme..it", ".info@acme.it", "in fo@acme.it", "info@acme.i", "a@b.c"]) expect(code(checkEmail(bad))).toBe("EMAIL_FORMAT");
    expect(code(checkEmail(`${"a".repeat(65)}@acme.it`))).toBe("EMAIL_FORMAT");
    expect(code(checkEmail(""))).toBe("REQUIRED");
    expect(checkEmail("", false)).toEqual({ ok: true, value: "" });
  });
  it("web addresses: https only, real host, no credentials", () => {
    expect(checkWebsite("acme.it")).toEqual({ ok: true, value: "https://acme.it" });
    expect(checkWebsite("https://www.acme.it/chi-siamo")).toEqual({ ok: true, value: "https://www.acme.it/chi-siamo" });
    expect(checkWebsite("")).toEqual({ ok: true, value: "" });
    for (const bad of ["http://acme.it", "javascript:alert(1)", "https://user:pw@acme.it", "https://localhost", "ftp://acme.it", "not a url"]) expect(code(checkWebsite(bad))).toBe("URL_FORMAT");
  });
});

describe("text sanitisation", () => {
  it("tidies spaces, invisible characters and Unicode form silently", () => {
    expect(cleanText("  Acme ​  Serramenti\t\n S.r.l. ")).toBe("Acme Serramenti S.r.l.");
    expect(cleanText("Café")).toBe("Café");
    expect(cleanText(null)).toBe("");
    expect(cleanText("a\n\n\n\nb", true)).toBe("a\n\nb");
  });
  it("company names: normal punctuation passes, markup and scripts do not", () => {
    expect(checkCompanyName("  Serramenti Rossi & Figli S.r.l.  ")).toEqual({ ok: true, value: "Serramenti Rossi & Figli S.r.l." });
    expect(checkCompanyName("L'Infisso di Müller-Ştefan (Roma)").ok).toBe(true);
    expect(code(checkCompanyName("<script>alert(1)</script>"))).toBe("INVALID_CHARS");
    expect(code(checkCompanyName("Acme {{7*7}}"))).toBe("INVALID_CHARS");
    expect(code(checkCompanyName("A"))).toBe("TOO_SHORT");
    expect(code(checkCompanyName("x".repeat(121)))).toBe("TOO_LONG");
    expect(code(checkCompanyName("   "))).toBe("REQUIRED");
  });
  it("street and town", () => {
    expect(checkStreet("Via Roma, 12/B").ok).toBe(true);
    expect(code(checkStreet("12345"))).toBe("INVALID_CHARS");
    expect(code(checkStreet("Via <b>Roma</b>"))).toBe("INVALID_CHARS");
    expect(checkCity("San Giovanni in Persiceto").ok).toBe(true);
    expect(code(checkCity("Roma 3"))).toBe("INVALID_CHARS");
  });
  it("free text with line breaks keeps them but still refuses markup", () => {
    expect(checkText("riga 1\nriga 2", { max: 100, multiline: true })).toEqual({ ok: true, value: "riga 1\nriga 2" });
    expect(code(checkText("a<b", { max: 100 }))).toBe("INVALID_CHARS");
  });
});
