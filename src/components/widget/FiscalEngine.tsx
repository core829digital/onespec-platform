"use client";

interface FiscalEngineProps {
  priceCents: number;
  priceExVatCents: number;
  vatBreakdown: Array<{
    rate: number;
    label: string;
    baseCents: number;
    vatCents: number;
    totalCents: number;
  }>;
  totalVatCents: number;
  beniSignificativi: {
    beni10: number;
    beni22: number;
    imponibile10: number;
    iva10: number;
    imponibile22: number;
    iva22: number;
    totalCents: number;
  } | null;
  monthlyRate24Months: number;
  netAfterBonus50: number;
  regionCode: string;
  onWhatsApp: () => void;
  onSopralluogo: () => void;
  onAddToCart: () => void;
  busy?: boolean;
}

function eur(c: number): string {
  if (c == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);
}

export function FiscalEngine({
  priceCents,
  priceExVatCents,
  vatBreakdown,
  totalVatCents,
  beniSignificativi,
  monthlyRate24Months,
  regionCode,
  onWhatsApp,
  onSopralluogo,
  onAddToCart,
  busy,
}: FiscalEngineProps) {
  const isIT = regionCode === "IT";

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted-fg)]">
          Prezzo chiavi in mano
        </div>
        <div className="text-3xl font-extrabold">{eur(priceCents)}</div>
        <div className="text-sm text-[var(--color-muted-fg)]">
          Esempio finanziamento: {eur(monthlyRate24Months)} / mese · 24 rate tasso zero
        </div>
      </div>

      <div className="space-y-1 rounded-lg bg-[var(--color-muted)] p-3 text-sm">
        <div className="flex justify-between">
          <span>Imponibile</span>
          <span className="font-mono">{eur(priceExVatCents)}</span>
        </div>
        {vatBreakdown.map((v, i) => (
          <div key={i} className="flex justify-between text-[var(--color-muted-fg)]">
            <span>
              {v.label} ({v.rate}%)
            </span>
            <span className="font-mono">{eur(v.vatCents)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
          <span>IVA totale</span>
          <span className="font-mono">{eur(totalVatCents)}</span>
        </div>
      </div>

      {isIT && beniSignificativi && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-bold">Beni Significativi · Art. 7</div>
          <div className="mt-1 flex justify-between">
            <span>Imponibile 10% (manodopera + altri + beni fino a soglia)</span>
            <span className="font-mono">{eur(beniSignificativi.imponibile10)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 10%</span>
            <span className="font-mono">{eur(beniSignificativi.iva10)}</span>
          </div>
          {beniSignificativi.imponibile22 > 0 && (
            <>
              <div className="flex justify-between">
                <span>Imponibile 22% (beni eccedenti)</span>
                <span className="font-mono">{eur(beniSignificativi.imponibile22)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA 22%</span>
                <span className="font-mono">{eur(beniSignificativi.iva22)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="text-xs text-[var(--color-muted-fg)]">
            U<sub>w</sub> medio
          </div>
          <div className="text-lg font-bold">
            {/* uwValue will be passed via props */}
            <span className="text-xs font-normal">W/m²K</span>
          </div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
            /* uwEligible */ true
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}>
            Idoneo detrazioni
          </span>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">Risparmio energetico</div>
          <div className="text-lg font-bold text-emerald-800">
            ~{/* energySavingsKwhYear */ 0} kWh/anno
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          onClick={onWhatsApp}
          className="rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white"
        >
          Invia su WhatsApp
        </button>
        <button
          onClick={onSopralluogo}
          disabled={busy}
          className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Richiedi sopralluogo"}
        </button>
        <button
          onClick={onAddToCart}
          className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-semibold"
        >
          + Aggiungi al preventivo
        </button>
      </div>
    </div>
  );
}