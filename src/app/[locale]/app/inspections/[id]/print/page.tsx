"use client";

import { use, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { InspectionCertPDF } from "@/lib/pdfs/InspectionCertPDF";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

function InspectionDocument({ data, region }: { data: any; region: string }) {
  const { report, tenant, title, legalBasis, warrantyLines } = data;
  const [generatedAt] = useState(() => Date.now());

  const langKey = region === "FR" || region === "BE" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  const pdfDoc = (
    <InspectionCertPDF
      tenant={{
        name: tenant?.name ?? "Serramenti",
        address: (tenant as any)?.address,
        vatId: (tenant as any)?.vatId,
      }}
      report={{
        createdAt: report.createdAt,
        status: report.status,
        customerName: report.customerName,
        siteAddress: report.siteAddress,
        photos: report.photos,
        checks: report.checks,
        installerNotes: report.installerNotes,
        clientRemarks: report.clientRemarks,
        signatureDataUrl: report.signatureDataUrl,
        signedByName: report.signedByName,
        signedAt: report.signedAt,
      }}
      title={title}
      legalBasis={legalBasis}
      warrantyLines={warrantyLines}
      locale={dateLocale}
      generatedAt={generatedAt}
    />
  );

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">
            {title} #{report._id?.slice(-8).toUpperCase()} ({region})
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
        >
          🖨️ Stampa / Salva PDF
        </button>
      </div>

      {/* PDF Viewer */}
      <Suspense
        fallback={
          <div className="flex min-h-[600px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
          </div>
        }
      >
        <PDFViewerComponent document={pdfDoc} className="min-h-[800px]" />
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