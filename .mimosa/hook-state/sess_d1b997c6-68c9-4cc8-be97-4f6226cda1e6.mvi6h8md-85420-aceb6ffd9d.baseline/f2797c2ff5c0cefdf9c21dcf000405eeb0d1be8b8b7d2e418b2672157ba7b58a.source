import { pdfProblem } from "./pdfSniff";

/**
 * Reads the first bytes of an uploaded file and says whether it is what it claims to be. The content type an upload carries is only a
 * claim of the browser that sent it; a file that fails here is deleted from storage (see convex/uploadsGuard.ts).
 */
export type SniffKind = "image" | "document" | "logo" | "brandLogo";
export type SniffProblem = "UNSUPPORTED_FILE_TYPE" | "IMAGE_TOO_LARGE_PIXELS" | "DOCUMENT_ACTIVE_CONTENT" | "DOCUMENT_CORRUPT" | "DOCUMENT_NOT_PDF";

/** A picture of more pixels than any camera makes is a decompression bomb for whatever renders it (the PDF generator, a phone). */
export const MAX_PIXELS = 120_000_000;

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

/** Width and height of a JPEG from its first "start of frame" marker. */
function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

export function imageFormat(b: Uint8Array): "png" | "jpeg" | "webp" | "heic" | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (b.length > 12 && ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif)/.test(ascii(b, 8, 12))) return "heic";
  return null;
}

/**
 * An SVG logo is a program as much as a picture: it may carry scripts, event handlers or links to other sites. Only a plain drawing passes —
 * no script / foreignObject / iframe / embed, no on…= handlers, no javascript: or html data: URLs, no DOCTYPE or entities, no reference to
 * anything outside the file except inline pictures.
 */
export function svgProblem(bytes: Uint8Array): SniffProblem | null {
  if (bytes.length > 2 * 1024 * 1024) return "UNSUPPORTED_FILE_TYPE";
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, "");
  if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(withoutComments)) return "UNSUPPORTED_FILE_TYPE";
  if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<embed|<object|<audio|<video|<animate|<set\b|<handler|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html|@import|url\(\s*["']?\s*(?!#|data:image\/)/i.test(withoutComments)) return "UNSUPPORTED_FILE_TYPE";
  // every href must point inside the file (#id) or be an inline picture
  for (const m of withoutComments.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) if (!/^(#|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(m[1].trim())) return "UNSUPPORTED_FILE_TYPE";
  return null;
}

export function sniffProblem(bytes: Uint8Array, kind: SniffKind): SniffProblem | null {
  if (kind === "brandLogo" && !imageFormat(bytes)) return svgProblem(bytes);
  if (kind === "document" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return pdfProblem(bytes);
  const format = imageFormat(bytes);
  if (!format) return kind === "document" ? "DOCUMENT_NOT_PDF" : "UNSUPPORTED_FILE_TYPE";
  if (kind === "logo" && format !== "png" && format !== "jpeg") return "UNSUPPORTED_FILE_TYPE";
  const size = format === "png" ? pngSize(bytes) : format === "jpeg" ? jpegSize(bytes) : null;
  if (size && (size.w === 0 || size.h === 0 || size.w * size.h > MAX_PIXELS)) return "IMAGE_TOO_LARGE_PIXELS";
  return null;
}
