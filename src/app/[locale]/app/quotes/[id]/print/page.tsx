"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProjectItem } from "@/shared/pricing";

interface Props {
  params: { id: string; locale: string };
}

const MATERIAL_LABELS: Record<string, string> = {
  pvc: "PVC Alta Densità",
  alu: "Alluminio Taglio Termico",
  wood: "Legno Lamellare",
};
const GLAZING_LABELS: Record<string, { label: string; ug: number }> = {
  double: { label: "Doppio Vetro Basso Emissivo", ug: 1.1 },
  triple: { label: "Triplo Vetro Termico", ug: 0.6 },
};
const COLOR_LABELS: Record<string, string> = {
  white: "Bianco Massa RAL 9016",
  anthracite: "Grigio Antracite RAL 7016",
  woodgrain: "Effetto Legno Noce/Rovere",
};
const INSTALLATION_LABELS: Record<string, string> = {
  posa_qualificata_uni_11673: "Posa Qualificata secondo UNI 11673-1:2017 (controtelaio + nastri)",
  posa_standard: "Posa Standard su Telaio Esistente",
  solo_fornitura: "Solo Fornitura",
};
const SASH_LABELS: Record<string, string> = {
  fix: "Fisso",
  tiltturn: "Vasistas / Antaribalta",
  classic: "Battente",
};

