"use client";

import { use, useState, Suspense } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { useTranslations } from "next-intl";
import { useFriendlyError } from "@/lib/use-friendly-error";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

type QuoteForPrint = NonNullable<FunctionReturnType<typeof api.quotes.getQuoteForPrint>>;

function QuoteDocument({ quote, tenant, region, catalog }: { quote: NonNullable<QuoteForPrint["quote"]>; tenant: QuoteForPrint["tenant"]; region: string; catalog: CatalogPayload | null }) {
  const t = useTranslations("quotePrint");
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
            {t("back")}
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-sm font-medium text-[var(--color-text)]">
            {t("document", { id: quote.publicId?.slice(-8).toUpperCase() ?? "", region })}
          </span>
          {quote.signedAt ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              ✅ {t("signedBy", { name: quote.signedByName ?? "" })}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              ⏳ {t("pendingSignature")}
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
              ✍️ {t("sign")}
            </Link>
          )}
          <button
            onClick={handleDownload}
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

      {catalog ? <QuoteExportBar quoteId={quote._id} quote={quote} catalog={catalog} company={company} /> : null}

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

/** Widget-first plans: the document is served once a PDF credit is taken for this request. */
function PdfAllowanceGate({ quoteId, used, limit }: { quoteId: Id<"quoteRequests">; used: number; limit: number }) {
  const t = useTranslations("usage");
  const tf = useFriendlyError();
  const requestPdf = useMutation(api.usage.requestPdfExport);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const exhausted = used >= limit;
  return (
    <div className="mx-auto mt-16 max-w-md space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6 text-center">
      <h1 className="text-lg font-semibold">{t("pdfGateTitle")}</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("pdfGateBody", { used, limit })}</p>
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        {exhausted ? (
          <Link href="/app/account/billing?tab=plan" className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)]">
            {t("upgradeCta")}
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                // The query re-runs reactively and serves the document once this succeeds.
                await requestPdf({ quoteId });
              } catch (e) {
                setErr(tf(e));
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-60"
          >
            {t("pdfGateCta")}
          </button>
        )}
        <Link href={`/app/requests/${quoteId}`} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}

function QuotaLockedPanel() {
  const t = useTranslations("usage");
  return (
    <div className="mx-auto mt-16 max-w-md space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6 text-center">
      <div className="text-3xl" aria-hidden="true">🔒</div>
      <h1 className="text-lg font-semibold">{t("lockedTitle")}</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("lockedBody")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/app/account/billing?tab=plan" className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)]">
          {t("upgradeCta")}
        </Link>
        <Link href="/app/requests" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}

export default function PrintQuotePage({ params }: Props) {
  const t = useTranslations("quotePrint");
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

  if (data.gate === "quote_locked") return <QuotaLockedPanel />;
  if (data.gate === "pdf_allowance") return <PdfAllowanceGate quoteId={quoteId} used={data.used} limit={data.limit} />;

  const { quote, tenant } = data;
  const catalog = (data.catalog as CatalogPayload | null) ?? null;

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600">
        {t("notFound")}
      </div>
    );
  }

  const region = quote.regionCode || "IT";

  return <QuoteDocument quote={quote} tenant={tenant} region={region} catalog={catalog} />;
}