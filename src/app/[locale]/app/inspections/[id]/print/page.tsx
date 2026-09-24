"use client";

import { use, useMemo, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { pdf } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { InspectionCertPDF } from "@/lib/pdfs/InspectionCertPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { printPdfBlob } from "@/lib/print-pdf";
import { useCompanyPdf } from "@/lib/use-company-pdf";
import { usePdfImages } from "@/lib/pdf-images";
import { useTranslations } from "next-intl";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

function InspectionDocument({ data, region }: { data: NonNullable<FunctionReturnType<typeof api.inspections.getForPrint>>; region: string }) {
  const t = useTranslations("inspectionPrint");
  const { report, tenant, title, legalBasis, warrantyLines } = data;
  const [generatedAt] = useState(() => Date.now());

  const langKey = region === "FR" || region === "BE" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  // Photos are made PDF-safe (EXIF rotation, non JPEG/PNG formats) at their
  // natural size — never resized. The PDF is only built once they're ready.
  const photoUrls = useMemo(() => (report.photos as Array<{ url?: string }>).map((p) => p.url), [report.photos]);
  const { ready: photosReady, map } = usePdfImages(photoUrls);
  const { ready: companyReady, company } = useCompanyPdf(tenant?.name);
  const ready = photosReady && companyReady;

  const pdfProps = {
    tenant: company,
    report: {
      createdAt: report.createdAt,
      status: report.status,
      customerName: report.customerName,
      siteAddress: report.siteAddress,
      photos: (report.photos as Array<{ key: string; label: string; url?: string }>).map((p) => ({
        ...p,
        url: p.url ? (map[p.url] ?? undefined) : undefined,
      })),
      checks: report.checks,
      installerNotes: report.installerNotes,
      clientRemarks: report.clientRemarks,
      signatureDataUrl: report.signatureDataUrl,
      signedByName: report.signedByName,
      signedAt: report.signedAt,
    },
    title,
    legalBasis,
    warrantyLines,
    locale: dateLocale,
    generatedAt,
  };

  const pdfDoc = <InspectionCertPDF {...pdfProps} />;

  const { downloadPDF } = usePDFDownload(InspectionCertPDF, {
    filename: `verbale-collaudo-${report._id?.slice(-8) || "report"}.pdf`,
  });

  const handleDownload = async () => {
    await downloadPDF(pdfProps);
  };

  const [printing, setPrinting] = useState(false);
  const handlePrint = async () => {
    setPrinting(true);
    try {
      printPdfBlob(await pdf(pdfDoc).toBlob());
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">
            {title} {t("document", { id: report._id?.slice(-8).toUpperCase() ?? "", region })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!ready}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
          >
            ⬇️ {t("download")}
          </button>
          <button
            onClick={handlePrint}
            disabled={!ready || printing}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            🖨️ {t("print")}
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <Suspense
        fallback={
          <div className="flex min-h-[600px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
          </div>
        }
      >
        {ready ? (
          <PDFViewerComponent document={pdfDoc} className="min-h-[800px]" />
        ) : (
          <div className="flex min-h-[600px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
          </div>
        )}
      </Suspense>
    </>
  );
}

export default function InspectionPrintPage({ params }: Props) {
  const { id } = use(params);
  const data = useQuery(api.inspections.getForPrint, {
    reportId: id as Id<"inspectionReports">,
  });

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }

  const { report } = data;
  const region = report.regionCode || "IT";

  return <InspectionDocument data={data} region={region} />;
}