"use client";

import { use, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { InstallationCertPDF } from "@/lib/pdfs/InstallationCertPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

function InstallationDocument({ data, region }: { data: any; region: string }) {
  const { dossier, tenant, jobLabel, nodeLabel, notes, survey, quote } = data;
  // Lazy initializer: React calls this exactly once (on mount), not on
  // every render — the sanctioned way to grab "now" for display without
  // tripping the impure-render rule Date.now() directly in the PDF
  // template's body would (see InstallationCertPDF's generatedAt prop).
  const [generatedAt] = useState(() => Date.now());

  const langKey = region === "FR" || region === "BE" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  const pdfDoc = (
    <InstallationCertPDF
      tenant={{
        name: tenant?.name ?? "Serramenti",
        address: (tenant as any)?.address,
        vatId: (tenant as any)?.vatId,
      }}
      dossier={{
        normRef: dossier.normRef,
        createdAt: dossier.createdAt,
        perimeterMm: dossier.perimeterMm,
        materials: dossier.materials,
        notes: dossier.notes,
      }}
      jobLabel={jobLabel}
      nodeLabel={nodeLabel}
      notes={notes}
      quote={quote
        ? {
            leadName: quote.leadName,
            customerAddress: quote.customerAddress,
            customerCity: quote.customerCity,
          }
        : undefined}
      survey={survey
        ? {
            customerName: survey.customerName,
            openings: survey.openings,
          }
        : undefined}
      locale={dateLocale}
      generatedAt={generatedAt}
    />
  );

  // PDF Download hook
  const { downloadPDF } = usePDFDownload(InstallationCertPDF, {
    filename: `dossier-posa-${dossier._id?.slice(-8) || "dossier"}.pdf`,
  });

  const handleDownload = async () => {
    await downloadPDF({
      tenant: {
        name: tenant?.name ?? "Serramenti",
        address: (tenant as any)?.address,
        vatId: (tenant as any)?.vatId,
      },
      dossier: {
        normRef: dossier.normRef,
        createdAt: dossier.createdAt,
        perimeterMm: dossier.perimeterMm,
        materials: dossier.materials,
        notes: dossier.notes,
      },
      jobLabel,
      nodeLabel,
      notes,
      quote: quote
        ? {
            leadName: quote.leadName,
            customerAddress: quote.customerAddress,
            customerCity: quote.customerCity,
          }
        : undefined,
      survey: survey
        ? {
            customerName: survey.customerName,
            openings: survey.openings,
          }
        : undefined,
      locale: dateLocale,
      generatedAt,
    });
  };

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">
            Dossier #{dossier._id?.slice(-8).toUpperCase()} ({region})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
          >
            ⬇️ Scarica PDF
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            🖨️ Stampa
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
        <PDFViewerComponent document={pdfDoc} className="min-h-[800px]" />
      </Suspense>
    </>
  );
}

export default function InstallationPrintPage({ params }: Props) {
  const { id } = use(params);
  const data = useQuery(api.installations.getForPrint, {
    dossierId: id as Id<"installationDossiers">,
  });

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }

  const { dossier } = data;
  const region = dossier.regionCode || "IT";

  return <InstallationDocument data={data} region={region} />;
}