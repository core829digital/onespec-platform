"use client";

import { use, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { PDFViewerComponent } from "@/components/ui/PDFViewer";
import { QuotePrintPDF } from "@/lib/pdfs/QuotePrintPDF";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

function QuoteDocument({ quote, tenant, region }: { quote: any; tenant: any; region: string }) {
  // Luxembourg 1-click bilingual switch
  const [luLang, setLuLang] = useState<"fr" | "de">("fr");

  const langKey = region === "LU" ? luLang : region === "FR" || region === "BE" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  const pdfDoc = (
    <QuotePrintPDF
      tenant={{
        name: tenant?.name ?? "Serramenti",
        vatId: (tenant as any)?.vatId,
        address: (tenant as any)?.address,
      }}
      quote={quote}
      locale={dateLocale}
      region={region}
    />
  );

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
            onClick={() => window.print()}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
          >
            🖨️ Stampa / Salva PDF
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

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600">
        Preventivo non trovato o accesso non autorizzato.
      </div>
    );
  }

  const region = quote.regionCode || "IT";

  return <QuoteDocument quote={quote} tenant={tenant} region={region} />;
}