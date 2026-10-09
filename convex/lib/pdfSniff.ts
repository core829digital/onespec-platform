/**
 * What an uploaded "PDF" really is. The type the browser announced is only a claim; this reads the bytes.
 *
 * It refuses files that are not PDFs, truncated PDFs, and PDFs that carry ACTIVE content — scripts, launch actions, embedded files,
 * rich media, form submission — which have no place in a customer's offer. Limitation, stated honestly: names inside compressed object
 * streams are not visible to a plain scan, so this is one layer; the files are also only ever opened through the browser's PDF viewer
 * or downloaded, never rendered inline by the platform.
 */
export type PdfProblem = "DOCUMENT_NOT_PDF" | "DOCUMENT_CORRUPT" | "DOCUMENT_ACTIVE_CONTENT";

const FORBIDDEN = ["JavaScript", "JS", "Launch", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "SubmitForm", "ImportData", "GoToE", "GoToR", "XFA"];

/** Resolves #xx escapes inside names (/J#61vaScript is /JavaScript) before looking for them. */
function decodeNameEscapes(s: string): string {
  return s.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

export function pdfProblem(bytes: Uint8Array): PdfProblem | null {
  if (bytes.length < 16) return "DOCUMENT_NOT_PDF";
  // "%PDF-" at the very start, then a version "1.x" or "2.x".
  const head = String.fromCharCode(...bytes.subarray(0, 8));
  if (!/^%PDF-[12]\.\d/.test(head)) return "DOCUMENT_NOT_PDF";
  const tail = String.fromCharCode(...bytes.subarray(Math.max(0, bytes.length - 2048)));
  if (!tail.includes("%%EOF")) return "DOCUMENT_CORRUPT";
  const text = decodeNameEscapes(new TextDecoder("latin1").decode(bytes));
  for (const name of FORBIDDEN) {
    // A name token: "/JavaScript" followed by something that ends the name (space, delimiter, end).
    if (new RegExp(`/${name}(?![A-Za-z0-9])`).test(text)) return "DOCUMENT_ACTIVE_CONTENT";
  }
  return null;
}
