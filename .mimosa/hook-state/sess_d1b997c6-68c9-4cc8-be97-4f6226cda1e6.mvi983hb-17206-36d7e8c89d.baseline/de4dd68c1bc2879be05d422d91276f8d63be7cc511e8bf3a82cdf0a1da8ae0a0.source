/**
 * In-house malware screening of ticket attachments (PNG / JPEG / WebP / PDF), run on the REAL bytes before a file is accepted.
 *
 * What this is: structure validation (a picture must parse as that picture end to end; a PDF must be a complete, unencrypted PDF without
 * active content) plus a signature scan of the whole file for things that have no business inside a screenshot or a document — the EICAR
 * test string, Windows / Linux executables, scripts and web shells, shell one-liners, and archives hidden behind an image header
 * ("polyglots"). Every rule is a deliberate, narrow pattern chosen so that real photos and PDFs do not trip it.
 *
 * What this is NOT: a commercial antivirus engine with a daily-updated signature database. It stops the common ways a file upload is
 * abused (executable or script smuggled in an image, archive polyglots, PDF launch/JavaScript actions, truncated or tampered files) and
 * it FAILS CLOSED: anything that cannot be parsed is refused. A stronger engine (ClamAV, a reputation API) can be added behind
 * `scanAttachment` without touching callers. `SCAN_VERSION` is stored with every verdict so older files can be re-checked.
 */
import { pdfProblem } from "./pdfSniff";
import { anyWindowMatches, latin1 } from "./latin1";

export const SCAN_VERSION = "2026.10.1";

export type ScanKind = "png" | "jpeg" | "webp" | "pdf";
export type ScanVerdict = "clean" | "suspicious" | "malicious";
export interface ScanResult {
  verdict: ScanVerdict;
  /** Short machine codes, e.g. "PE_EXECUTABLE". Never contains file content. */
  findings: string[];
}

function indexOfBytes(hay: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------------------------------- signatures ---------------------------------- */

const ALWAYS: Array<[string, RegExp, ScanVerdict]> = [
  ["EICAR_TEST", /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/, "malicious"],
  ["PE_EXECUTABLE", /This program cannot be run in DOS mode/, "malicious"],
];

/** Patterns that are only meaningful in pictures: a PDF may legitimately contain readable text, so these are not applied to PDFs. */
const IMAGE_ONLY: Array<[string, RegExp, ScanVerdict]> = [
  ["HTML_SCRIPT", /<script[\s>]/i, "malicious"],
  ["PHP_TAG", /<\?php/i, "malicious"],
  ["SERVER_PAGE", /<%@\s*(page|import|taglib)|<%\s*(eval|response|request)\b/i, "malicious"],
  ["SHEBANG", /#!\s*\/(usr\/)?bin\/(env\s+)?(sh|bash|zsh|python[0-9.]*|perl|ruby|node)\b/, "malicious"],
  ["POWERSHELL", /powershell(\.exe)?\s+-(enc|encodedcommand|e|nop|w|noprofile|windowstyle)\b/i, "malicious"],
  ["CMD_EXEC", /\bcmd(\.exe)?\s+\/c\s/i, "malicious"],
  ["EVAL_DECODE", /\beval\s*\(\s*(base64_decode|atob|unescape|gzinflate|str_rot13)/i, "malicious"],
  ["ACTIVEX", /WScript\.Shell|ActiveXObject|Scripting\.FileSystemObject/i, "malicious"],
  ["JS_URL", /javascript:\s*[a-z(]/i, "suspicious"],
];

function binarySignatures(bytes: Uint8Array, findings: string[]) {
  // ELF with a plausible header (class 1/2, endianness 1/2, version 1) anywhere in the file.
  for (let i = indexOfBytes(bytes, [0x7f, 0x45, 0x4c, 0x46]); i !== -1; i = indexOfBytes(bytes, [0x7f, 0x45, 0x4c, 0x46], i + 1)) {
    if ((bytes[i + 4] === 1 || bytes[i + 4] === 2) && (bytes[i + 5] === 1 || bytes[i + 5] === 2) && bytes[i + 6] === 1) {
      findings.push("ELF_EXECUTABLE");
      break;
    }
  }
  // An archive hiding behind the header of an image or a PDF: a ZIP local-file header (with a sane version), RAR or 7z at an offset > 0.
  const zip = (from: number) => indexOfBytes(bytes, [0x50, 0x4b, 0x03, 0x04], from);
  for (let i = zip(1); i !== -1; i = zip(i + 1)) {
    if (bytes[i + 4] <= 63 && bytes[i + 5] === 0) {
      findings.push("ARCHIVE_POLYGLOT");
      break;
    }
  }
  if (indexOfBytes(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], 1) !== -1) findings.push("ARCHIVE_POLYGLOT");
  if (indexOfBytes(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], 1) !== -1) findings.push("ARCHIVE_POLYGLOT");
}

/* ------------------------------------ structure ----------------------------------- */

function pngStructure(b: Uint8Array): string[] {
  const out: string[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 45) return ["BAD_STRUCTURE"];
  let pos = 8;
  let first = true;
  let sawData = false;
  let ended = false;
  let chunks = 0;
  while (pos + 12 <= b.length) {
    if (++chunks > 20_000) return ["BAD_STRUCTURE"];
    const len = dv.getUint32(pos);
    const typeStart = pos + 4;
    const dataEnd = typeStart + 4 + len;
    if (len > 0x7fffffff || dataEnd + 4 > b.length) return ["BAD_STRUCTURE"];
    const type = String.fromCharCode(b[typeStart], b[typeStart + 1], b[typeStart + 2], b[typeStart + 3]);
    if (crc32(b, typeStart, dataEnd) !== dv.getUint32(dataEnd)) return ["BAD_CHECKSUM"];
    if (first && (type !== "IHDR" || len !== 13)) return ["BAD_STRUCTURE"];
    first = false;
    if (type === "IDAT") sawData = true;
    // A critical chunk (upper-case first letter) we do not know has no place in a screenshot.
    if (/^[A-Z]/.test(type) && !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)) out.push("UNKNOWN_CRITICAL_CHUNK");
    pos = dataEnd + 4;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || !sawData) return ["BAD_STRUCTURE"];
  if (pos !== b.length) out.push("TRAILING_DATA");
  return out;
}

function jpegStructure(b: Uint8Array): string[] {
  let i = 2;
  let guard = 0;
  while (i < b.length) {
    if (++guard > 200_000) return ["BAD_STRUCTURE"];
    if (b[i] !== 0xff) return ["BAD_STRUCTURE"];
    while (b[i] === 0xff) i++;
    const marker = b[i++];
    if (marker === 0xd9) return []; // EOI: a complete image (data after it is allowed: phone photos carry thumbnails / motion clips)
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > b.length) return ["BAD_STRUCTURE"];
    const len = (b[i] << 8) | b[i + 1];
    if (len < 2) return ["BAD_STRUCTURE"];
    i += len;
    if (marker === 0xda) {
      // entropy-coded data up to the next real marker (FF00 and FFD0–D7 are stuffing / restarts)
      while (i < b.length - 1 && !(b[i] === 0xff && b[i + 1] !== 0x00 && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7) && b[i + 1] !== 0xff)) i++;
    }
  }
  return ["BAD_STRUCTURE"];
}

