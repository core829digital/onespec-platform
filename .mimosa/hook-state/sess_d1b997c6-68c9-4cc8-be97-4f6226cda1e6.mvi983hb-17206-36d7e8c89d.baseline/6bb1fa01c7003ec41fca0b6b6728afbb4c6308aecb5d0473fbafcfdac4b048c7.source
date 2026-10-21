import { describe, expect, test } from "vitest";
import { fieldPdfCopy } from "../src/lib/pdfs/field-pdf-i18n";

describe("field PDFs: signature wording exists in every language", () => {
  for (const lang of ["it", "en", "fr", "de", "nl", "ro"]) {
    test(lang, () => {
      const t = fieldPdfCopy(lang);
      expect(t.installerSignature.length).toBeGreaterThan(3);
      expect(t.dateLabel.length).toBeGreaterThan(1);
      expect(t.clientSignature.length).toBeGreaterThan(3);
    });
  }
});
