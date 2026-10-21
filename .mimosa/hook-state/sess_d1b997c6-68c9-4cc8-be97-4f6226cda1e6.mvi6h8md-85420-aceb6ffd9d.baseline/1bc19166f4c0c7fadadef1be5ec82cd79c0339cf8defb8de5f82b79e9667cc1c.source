"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { buildDpa, type DpaController } from "@/shared/dpa";
import { DpaPDF, type DpaPdfAcceptance } from "@/lib/pdfs/DpaPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { useCompanyPdf } from "@/lib/use-company-pdf";

/** Download the agreement as a PDF, prefilled with the tenant's data and (if signed) the acceptance. */
export function useDpaPdfDownload(version: string, controller: DpaController, acceptance: DpaPdfAcceptance | null) {
  const locale = useLocale();
  const { ready, company } = useCompanyPdf(controller.name);
  const { downloadPDF } = usePDFDownload(DpaPDF, { filename: `dpa-art28-${version}.pdf` });
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadPDF({
        doc: buildDpa(controller),
        version,
        controller,
        acceptance,
        logoUrl: company.logoUrl,
        locale,
        generatedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return { download, busy, ready };
}
