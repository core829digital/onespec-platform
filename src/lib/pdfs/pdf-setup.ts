import { Font } from "@react-pdf/renderer";

/**
 * Shared react-pdf setup, imported by every PDF document.
 *
 * Hyphenation is off: react-pdf mis-measures hyphen-wrapped lines, so the next
 * line was drawn on top of the wrapped one (overlapping words in table cells).
 * Long words wrap at spaces instead.
 *
 * The built-in Helvetica only covers Windows-1252: characters outside it
 * (emoji flags, ✓ ✗ ☑ ☐ ⚠, Greek letters) print as garbage. Keep PDF strings to
 * that range — see `tests/pdf-charset.test.ts`.
 */
Font.registerHyphenationCallback((word) => [word]);