function fmt(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function estimateUw(item: ProjectItem): number {
  // Simplified Uw approximation for print document
  const ug = item.glazing === "triple" ? 0.6 : 1.1;
  const uframeMat: Record<string, number> = { pvc: 1.3, alu: 2.0, wood: 1.4 };
  const uFrame = uframeMat[item.material] ?? 1.5;
  const A = (item.width / 1000) * (item.height / 1000);
  const aGlass = A * 0.7;
  const aFrame = A * 0.3;
  const g = ug * aGlass + uFrame * aFrame;
  return Math.round((g / A) * 10) / 10;
}

function EnergyBadge({ uw }: { uw: number }) {
  let cls = "text-gray-700";
  let label = "—";
  if (uw <= 0.6) { cls = "text-green-700"; label = "A4"; }
  else if (uw <= 0.8) { cls = "text-green-600"; label = "A3"; }
  else if (uw <= 1.0) { cls = "text-green-500"; label = "A2"; }
  else if (uw <= 1.2) { cls = "text-emerald-500"; label = "A1"; }
  else if (uw <= 1.4) { cls = "text-lime-500"; label = "A"; }
  else if (uw <= 1.8) { cls = "text-yellow-500"; label = "B"; }
  else if (uw <= 2.2) { cls = "text-orange-500"; label = "C"; }
  else { cls = "text-red-500"; label = "D"; }
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${cls}`}>
      Classe {label} · U<sub>w</sub> = {uw} W/m²K
    </span>
  );
}

export default function PrintQuotePage({ params }: Props) {
  const quoteId = params.id as Id<"quoteRequests">;
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

  const items: ProjectItem[] = Array.isArray(quote.items) ? (quote.items as ProjectItem[]) : [];
  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const signedDate = quote.signedAt
    ? new Date(quote.signedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const installationTotal = (quote.installationPriceCents ?? 0) + (quote.demolitionPriceCents ?? 0);
  const supplyExVat = quote.priceExVatCents - (installationTotal > 0 ? Math.round(installationTotal / (1 + (quote.vatRatePercent ?? 22) / 100)) : 0);

  return (
    <>
      {/* Print action bar (hidden in print) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div className="flex items-center gap-3">
          <Link href="/app/requests" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            ← Elenco Richieste
          </Link>
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-sm font-medium text-[var(--color-text)]">
            Preventivo #{quote.publicId?.slice(-8).toUpperCase()}
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
        <div className="flex gap-2">
          {!quote.signedAt && (
            <Link
              href={`/app/quotes/${quoteId}/sign`}
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

      {/* ======= PRINTABLE DOCUMENT ======= */}
      <div
        id="print-document"
        className="mx-auto max-w-[800px] rounded-2xl border border-[var(--color-border)] bg-white text-gray-900 shadow-lg print:rounded-none print:border-none print:shadow-none"
        style={{ fontFamily: "'Arial', sans-serif", fontSize: 12 }}
      >
        {/* Header with company info */}
        <div className="flex items-start justify-between border-b border-gray-200 p-8 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenant?.name ?? "Serramenti"}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-gray-500">
              <p>P.IVA: {(tenant as { vatId?: string })?.vatId ?? "—"}</p>
              <p>{(tenant as { address?: string })?.address ?? "—"}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                PREVENTIVO UFFICIALE
              </span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              <p>N° <span className="font-mono font-bold text-gray-800">{quote.publicId?.slice(-8).toUpperCase()}</span></p>
              <p>Data: <strong>{today}</strong></p>
              <p>Validità: <strong>30 giorni</strong></p>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 border-b border-gray-200 px-8 py-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Azienda Emittente</p>
            <p className="font-bold text-gray-800">{tenant?.name}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Cliente</p>
            <p className="font-bold text-gray-800">{quote.leadName}</p>
            <p className="text-sm text-gray-600">{quote.leadEmail}</p>
            {quote.leadPhone && <p className="text-sm text-gray-600">{quote.leadPhone}</p>}
            {quote.customerAddress && (
              <p className="text-sm text-gray-600">
                {quote.customerAddress}
                {quote.customerCity ? ` — ${quote.customerCity}` : ""}
                {quote.customerPostalCode ? ` ${quote.customerPostalCode}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="px-8 py-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-700">
            Dettaglio Fornitura e Posa
          </h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold text-gray-600">Pos.</th>
                <th className="px-3 py-2 font-semibold text-gray-600">Tipologia</th>
                <th className="px-3 py-2 font-semibold text-gray-600">Dimensioni (mm)</th>
                <th className="px-3 py-2 font-semibold text-gray-600">Materiale / Vetro</th>
                <th className="px-3 py-2 font-semibold text-gray-600">U<sub>w</sub> W/m²K</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Qtà</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const uw = estimateUw(item);
                const glazingInfo = GLAZING_LABELS[item.glazing] ?? { label: item.glazing, ug: 1.1 };
                const sashTypes = item.sashes?.map((s) => SASH_LABELS[s.type] ?? s.type).join(" + ") ?? "—";
                return (
                  <tr key={idx} className="border-b border-gray-100 even:bg-gray-50">
                    <td className="px-3 py-3 font-bold text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{item.productType === "balconyDoor" ? "Portafinestra" : "Finestra"}</p>
                      <p className="text-gray-500">{sashTypes}</p>
                      <p className="text-gray-500">{COLOR_LABELS[item.color] ?? item.color}</p>
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {item.width} × {item.height}
                      <br />
                      <span className="text-gray-500">{((item.width / 1000) * (item.height / 1000)).toFixed(2)} m²</span>
                    </td>
                    <td className="px-3 py-3">
                      <p>{MATERIAL_LABELS[item.material] ?? item.material}</p>
                      <p className="text-gray-500">{glazingInfo.label}</p>
                      <p className="text-gray-500">U<sub>g</sub> = {glazingInfo.ug} W/m²K</p>
                    </td>
                    <td className="px-3 py-3">
                      <EnergyBadge uw={uw} />
                    </td>
                    <td className="px-3 py-3 text-right font-bold">{item.quantity ?? 1}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Price breakdown */}
        <div className="border-t border-gray-200 bg-gray-50 px-8 py-6">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Fornitura serramenti ({items.length} pz):</span>
              <span className="font-mono">{fmt(supplyExVat)}</span>
            </div>
            {installationTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Posa + Smaltimento:</span>
                <span className="font-mono">{fmt(installationTotal)}</span>
              </div>
            )}
            {(quote.discountPercent ?? 0) > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Sconto ({quote.discountPercent}%):</span>
                <span className="font-mono">− applicato</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 text-gray-600">
              <span>Imponibile:</span>
              <span className="font-mono">{fmt(quote.priceExVatCents)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA ({quote.vatRatePercent ?? 22}%):</span>
              <span className="font-mono">{fmt(quote.priceCents - quote.priceExVatCents)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-800 pt-2 text-base font-bold text-gray-900">
              <span>TOTALE:</span>
              <span className="font-mono">{fmt(quote.priceCents)}</span>
            </div>
            {(quote.ecobonusPercent ?? 0) > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
                <p className="font-bold">Detrazione Ecobonus {quote.ecobonusPercent}% (D.L. 63/2013 e s.m.i.)</p>
                <div className="mt-1 flex justify-between">
                  <span>Detrazione totale su 10 anni:</span>
                  <span className="font-mono font-bold">{fmt(quote.ecobonusDeductionCents ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo netto effettivo:</span>
                  <span className="font-mono font-bold">
                    {fmt(quote.priceCents - (quote.ecobonusDeductionCents ?? 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Installation note */}
        {quote.installationType && (
          <div className="border-t border-gray-200 px-8 py-4 text-xs text-gray-600">
            <strong>Modalità di posa:</strong>{" "}
            {INSTALLATION_LABELS[quote.installationType] ?? quote.installationType}
          </div>
        )}

        {/* Payment terms */}
        {quote.depositTerms && (
          <div className="border-t border-gray-200 px-8 py-4 text-xs text-gray-600">
            <strong>Condizioni di pagamento:</strong> {quote.depositTerms}
          </div>
        )}

        {/* Legal & warranty */}
        <div className="border-t border-gray-200 px-8 py-5 text-xs text-gray-500 space-y-1.5">
          <p>
            <strong>Norma di posa:</strong> La posa in opera verrà eseguita nel rispetto della norma tecnica{" "}
            <strong>UNI 11673-1:2017</strong> — Posa in opera di serramenti — Parte 1: Requisiti e criteri di verifica
            della progettazione. Saranno utilizzati nastri pre-compressi, sigillanti e controtelai conformi.
          </p>
          <p>
            <strong>Garanzia:</strong> Garanzia prodotto 10 anni sui profili, 5 anni sulle ferramenta, 2 anni sulla
            manodopera di posa secondo D.Lgs. 206/2005 (Codice del Consumo).
          </p>
          <p>
            <strong>Detrazione fiscale:</strong> Ai fini Ecobonus, il committente dovrà comunicare preventivamente
            l&apos;intervento al Comune e richiedere l&apos;APE (Attestato di Prestazione Energetica) pre e post intervento
            se richiesto. Il presente preventivo non costituisce perizia energetica.
          </p>
          <p>
            <strong>Privacy:</strong> I dati personali sono trattati ai sensi del Reg. UE 679/2016 (GDPR). Responsabile
            del trattamento: {tenant?.name}.
          </p>
        </div>

        {/* Signature block */}
        <div className="border-t-2 border-gray-300 px-8 py-6">
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Firma e Timbro Aziendale
              </p>
              <div className="h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-end pb-2 px-2">
                <span className="text-xs text-gray-400">Per {tenant?.name}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Firma Cliente per Accettazione
              </p>
              {quote.signatureDataUrl ? (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={quote.signatureDataUrl}
                    alt="Firma cliente"
                    className="h-20 w-full object-contain border border-gray-200 rounded-lg bg-white"
                  />
                  <p className="text-xs text-gray-600">
                    <strong>{quote.signedByName}</strong>
                    {signedDate ? ` — ${signedDate}` : ""}
                  </p>
                </div>
              ) : (
                <div className="h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-end pb-2 px-2">
                  <span className="text-xs text-gray-400">Da firmare</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-b-2xl border-t border-gray-200 bg-gray-100 px-8 py-3 text-center text-xs text-gray-400 print:rounded-none">
          Documento generato da OneSpec Platform · onespec-platform.vercel.app · {today}
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #print-document { max-width: 100% !important; box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}
