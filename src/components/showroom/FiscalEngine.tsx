"use client";

import { useLocale, useTranslations } from "next-intl";

/** Zone C — the fiscal / financial engine (FASE 3.5). */

interface Vat {
  rate: number;
  label: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
}
interface Beni {
  imponibile10: number;
  iva10: number;
  imponibile22: number;
  iva22: number;
  totalCents: number;
}
export interface FiscalCalc {
  priceCents: number;
  priceExVatCents: number;
  vatBreakdown: Vat[];
  totalVatCents: number;
  beniSignificativi: Beni | null;
  uwWeightedAverage: number;
  uwEligible: boolean;
  energySavingsKwhYear: number;
  monthlyRate24Months: number;
  netAfterBonus50: number;
}

export function FiscalEngine({
  calc,
  regionCode,
  onWhatsApp,
  onSopralluogo,
  onAddToCart,
  busy,
}: {
  calc: FiscalCalc;
  regionCode: string;
  onWhatsApp: () => void;
  /** Omitted when the plan has no B2B quotes (widget-first plans): the button is hidden. */
  onSopralluogo?: () => void;
  onAddToCart: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("showroom.fiscal");
  const locale = useLocale();
  const eur = (c: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(c / 100);
  // The 10%/22% "beni significativi" split and Bonus Casa are Italian rules:
  // those two blocks only render for IT and stay in Italian on purpose.
  const isIT = regionCode === "IT";
  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted-fg)]">{t("turnkey")}</div>
        <div className="text-3xl font-extrabold">{eur(calc.priceCents)}</div>
        <div className="text-sm text-[var(--color-muted-fg)]">
          {t("financing", { monthly: eur(calc.monthlyRate24Months) })}
        </div>
      </div>

      <div className="space-y-1 rounded-lg bg-[var(--color-muted)] p-3 text-sm">
        <div className="flex justify-between">
          <span>{t("taxable")}</span>
          <span className="font-mono">{eur(calc.priceExVatCents)}</span>
        </div>
        {calc.vatBreakdown.map((v, i) => (
          <div key={i} className="flex justify-between text-[var(--color-muted-fg)]">
            <span>
              {v.label} ({v.rate}%)
            </span>
            <span className="font-mono">{eur(v.vatCents)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
          <span>{t("totalVat")}</span>
          <span className="font-mono">{eur(calc.totalVatCents)}</span>
        </div>
      </div>

      {isIT && calc.beniSignificativi && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-bold">Beni Significativi · Art. 7</div>
          <div className="mt-1 flex justify-between">
            <span>Imponibile 10% (manodopera + altri + beni fino a soglia)</span>
            <span className="font-mono">{eur(calc.beniSignificativi.imponibile10)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 10%</span>
            <span className="font-mono">{eur(calc.beniSignificativi.iva10)}</span>
          </div>
          {calc.beniSignificativi.imponibile22 > 0 && (
            <>
              <div className="flex justify-between">
                <span>Imponibile 22% (beni eccedenti)</span>
                <span className="font-mono">{eur(calc.beniSignificativi.imponibile22)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA 22%</span>
                <span className="font-mono">{eur(calc.beniSignificativi.iva22)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="text-xs text-[var(--color-muted-fg)]">
            {t.rich("uwAvg", { sub: (chunks) => <sub>{chunks}</sub> })}
          </div>
          <div className="text-lg font-bold">
            {calc.uwWeightedAverage.toFixed(2)}{" "}
            <span className="text-xs font-normal">W/m²K</span>
          </div>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
              calc.uwEligible ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {calc.uwEligible ? t("eligible") : t("notEligible")}
          </span>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">{t("savings")}</div>
          <div className="text-lg font-bold text-emerald-800">
            {t("savingsValue", { kwh: calc.energySavingsKwhYear })}
          </div>
        </div>
      </div>

      {isIT && calc.netAfterBonus50 > 0 && (
        <div className="rounded-lg bg-[var(--color-accent)] p-3 text-center text-[var(--color-accent-ink)]">
          <div className="text-xs uppercase tracking-wide opacity-80">
            Costo effettivo dopo Bonus Casa
          </div>
          <div className="text-2xl font-extrabold">{eur(calc.netAfterBonus50)}</div>
          <div className="text-[11px] opacity-80">recupero fiscale in 10 anni</div>
        </div>
      )}

      <div className={`grid gap-2 ${onSopralluogo ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <button
          onClick={onWhatsApp}
          className="rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white transition-all hover:brightness-95 hover:shadow-md active:brightness-90 active:scale-[0.98]"
        >
          {t("whatsapp")}
        </button>
{onSopralluogo ? (
                <button
          onClick={onSopralluogo}
          disabled={busy}
          className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-zinc-900 disabled:hover:shadow-none"
        >
          {busy ? "…" : t("survey")}
        </button>
        ) : null}
        <button
          onClick={onAddToCart}
          className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-semibold transition-all hover:border-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 hover:text-[var(--color-mint)] active:scale-[0.98]"
        >
          {t("addToQuote")}
        </button>
      </div>
    </div>
  );
}
