import { IMPORT_LIMITS, ImportError } from "./limits";
import type { Sheet } from "./xlsx";
import { parseXml } from "./xml";
import { openZip } from "./zip";

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, IMPORT_LIMITS.maxCellChars);

/**
 * Reads the tables of a .docx (each table becomes a "sheet"). When the document has no table, every line of text is a row and tabs,
 * semicolons or pipes separate the columns. Only text is read: macros, embedded objects, images and links are never opened.
 */
export function readDocx(bytes: Uint8Array): Sheet[] {
  const zip = openZip(bytes, (n) => n === "word/document.xml" || n === "[Content_Types].xml");
  if (zip.names.some((n) => /vbaProject\.bin$/i.test(n)) || /macroEnabled|vbaProject/i.test(zip.read("[Content_Types].xml") ?? "")) throw new ImportError("MACRO_FILE");
  const xml = zip.read("word/document.xml");
  if (!xml) throw new ImportError("CORRUPT_FILE");

  const tables: string[][][] = [];
  const lines: string[] = [];
  let tableDepth = 0;
  let table: string[][] | null = null;
  let row: string[] | null = null;
  let cell: string[] | null = null;
  let para = "";
  let inT = false;
  let truncated = false;

  parseXml(xml, {
    open: (name, a) => {
      if (name === "tbl") {
        tableDepth++;
        if (tableDepth === 1) table = [];
      } else if (name === "tr" && tableDepth === 1) row = [];
      else if (name === "tc" && tableDepth === 1) {
        cell = [];
      } else if (name === "gridSpan" && tableDepth === 1 && row && a.val) {
        // A merged cell spans several columns: keep the columns aligned with empty cells after it.
        (row as string[] & { __span?: number }).__span = Math.min(Number(a.val) - 1, IMPORT_LIMITS.maxCols);
      } else if (name === "p") para = "";
      else if (name === "t") inT = true;
      else if (name === "tab") para += "\t";
      else if (name === "br" || name === "cr") para += " ";
    },
    text: (t) => {
      if (inT) para += t;
    },
    close: (name) => {
      if (name === "t") inT = false;
      else if (name === "p") {
        if (tableDepth > 0 && cell) cell.push(para);
        else if (tableDepth === 0 && para.trim()) lines.push(para);
        para = "";
      } else if (name === "tc" && tableDepth === 1 && row && cell) {
        row.push(clip(cell.join(" ")));
        const span = (row as string[] & { __span?: number }).__span ?? 0;
        for (let i = 0; i < span; i++) row.push("");
        (row as string[] & { __span?: number }).__span = 0;
        cell = null;
      } else if (name === "tr" && tableDepth === 1 && table && row) {
        if (table.length < IMPORT_LIMITS.maxRows + 1) table.push(row.slice(0, IMPORT_LIMITS.maxCols));
        else truncated = true;
        row = null;
      } else if (name === "tbl") {
        if (tableDepth === 1 && table) {
          if (table.some((r) => r.some((c) => c !== ""))) tables.push(table);
          table = null;
        }
        tableDepth = Math.max(0, tableDepth - 1);
      }
    },
  });

  const sheets: Sheet[] = tables.slice(0, IMPORT_LIMITS.maxSheets).map((rows, i) => ({ name: `Tabella ${i + 1}`, rows, truncated }));
  if (sheets.length === 0 && lines.length > 1) {
    const delimiter = ["\t", ";", "|"].find((d) => lines.filter((l) => l.includes(d)).length >= Math.ceil(lines.length * 0.6));
    if (delimiter) {
      const rows = lines.slice(0, IMPORT_LIMITS.maxRows + 1).map((l) => l.split(delimiter).slice(0, IMPORT_LIMITS.maxCols).map(clip));
      sheets.push({ name: "Testo", rows, truncated: lines.length > rows.length });
    }
  }
  if (sheets.length === 0) throw new ImportError("NO_TABLE");
  return sheets;
}
