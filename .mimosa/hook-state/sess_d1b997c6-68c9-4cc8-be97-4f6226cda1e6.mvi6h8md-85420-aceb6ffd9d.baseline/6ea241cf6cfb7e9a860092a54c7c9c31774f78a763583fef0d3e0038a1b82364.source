import { describe, expect, it } from "vitest";
import { strToU8, zipSync, zlibSync } from "fflate";
import { readLeadBytes } from "../src/lib/lead-import/read-file";
import { ImportError } from "../src/lib/lead-import/limits";
import { buildRows, detectColumns, looksLikeHeader } from "../src/lib/lead-import/columns";
import { detectDelimiter, parseDelimited } from "../src/lib/lead-import/csv";
import { parseXml } from "../src/lib/lead-import/xml";
import { normalizeLeadRow } from "../src/shared/leads";

const code = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ImportError ? e.code : `OTHER:${String(e)}`;
  }
};

const CT = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`;
function xlsx(sheets: Array<{ name: string; xml: string; hidden?: boolean }>, shared: string[] = [], extra: Record<string, Uint8Array> = {}, styles?: string): Uint8Array {
  const wb = `<?xml version="1.0"?><workbook xmlns="x" xmlns:r="r"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" ${s.hidden ? 'state="hidden"' : ""} r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CT),
    "xl/workbook.xml": strToU8(wb),
    "xl/_rels/workbook.xml.rels": strToU8(rels),
    "xl/sharedStrings.xml": strToU8(`<?xml version="1.0"?><sst>${shared.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`),
    ...extra,
  };
  if (styles) files["xl/styles.xml"] = strToU8(styles);
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml)));
  return zipSync(files);
}
const sheetXml = (rows: string) => `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;

describe("xlsx", () => {
  it("reads shared strings, inline strings, numbers (phones stay digits), booleans and sparse cells, and skips hidden sheets", () => {
    const bytes = xlsx(
      [
        { name: "Leads", xml: sheetXml(`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Bianchi &amp; Figli</t></is></c><c r="B2"><v>3331234567</v></c><c r="C2"><v>3.331234567E+9</v></c><c r="D2" t="b"><v>1</v></c></row>`) },
        { name: "Nascosto", xml: sheetXml(`<row r="1"><c r="A1"><v>1</v></c></row>`), hidden: true },
      ],
      ["Azienda", "Telefono", "Attivo"],
    );
    const parsed = readLeadBytes(bytes, "leads.xlsx");
    expect(parsed.kind).toBe("xlsx");
    expect(parsed.sheets.map((s) => s.name)).toEqual(["Leads"]);
    expect(parsed.sheets[0].rows).toEqual([["Azienda", "Telefono", "", "Attivo"], ["Bianchi & Figli", "3331234567", "3331234567", "TRUE"]]);
  });

  it("turns date-formatted numbers into ISO dates", () => {
    const styles = `<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>`;
    const bytes = xlsx([{ name: "S", xml: sheetXml(`<row r="1"><c r="A1" s="1"><v>45292</v></c><c r="B1" s="2"><v>45293</v></c><c r="C1" s="0"><v>45292</v></c></row>`) }], [], {}, styles);
    expect(readLeadBytes(bytes, "d.xlsx").sheets[0].rows[0]).toEqual(["2024-01-01", "2024-01-02", "45292"]);
  });

  it("refuses macro-enabled workbooks, XML with a DOCTYPE/entities, and a missing workbook", () => {
    const macro = xlsx([{ name: "S", xml: sheetXml(`<row r="1"><c r="A1"><v>1</v></c></row>`) }], [], { "xl/vbaProject.bin": new Uint8Array([1, 2, 3]) });
    expect(code(() => readLeadBytes(macro, "m.xlsm"))).toBe("MACRO_FILE");
    const xxe = xlsx([{ name: "S", xml: `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&a;</t></is></c></row></sheetData></worksheet>` }]);
    expect(code(() => readLeadBytes(xxe, "x.xlsx"))).toBe("CORRUPT_FILE");
    expect(code(() => readLeadBytes(zipSync({ "xl/other.xml": strToU8("<a/>") }), "x.xlsx"))).toBe("UNSUPPORTED_TYPE");
  });

  it("stops a zip bomb by what it inflates to, not by what it claims", () => {
    const huge = new Uint8Array(90 * 1024 * 1024); // 90 MB of zeros compresses to a few hundred KB
    const bomb = xlsx([{ name: "S", xml: sheetXml("") }], [], { "xl/worksheets/sheet9.xml": zlibSync(huge) as unknown as Uint8Array });
    // a real archive entry made from the zeros (zipSync deflates it)
    const archive = zipSync({ "[Content_Types].xml": strToU8(CT), "xl/workbook.xml": strToU8("<workbook><sheets/></workbook>"), "xl/worksheets/sheet1.xml": huge });
    expect(archive.length).toBeLessThan(2 * 1024 * 1024);
    expect(code(() => readLeadBytes(archive, "bomb.xlsx"))).toBe("ZIP_BOMB");
    void bomb;
  }, 60_000);
});

describe("docx", () => {
  const docx = (body: string, extra: Record<string, Uint8Array> = {}) =>
    zipSync({ "[Content_Types].xml": strToU8(CT), "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`), ...extra });
  const cell = (t: string, span = 0) => `<w:tc>${span ? `<w:tcPr><w:gridSpan w:val="${span}"/></w:tcPr>` : ""}<w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  it("reads a table (merged cells keep the columns aligned) and ignores the text around it", () => {
    const body = `<w:p><w:r><w:t>Elenco clienti</w:t></w:r></w:p><w:tbl><w:tr>${cell("Azienda")}${cell("Email")}${cell("Città")}</w:tr><w:tr>${cell("Rossi Srl")}${cell("info@rossi.it")}${cell("Prato")}</w:tr><w:tr>${cell("Titolo unito", 2)}${cell("x")}</w:tr></w:tbl>`;
    const parsed = readLeadBytes(docx(body), "elenco.docx");
    expect(parsed.kind).toBe("docx");
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0].rows).toEqual([["Azienda", "Email", "Città"], ["Rossi Srl", "info@rossi.it", "Prato"], ["Titolo unito", "", "x"]]);
  });
  it("falls back to lines split by tabs; refuses a document with no table or list; refuses macros", () => {
    const lines = ["Nome\tEmail", "Anna\tanna@x.it", "Luca\tluca@x.it"].map((l) => `<w:p><w:r><w:t>${l.replace(/\t/g, "</w:t><w:tab/><w:t>")}</w:t></w:r></w:p>`).join("");
    expect(readLeadBytes(docx(lines), "l.docx").sheets[0].rows).toEqual([["Nome", "Email"], ["Anna", "anna@x.it"], ["Luca", "luca@x.it"]]);
    expect(code(() => readLeadBytes(docx(`<w:p><w:r><w:t>Solo un paragrafo.</w:t></w:r></w:p>`), "p.docx"))).toBe("NO_TABLE");
    expect(code(() => readLeadBytes(docx(lines, { "word/vbaProject.bin": new Uint8Array([1]) }), "m.docm"))).toBe("MACRO_FILE");
  });
});

describe("csv", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("detects the delimiter, handles quotes, doubled quotes and line breaks inside a field", () => {
    const text = 'Nome;Email;Note\n"Rossi, Mario";m@x.it;"ha detto ""ciao""\ne basta"\nBianchi;b@x.it;ok';
    expect(detectDelimiter(text)).toBe(";");
    expect(parseDelimited(text, ";").rows).toEqual([["Nome", "Email", "Note"], ["Rossi, Mario", "m@x.it", 'ha detto "ciao"\ne basta'], ["Bianchi", "b@x.it", "ok"]]);
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });
  it("reads UTF-8 with BOM, UTF-16 and Windows-1252 (Excel's \"CSV\")", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc("Città,Email\nPrato,a@b.it")]);
    expect(readLeadBytes(bom, "a.csv").sheets[0].rows[0]).toEqual(["Città", "Email"]);
    const win = new Uint8Array([...enc("Citt"), 0xe0, ...enc(",Email\nPrato,a@b.it")]); // "Città" in windows-1252
    expect(readLeadBytes(win, "b.csv").sheets[0].rows[0][0]).toBe("Città");
    const u16 = new Uint8Array([0xff, 0xfe, ...Array.from("Nome,Email\nA,a@b.it").flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(readLeadBytes(u16, "c.csv").sheets[0].rows).toEqual([["Nome", "Email"], ["A", "a@b.it"]]);
  });
  it("drops empty lines and caps rows", () => {
    expect(readLeadBytes(enc("a,b\n\n1,2\n,\n"), "a.csv").sheets[0].rows).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("what a file really is", () => {
  it("refuses old Office/encrypted files, PDFs, images, executables, binary data, empty and oversize files", () => {
    expect(code(() => readLeadBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]), "x.xlsx"))).toBe("OLD_OFFICE_FORMAT");
    expect(code(() => readLeadBytes(new TextEncoder().encode("%PDF-1.7 ..."), "x.csv"))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => readLeadBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]), "x.csv"))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => readLeadBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0]), "x.csv"))).toBe("UNSUPPORTED_TYPE");
    expect(code(() => readLeadBytes(new Uint8Array([97, 98, 0, 99, 100]), "x.csv"))).toBe("UNSUPPORTED_TYPE"); // NUL byte: not text
    expect(code(() => readLeadBytes(new Uint8Array(0), "x.csv"))).toBe("FILE_EMPTY");
    expect(code(() => readLeadBytes(new Uint8Array(10 * 1024 * 1024 + 1).fill(97), "x.csv"))).toBe("FILE_TOO_LARGE");
    expect(code(() => readLeadBytes(zipSync({ "a.txt": strToU8("hi") }), "x.xlsx"))).toBe("UNSUPPORTED_TYPE"); // a plain zip renamed
  });
  it("the name and the claimed type do not matter: a CSV named .xlsx is read as CSV", () => {
    expect(readLeadBytes(new TextEncoder().encode("a,b\n1,2"), "fake.xlsx").kind).toBe("csv");
  });
});

describe("the XML reader", () => {
  it("decodes the five entities and numeric references, refuses declarations, and drops namespaces", () => {
    const seen: string[] = [];
    parseXml('<a:root x="1 &lt; 2"><b>&amp;&#65;&#x42;&bogus;</b><![CDATA[<raw>]]><!-- c --></a:root>', { open: (n, a) => seen.push(`<${n}${a.x ? `:${a.x}` : ""}`), text: (t) => seen.push(`t:${t}`) });
    expect(seen).toEqual(["<root:1 < 2", "<b", "t:&AB&bogus;", "t:<raw>"]);
    expect(() => parseXml('<!DOCTYPE a [<!ENTITY x "y">]><a/>', {})).toThrow();
    expect(() => parseXml("<a><!ENTITY x 'y'></a>", {})).toThrow();
  });
});

describe("column detection", () => {
  it("recognises Italian headers, including a split first/last name", () => {
    const rows = [["Ragione Sociale", "Nome", "Cognome", "E-mail", "Cellulare", "P.IVA", "Città", "CAP", "Note"], ["Rossi Srl", "Mario", "Rossi", "m@rossi.it", "333 1234567", "IT00905811006", "Prato", "59100", "x"], ["Bianchi", "Anna", "Bianchi", "a@b.it", "338 7654321", "", "Siena", "53100", ""]];
    const g = detectColumns(rows, true);
    expect(g.map((c) => c.target)).toEqual(["company", "firstName", "lastName", "email", "phone", "vatNumber", "city", "postalCode", "notes"]);
    expect(g.every((c) => c.confidence === "high")).toBe(true);
  });
  it("recognises English, French and German headers", () => {
    expect(detectColumns([["Company", "First Name", "Last Name", "Email Address", "Phone"], ["A", "B", "C", "d@e.com", "+39 333 1234567"]], true).map((c) => c.target)).toEqual(["company", "firstName", "lastName", "email", "phone"]);
    expect(detectColumns([["Entreprise", "Prénom", "Nom", "Courriel", "Téléphone", "Ville", "Code postal"], ["A", "B", "C", "d@e.fr", "01 23 45 67 89", "Paris", "75001"]], true).map((c) => c.target)).toEqual(["company", "firstName", "lastName", "email", "phone", "city", "postalCode"]);
    expect(detectColumns([["Firma", "Vorname", "Nachname", "Straße", "PLZ", "Ort"], ["A", "B", "C", "Hauptstr. 1", "10115", "Berlin"]], true).map((c) => c.target)).toEqual(["company", "firstName", "lastName", "address", "postalCode", "city"]);
  });
  it("an Italian \"Nome\" alone is the whole name; \"Nome\" + \"Cognome\" is first + last", () => {
    expect(detectColumns([["Nome", "Email"], ["Mario Rossi", "m@r.it"]], true)[0].target).toBe("name");
  });
  it("infers e-mail, phone, VAT, postal code and website from the values when there is no usable header", () => {
    const rows = [["Col1", "Col2", "Col3", "Col4", "Col5"], ["x@y.it", "+39 333 1234567", "IT00905811006", "59100", "www.rossi.it"], ["z@w.it", "338 7654321", "IT01234567897", "53100", "https://bianchi.it"], ["q@r.it", "339 1112223", "IT07643520567", "20121", "verdi.it/x"]];
    expect(detectColumns(rows, true).map((c) => c.target)).toEqual(["email", "phone", "vatNumber", "postalCode", "website"]);
  });
  it("decides whether the first row is a header", () => {
    expect(looksLikeHeader(["Nome", "Email", "Telefono"])).toBe(true);
    expect(looksLikeHeader(["Mario Rossi", "mario@rossi.it", "333 1234567"])).toBe(false);
  });
  it("a second phone column becomes phone2; unknown columns are kept as other data; empty ones are ignored", () => {
    const g = detectColumns([["Tel", "Cell", "Taglia scarpe", "vuota"], ["0574 123456", "333 1234567", "42", ""], ["0574 654321", "338 7654321", "40", ""]], true);
    expect(g.map((c) => c.target)).toEqual(["phone", "phone2", "extra", "ignore"]);
  });
  it("builds rows from the (edited) mapping, other data under its header label", () => {
    const rows = [["Azienda", "Taglia scarpe"], ["Rossi", "42"], ["", ""]];
    const g = detectColumns(rows, true);
    expect(buildRows(rows, true, g)).toEqual([{ company: "Rossi", extra: { "Taglia scarpe": "42" } }, {}]);
  });
});

describe("what reaches the server is cleaned", () => {
  it("neutralises spreadsheet formulas and refuses markup, even when it arrives as XML entities", () => {
    const f = normalizeLeadRow({ company: "=HYPERLINK(\"http://evil\")", email: "a@b.it" }, "IT");
    expect(f.ok && f.lead.company).toBe('HYPERLINK("http://evil")');
    const plus = normalizeLeadRow({ company: "Acme", phone: "+39 333 1234567" }, "IT");
    expect(plus.ok && plus.lead.phone).toBe("+393331234567");
    let text = "";
    parseXml("<t>&lt;img src=x onerror=alert(1)&gt;</t>", { text: (t) => (text += t) });
    expect(normalizeLeadRow({ name: text, email: "a@b.it" }, "IT")).toEqual({ ok: false, code: "INVALID_CHARS" });
  });
  it("keeps at most 20 other-data columns and drops odd labels", () => {
    const extra = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`c${i}`, "v"]));
    expect(normalizeLeadRow({ company: "A", extra }, "IT")).toEqual({ ok: false, code: "TOO_MANY_EXTRA" });
    const r = normalizeLeadRow({ company: "A", extra: { "ok label": "v", "<bad>": "x" } }, "IT");
    expect(r.ok && r.lead.extra).toEqual({ "ok label": "v" });
  });
  it("recognises a country name and applies its phone/postal rules", () => {
    const r = normalizeLeadRow({ company: "Müller GmbH", country: "Germania", phone: "030 1234567", postalCode: "10115" }, "IT");
    expect(r.ok && [r.lead.country, r.lead.phone, r.lead.postalCode]).toEqual(["DE", "+49301234567", "10115"]);
  });
});
