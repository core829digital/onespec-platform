import { readCsv } from "./csv";
import { readDocx } from "./docx";
import { IMPORT_LIMITS, ImportError } from "./limits";
import { openZip } from "./zip";
import { readXlsx, type Sheet } from "./xlsx";

export type LeadFileKind = "xlsx" | "csv" | "docx";
export interface ParsedFile {
  kind: LeadFileKind;
  fileName: string;
  sheets: Sheet[];
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

/**
 * What the file REALLY is, from its first bytes — never from its name or the type the browser reported (both are just claims).
 * "ole" = the old binary Office formats (.xls / .doc), which are also what a password-protected file looks like.
 */
export function sniffFile(bytes: Uint8Array): "zip" | "ole" | "pdf" | "text" | "binary" {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  // PNG, JPEG, GIF, executables …: anything that is clearly not text.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || startsWith(bytes, [0xff, 0xd8, 0xff]) || startsWith(bytes, [0x47, 0x49, 0x46]) || startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "binary";
  return "text";
}

/** Reads a spreadsheet / document / CSV in the browser, with every limit enforced, and returns the tables it holds. */
export async function readLeadFile(file: File): Promise<ParsedFile> {
  if (file.size === 0) throw new ImportError("FILE_EMPTY");
  if (file.size > IMPORT_LIMITS.maxFileBytes) throw new ImportError("FILE_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readLeadBytes(bytes, file.name);
}

export function readLeadBytes(bytes: Uint8Array, fileName: string): ParsedFile {
  if (bytes.length === 0) throw new ImportError("FILE_EMPTY");
  if (bytes.length > IMPORT_LIMITS.maxFileBytes) throw new ImportError("FILE_TOO_LARGE");
  const kind = sniffFile(bytes);
  if (kind === "ole") throw new ImportError("OLD_OFFICE_FORMAT");
  if (kind === "pdf" || kind === "binary") throw new ImportError("UNSUPPORTED_TYPE");
  if (kind === "zip") {
    const names = openZip(bytes, () => false).names;
    if (names.includes("xl/workbook.xml")) return { kind: "xlsx", fileName, sheets: readXlsx(bytes) };
    if (names.includes("word/document.xml")) return { kind: "docx", fileName, sheets: readDocx(bytes) };
    throw new ImportError("UNSUPPORTED_TYPE"); // a zip of something else (pptx, odt, a plain archive …)
  }
  return { kind: "csv", fileName, sheets: readCsv(bytes) };
}
