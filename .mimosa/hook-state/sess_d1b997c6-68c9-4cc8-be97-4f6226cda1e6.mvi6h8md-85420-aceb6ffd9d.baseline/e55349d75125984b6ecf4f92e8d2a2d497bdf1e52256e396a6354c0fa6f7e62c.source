"use client";

import { use, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useLocale, useTranslations } from "next-intl";
import { SignaturePad } from "@/components/signature-pad";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default function SignQuotePage({ params }: Props) {
  const t = useTranslations("quoteSign");
  const locale = useLocale();
  const tf = useFriendlyError();
  const router = useRouter();
  const { id } = use(params);
  const quoteId = id as Id<"quoteRequests">;

  const data = useQuery(api.quotes.getQuoteForPrint, { quoteId });
  const signQuote = useMutation(api.quotes.signQuote);

  // The PNG to save, once a real signature has been drawn; null while the pad is empty (the pad owns the drawing).
  const [signature, setSignature] = useState<string | null>(null);
  // null until the operator edits the field — falls back to the lead name.
  const [signerNameEdit, setSignerNameEdit] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  const signerName = signerNameEdit ?? data?.quote?.leadName ?? "";

  async function handleSign() {
    if (!signature) {
      setError(t("errNeedSignature"));
      return;
    }
    if (!signerName.trim()) {
      setError(t("errNeedName"));
      return;
    }

    setSigning(true);
    setError("");

    try {
      await signQuote({
        quoteId,
        signatureDataUrl: signature,
        signedByName: signerName.trim(),
      });
      setSigned(true);
      // Redirect to print view after 1.5s
      setTimeout(() => {
        router.push(`/app/quotes/${quoteId}/print`);
      }, 1500);
    } catch (err: unknown) {
      setError(tf(err));
    } finally {
      setSigning(false);
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }

  const { quote, tenant } = data;

  if (!quote) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--color-danger)]">
        {t("notFound")}
      </div>
    );
  }

  if (signed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-mint)]/20">
          <svg className="h-10 w-10 text-[var(--color-mint-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">{t("signedTitle")}</h2>
        <p className="text-[var(--color-text-secondary)]">{t("signedSubtitle")}</p>
      </div>
    );
  }

  const totalFormatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(quote.priceCents / 100);

  const today = new Date().toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <span className="rounded-md bg-[var(--color-mint)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-mint-text)] uppercase tracking-wider">
            {t("kicker")}
          </span>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mt-1">{t("title")}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {tenant?.name} · {today}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/app/quotes/${quoteId}/print`)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          {t("goToDocument")}
        </button>
      </div>

      {/* Quote Summary for client verification */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("summaryTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-[var(--color-text-secondary)]">{t("client")}</span>
            <p className="font-medium text-[var(--color-text)]">{quote.leadName}</p>
          </div>
          {quote.customerAddress && (
            <div>
              <span className="text-[var(--color-text-secondary)]">{t("siteAddress")}</span>
              <p className="font-medium text-[var(--color-text)]">
                {quote.customerAddress}{quote.customerCity ? `, ${quote.customerCity}` : ""}
              </p>
            </div>
          )}
          <div>
            <span className="text-[var(--color-text-secondary)]">{t("positions")}</span>
            <p className="font-medium text-[var(--color-text)]">
              {Array.isArray(quote.items) ? (quote.items as unknown[]).length : 1} {t("units")}
            </p>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">{t("totalVatIncluded")}</span>
            <p className="text-xl font-bold text-[var(--color-mint-text)]">{totalFormatted}</p>
          </div>
          {quote.ecobonusPercent && quote.ecobonusPercent > 0 && (
            <div className="col-span-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              {t("ecobonusNote", {
                percent: quote.ecobonusPercent,
                amount: (((quote.ecobonusDeductionCents ?? 0)) / 100).toFixed(2),
              })}
            </div>
          )}
          {quote.depositTerms && (
            <div className="col-span-2">
              <span className="text-[var(--color-text-secondary)]">{t("paymentTerms")}</span>
              <p className="font-medium text-[var(--color-text)]">{quote.depositTerms}</p>
            </div>
          )}
        </div>
      </div>

      {/* Legal consent text */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Consenso e Accettazione (Art. 1326 C.C.)
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Il sottoscritto <strong className="text-[var(--color-text)]">{quote.leadName}</strong> dichiara di aver preso visione
          e di accettare integralmente le condizioni del presente preventivo emesso da{" "}
          <strong className="text-[var(--color-text)]">{tenant?.name}</strong> in data {today} per un importo complessivo di{" "}
          <strong className="text-[var(--color-text)]">{totalFormatted}</strong> IVA inclusa.
          La firma digitale apposta ha piena validità ai sensi dell&apos;art. 2702 C.C. e del D.Lgs. 82/2005 (CAD).
          I dati personali saranno trattati ai sensi del GDPR 679/2016.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Posa eseguita secondo la norma tecnica <strong>UNI 11673-1:2017</strong> e s.m.i.
          Validità del presente preventivo: <strong>30 giorni</strong> dalla data odierna.
        </p>
      </div>

      {/* Signature Canvas */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            {t("signatureTitle")}
          </h2>
        </div>

        {/* Signer name */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            {t("signerNameLabel")}
          </label>
          <input
            value={signerName}
            onChange={(e) => setSignerNameEdit(e.target.value)}
            placeholder={t("signerPlaceholder")}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </div>

        <SignaturePad
          height={200}
          onChange={(url) => {
            setSignature(url);
            if (url) setError("");
          }}
          hint={t("signHere")}
          subHint={t("signHint")}
          clearLabel={t("clearRetry")}
          disabled={signing}
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSign}
          disabled={signing || !signature}
          className="w-full rounded-xl bg-[var(--color-mint)] py-4 text-base font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {signing ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-mint-dark)] border-t-transparent" />
              {t("saving")}
            </>
          ) : (
            t("confirm")
          )}
        </button>

        <p className="text-center text-xs text-[var(--color-text-secondary)]">
          {t("afterConfirm", { tenant: tenant?.name ?? "" })}
        </p>
      </div>
    </div>
  );
}
