"use client";

import { use, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { pdf } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { QuotePrintPDF } from "@/lib/pdfs/QuotePrintPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { printPdfBlob } from "@/lib/print-pdf";
import { QuoteExportBar } from "@/components/quotes/quote-export-bar";
import type { CatalogPayload } from "@/shared/pricing";
import { useCompanyPdf } from "@/lib/use-company-pdf";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

type QuoteForPrint = NonNullable<FunctionReturnType<typeof api.quotes.getQuoteForPrint>>;

function QuoteDocument({ quote, tenant, region, catalog }: { quote: NonNullable<QuoteForPrint["quote"]>; tenant: QuoteForPrint["tenant"]; region: string; catalog: CatalogPayload | null }) {
  // Luxembourg 1-click bilingual switch
  const [luLang, setLuLang] = useState<"fr" | "de">("fr");

  const { ready: companyReady, company } = useCompanyPdf(tenant?.name);

  const pdfDoc = (
    <QuotePrintPDF
      tenant={company}
      quote={quote}
      catalog={catalog}
      region={region}
      lang={region === "LU" ? luLang : undefined}
    />
  );

  // PDF Download hook
  const { downloadPDF } = usePDFDownload(QuotePrintPDF, {
    filename: `preventivo-${quote.publicId?.slice(-8) || "quote"}.pdf`,
  });

  const handleDownload = async () => {
    await downloadPDF({
      tenant: company,
      quote,
      catalog,
      region,
      lang: region === "LU" ? luLang : undefined,
    });
  };

  const [printing, setPrinting] = useState(false);
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const blob = await pdf(
        <QuotePrintPDF tenant={company} quote={quote} catalog={catalog} region={region} lang={region === "LU" ? luLang : undefined} />,
      ).toBlob();
      printPdfBlob(blob);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div className="flex items-center gap-3">
          <Link href="/app/quotes" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            ← Elenco Preventivi
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-sm font-medium text-[var(--color-text)]">
            Documento #{quote.publicId?.slice(-8).toUpperCase()} ({region})
          </span>
          {quote.signedAt ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              ✅ Firmato da {quote.signedByName}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              ⏳ In attesa di firma
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Luxembourg 1-Click Bilingual Switch */}
          {region === "LU" && (
            <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setLuLang("fr")}
                className={`rounded px-2 py-1 font-bold ${luLang === "fr" ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)]"}`}
              >
                Français (Devis)
              </button>
              <button
                type="button"
                onClick={() => setLuLang("de")}
                className={`rounded px-2 py-1 font-bold ${luLang === "de" ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)]"}`}
              >
                Deutsch (Angebot)
              </button>
            </div>
          )}

          {!quote.signedAt && (
            <Link
              href={`/app/quotes/${quote._id}/sign`}
              className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
            >
              ✍️ Firma
            </Link>
          )}
          <button
            onClick={handleDownload}
            disabled={!companyReady}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
          >
            ⬇️ Scarica PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={!companyReady || printing}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            🖨️ Stampa
          </button>
        </div>
      </div>

      {catalog ? <QuoteExportBar quote={quote} catalog={catalog} company={company} /> : null}

      {/* PDF Viewer */}
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

export default function PrintQuotePage({ params }: Props) {
  const { id } = use(params);
  const quoteId = id as Id<"quoteRequests">;
  const data = useQuery(api.quotes.getQuoteForPrint, { quoteId });

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }

  const { quote, tenant } = data;
  const catalog = (data.catalog as CatalogPayload | null) ?? null;

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600">
        Preventivo non trovato o accesso non autorizzato.
      </div>
    );
  }

  const region = quote.regionCode || "IT";

  return <QuoteDocument quote={quote} tenant={tenant} region={region} catalog={catalog} />;
}