import { IMPORT_LIMITS, ImportError } from "./limits";
import { parseXml } from "./xml";
import { openZip } from "./zip";

export interface Sheet {
  name: string;
  rows: string[][];
  /** True when the file had more rows / columns than the importer reads. */
  truncated: boolean;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Is this number format a date/time one? (Excel stores dates as numbers; the format is the only clue.) */
function isDateFormatCode(code: string): boolean {
  const c = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "").toLowerCase();
  if (c === "general" || c === "") return false;
  return /[ymdhs]/.test(c) && !/^[#0,.%?\s/e+-]*$/.test(c);
}

function excelDate(serial: number): string {
  // Excel's day 1 is 1900-01-01 and it wrongly counts a 1900-02-29: subtract 25569 days to reach the Unix epoch.
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return String(serial);
  const iso = d.toISOString();
  return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
}

/** A number as a plain digit string: phones and codes stored as numbers must not turn into "3.3E+9". */
function plainNumber(raw: string): string {
  const t = raw.trim();
  if (!/[eE]/.test(t)) return t;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) < 1e21 && Number.isInteger(n) ? BigInt(n).toString() : t;
}

const colIndex = (ref: string): number => {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
};

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  let cur: string | null = null;
  let inText = false;
  let phonetic = 0;
  parseXml(xml, {
    open: (name) => {
      if (name === "si") cur = "";
      else if (name === "rPh") phonetic++;
      else if (name === "t" && cur !== null && phonetic === 0) inText = true;
    },
    close: (name) => {
      if (name === "t") inText = false;
      else if (name === "rPh") phonetic--;
      else if (name === "si") {
        out.push(cur ?? "");
        cur = null;
        if (out.length > 2_000_000) throw new ImportError("ZIP_BOMB");
      }
    },
    text: (t) => {
      if (inText && cur !== null) cur += t;
    },
  });
  return out;
}

function parseDateStyles(xml: string | undefined): Set<number> {
  const dateXf = new Set<number>();
  if (!xml) return dateXf;
  const custom = new Map<number, string>();
  let inCellXfs = false;
  let xf = 0;
  parseXml(xml, {
    open: (name, a) => {
      if (name === "numFmt" && a.numFmtId) custom.set(Number(a.numFmtId), a.formatCode ?? "");
      else if (name === "cellXfs") inCellXfs = true;
      else if (name === "xf" && inCellXfs) {
        const id = Number(a.numFmtId ?? 0);
        if (BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && isDateFormatCode(custom.get(id) ?? ""))) dateXf.add(xf);
        xf++;
      }
    },
    close: (name) => {
      if (name === "cellXfs") inCellXfs = false;
    },
  });
  return dateXf;
}

function parseSheet(xml: string, shared: string[], dateXf: Set<number>): { rows: string[][]; truncated: boolean } {
  const rows: string[][] = [];
  let truncated = false;
  let row: string[] | null = null;
  let rowIndex = -1;
  let cellCol = 0;
  let cellType = "";
  let cellStyle = -1;
  let inV = false;
  let inIs = false;
  let inT = false;
  let value = "";
  let isText = "";
  const put = (col: number, text: string) => {
    if (!row) return;
    if (col >= IMPORT_LIMITS.maxCols) {
      truncated = true;
      return;
    }
    while (row.length < col) row.push("");
    row[col] = text.length > IMPORT_LIMITS.maxCellChars ? text.slice(0, IMPORT_LIMITS.maxCellChars) : text;
  };
  parseXml(xml, {
    open: (name, a) => {
      if (name === "row") {
        rowIndex = a.r ? Number(a.r) - 1 : rowIndex + 1;
        if (rowIndex >= IMPORT_LIMITS.maxRows + 1) {
          truncated = true;
          row = null;
          return;
        }
        row = [];
        while (rows.length < rowIndex) rows.push([]);
        rows[rowIndex] = row;
      } else if (name === "c" && row) {
        cellCol = a.r ? colIndex(a.r) : row.length;
        cellType = a.t ?? "n";
        cellStyle = a.s !== undefined ? Number(a.s) : -1;
        value = "";
        isText = "";
      } else if (name === "v") inV = true;
      else if (name === "is") inIs = true;
      else if (name === "t" && inIs) inT = true;
    },
    text: (t) => {
      if (inV) value += t;
      else if (inT) isText += t;
    },
    close: (name) => {
      if (name === "v") inV = false;
      else if (name === "t") inT = false;
      else if (name === "is") inIs = false;
      else if (name === "c" && row) {
        let text = "";
        if (cellType === "s") text = shared[Number(value)] ?? "";
        else if (cellType === "inlineStr") text = isText;
        else if (cellType === "str" || cellType === "e") text = cellType === "e" ? "" : value;
        else if (cellType === "b") text = value === "1" ? "TRUE" : "FALSE";
        else if (value !== "") {
          const num = Number(value);
          text = cellStyle >= 0 && dateXf.has(cellStyle) && Number.isFinite(num) ? excelDate(num) : plainNumber(value);
        }
        if (text !== "") put(cellCol, text);
      }
    },
  });
  // Trailing empty rows and the gaps left by sparse row numbers are dropped from the end, kept in the middle.
  while (rows.length && (rows[rows.length - 1]?.every((c) => c === "") ?? true)) rows.pop();
  for (let i = 0; i < rows.length; i++) rows[i] ??= [];
  return { rows, truncated };
}

/** Reads every visible sheet of an .xlsx: its name and its cells as text. Macros, external data and formulas' code are never read. */
export function readXlsx(bytes: Uint8Array): Sheet[] {
  const zip = openZip(bytes, (n) => n === "[Content_Types].xml" || n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || n === "xl/styles.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  if (zip.names.some((n) => /vbaProject\.bin$/i.test(n)) || /macroEnabled|vbaProject/i.test(zip.read("[Content_Types].xml") ?? "")) throw new ImportError("MACRO_FILE");
  const workbook = zip.read("xl/workbook.xml");
  if (!workbook) throw new ImportError("CORRUPT_FILE");

  const rels = new Map<string, string>();
  parseXml(zip.read("xl/_rels/workbook.xml.rels") ?? "", { open: (name, a) => { if (name === "Relationship" && a.Id && a.Target) rels.set(a.Id, a.Target); } });
  const sheets: Array<{ name: string; path: string }> = [];
  parseXml(workbook, {
    open: (name, a) => {
      if (name !== "sheet" || a.state === "hidden" || a.state === "veryHidden") return;
      const target = rels.get(a["r:id"] ?? a.id ?? "");
      if (!target) return;
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      sheets.push({ name: (a.name ?? "").slice(0, 80) || `Sheet ${sheets.length + 1}`, path });
    },
  });
  if (sheets.length === 0) throw new ImportError("NO_TABLE");
  if (sheets.length > IMPORT_LIMITS.maxSheets) sheets.length = IMPORT_LIMITS.maxSheets;

  const shared = parseSharedStrings(zip.read("xl/sharedStrings.xml"));
  const dateXf = parseDateStyles(zip.read("xl/styles.xml"));
  const out: Sheet[] = [];
  for (const s of sheets) {
    const xml = zip.read(s.path);
    if (xml === undefined) continue;
    const parsed = parseSheet(xml, shared, dateXf);
    if (parsed.rows.some((r) => r.some((c) => c !== ""))) out.push({ name: s.name, ...parsed });
  }
  if (out.length === 0) throw new ImportError("NO_TABLE");
  return out;
}