function webpStructure(b: Uint8Array): string[] {
  if (b.length < 20) return ["BAD_STRUCTURE"];
  const size = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4, true);
  if (size + 8 > b.length) return ["BAD_STRUCTURE"];
  return b.length - (size + 8) > 1 ? ["TRAILING_DATA"] : [];
}

function pdfStructure(b: Uint8Array): string[] {
  const out: string[] = [];
  const problem = pdfProblem(b);
  if (problem === "DOCUMENT_ACTIVE_CONTENT") out.push("PDF_ACTIVE_CONTENT");
  else if (problem) out.push("BAD_STRUCTURE");
  if (anyWindowMatches(b, /\/Encrypt\b/)) out.push("ENCRYPTED_PDF"); // cannot be inspected → refused
  if (anyWindowMatches(b, /\/(OpenAction|AA)\b[^>]{0,200}\/(S\s*\/)?(URI|Launch|JavaScript|GoToR|GoToE)\b/)) out.push("PDF_AUTO_ACTION");
  // Anything after the last %%EOF (looked for in the last 64 KB; a real PDF ends there) is appended data.
  const tail = latin1(b, Math.max(0, b.length - 65536));
  const eof = tail.lastIndexOf("%%EOF");
  if (eof === -1 ? b.length > 65536 : tail.slice(eof + 5).replace(/[\s\0]/g, "").length > 0) out.push("TRAILING_DATA");
  return out;
}

/* ------------------------------------- entry ------------------------------------- */

export function scanAttachment(bytes: Uint8Array, kind: ScanKind): ScanResult {
  const findings: string[] = [];
  let worst: ScanVerdict = "clean";
  const raise = (v: ScanVerdict) => {
    if (v === "malicious" || (v === "suspicious" && worst === "clean")) worst = v;
  };
  try {
    for (const [code, re, v] of ALWAYS) if (anyWindowMatches(bytes, re)) { findings.push(code); raise(v); }
    if (kind !== "pdf") for (const [code, re, v] of IMAGE_ONLY) if (anyWindowMatches(bytes, re)) { findings.push(code); raise(v); }
    const bin: string[] = [];
    binarySignatures(bytes, bin);
    for (const code of bin) { findings.push(code); raise("malicious"); }
    const structure = kind === "png" ? pngStructure(bytes) : kind === "jpeg" ? jpegStructure(bytes) : kind === "webp" ? webpStructure(bytes) : pdfStructure(bytes);
    for (const code of structure) {
      findings.push(code);
      raise(code === "PDF_ACTIVE_CONTENT" || code === "PDF_AUTO_ACTION" ? "malicious" : "suspicious");
    }
  } catch {
    // Fail closed: a file the scanner cannot process is not accepted.
    findings.push("SCAN_ERROR");
    raise("suspicious");
  }
  return { verdict: worst, findings: [...new Set(findings)] };
}
