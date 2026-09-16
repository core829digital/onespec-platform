"use client";

import { use, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { InstallationCertPDF } from "@/lib/pdfs/InstallationCertPDF";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

function InstallationDocument({ data, region }: { data: any; region: string }) {
  const { dossier, tenant, jobLabel, nodeLabel, notes, survey, quote } = data;

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
    />
  );

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">
            Dossier #{dossier._id?.slice(-8).toUpperCase()} ({region})
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