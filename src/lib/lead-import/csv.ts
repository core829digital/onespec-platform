import { IMPORT_LIMITS, ImportError } from "./limits";
import type { Sheet } from "./xlsx";

/** Bytes → text: UTF-8 (with or without BOM), UTF-16 with BOM, else Windows-1252 (what Excel on Windows writes for "CSV"). */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const body = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return new TextDecoder("windows-1252").decode(body);
  }
}

/** The delimiter that splits the first lines into the same number of columns (more than one). */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r\n?|\n/).filter((l) => l.trim() !== "").slice(0, 20);
  let best = ",";
  let bestScore = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = sample.map((l) => countOutsideQuotes(l, d));
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = consistent * 100 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, d: string): number {
  let q = false;
  let n = 0;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === d && !q) n++;
  }
  return n;
}

export function parseDelimited(text: string, delimiter: string): { rows: string[][]; truncated: boolean } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let truncated = false;
  const clip = (s: string) => (s.length > IMPORT_LIMITS.maxCellChars ? s.slice(0, IMPORT_LIMITS.maxCellChars) : s);
  const endRow = () => {
    row.push(clip(field));
    field = "";
    if (row.some((c) => c.trim() !== "")) {
      if (rows.length >= IMPORT_LIMITS.maxRows + 1) truncated = true;
      else rows.push(row.slice(0, IMPORT_LIMITS.maxCols));
    }
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else if (field.length < IMPORT_LIMITS.maxCellChars * 4) field += c;
    } else if (c === '"' && field === "") inQuotes = true;
    else if (c === delimiter) {
      row.push(clip(field));
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      if (truncated) break;
    } else if (field.length < IMPORT_LIMITS.maxCellChars * 4) field += c;
  }
  if (!truncated && (field !== "" || row.length > 0)) endRow();
  return { rows, truncated };
}

export function readCsv(bytes: Uint8Array): Sheet[] {
  // A NUL byte means binary data, not text: refuse rather than guess.
  for (let i = 0; i < Math.min(bytes.length, 8192); i++) if (bytes[i] === 0 && !(bytes[0] === 0xff || bytes[0] === 0xfe)) throw new ImportError("UNSUPPORTED_TYPE");
  const text = decodeText(bytes);
  const { rows, truncated } = parseDelimited(text, detectDelimiter(text));
  if (rows.length === 0) throw new ImportError("FILE_EMPTY");
  return [{ name: "CSV", rows, truncated }];
}
