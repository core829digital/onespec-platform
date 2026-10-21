"use client";

/**
 * Prints an actual PDF blob via a hidden iframe + the browser's native PDF
 * viewer print dialog — NOT `window.print()` on the HTML page (which prints
 * whatever is on screen, iframe scrollbars included, not the real document).
 */
export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  const cleanup = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Some browsers restrict cross-frame print(); fall back to opening the
      // PDF in a new tab so the user can print from the native viewer.
      window.open(url, "_blank");
    }
    // The print dialog is synchronous in most browsers; give it time before
    // tearing down the iframe/URL for the ones that aren't.
    setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(iframe);
}
