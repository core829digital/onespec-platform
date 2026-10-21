"use client";

import { use, useState, Suspense } from "react";
import { useQuery } from "@/lib/convex-query";
import type { FunctionReturnType } from "convex/server";
import { pdf } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { SiteDeliveryReportPDF } from "@/lib/pdfs/SiteDeliveryReportPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { printPdfBlob } from "@/lib/print-pdf";
import { useCompanyPdf } from "@/lib/use-company-pdf";
import { useLocale, useTranslations } from "next-intl";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

const isVideoUrl = (u: string) => /\.(mp4|mov|webm)(\?|$)/i.test(u);

function SiteDeliveryDocument({
  data,
}: {
  data: NonNullable<FunctionReturnType<typeof api.siteDeliveries.getSiteDelivery>>;
}) {
  const t = useTranslations("logistics.siteDeliveries.report");
  const locale = useLocale();
  const [generatedAt] = useState(() => Date.now());
  const dateLocale = locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : locale === "ro" ? "ro-RO" : "it-IT";
  const { ready: companyReady, company } = useCompanyPdf(data.cantiere?.name);
  const photoUrls = data.mediaUrls.filter((u) => !isVideoUrl(u));

  const commonProps = {
    tenant: company,
    cantiere: {
      name: data.cantiere?.name ?? "—",
      address: data.cantiere?.address ?? "",
      city: data.cantiere?.city ?? "",
    },
    clientName: data.client?.name,
    status: data.status,
    items: data.items.map((i) => ({
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
      loaded: i.loaded,
      notLoadedReason: i.notLoadedReason,
    })),
    photoUrls,
    signedByName: data.signedByName,
    signatureDataUrl: data.signatureDataUrl,
    signedAt: data.signedAt,
    departedAt: data.departedAt,
    deliveredAt: data.deliveredAt,
    driverName: data.driverName,
    notes: data.notes,
    locale: dateLocale,
    generatedAt,
  };

  const pdfDoc = <SiteDeliveryReportPDF {...commonProps} />;

  const { downloadPDF } = usePDFDownload(SiteDeliveryReportPDF, {
    filename: `consegna-cantiere-${data._id.slice(-8)}.pdf`,
  });

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
      <div className="no-print mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <span className="text-sm font-medium text-[var(--color-text)]">{t("title")}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadPDF(commonProps)}
            disabled={!companyReady}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
          >
            ⬇️ {t("download")}
          </button>
          <button
            onClick={handlePrint}
            disabled={!companyReady || printing}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            🖨️ {t("print")}
          </button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[600px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
          </div>
        }
      >
        {companyReady ? (
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

export default function SiteDeliveryPrintPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations("logistics.siteDeliveries.report");
  const data = useQuery(api.siteDeliveries.getSiteDelivery, { siteDeliveryId: id as Id<"siteDeliveries"> });

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }
  if (data === null) {
    return <div className="flex min-h-screen items-center justify-center text-[var(--color-danger)]">{t("notFound")}</div>;
  }

  return <SiteDeliveryDocument data={data} />;
}
