"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProjectItem } from "@/shared/pricing";

interface Props {
  params: { id: string; locale: string };
}

const MATERIAL_LABELS: Record<string, Record<string, string>> = {
  pvc: { it: "PVC Alta Densità", fr: "PVC Haute Densité", de: "PVC Kunststoff", nl: "PVC Kunststof" },
  alu: { it: "Alluminio Taglio Termico", fr: "Aluminium Rupture Thermique", de: "Aluminium Thermisch", nl: "Aluminium Thermisch" },
  wood: { it: "Legno Lamellare", fr: "Bois Lamellé Collé", de: "Holz Lamelliert", nl: "Hout Gelamineerd" },
};

const GLAZING_LABELS: Record<string, { label: Record<string, string>; ug: number }> = {
  double: {
    label: { it: "Doppio Vetro Basso Emissivo", fr: "Double Vitrage FE", de: "2-fach Isolierglas", nl: "HR++ Dubbel Glas" },
    ug: 1.1,
  },
  triple: {
    label: { it: "Triplo Vetro Termico", fr: "Triple Vitrage Thermique", de: "3-fach Wärmeschutzglas", nl: "HR+++ Drievoudig Glas" },
    ug: 0.6,
  },
};

const COLOR_LABELS: Record<string, string> = {
  white: "Bianco / Blanc / Weiß / Crème (RAL 9016/9001)",
  anthracite: "Grigio Antracite / Gris Anthracite RAL 7016",
  woodgrain: "Effetto Legno / Chêne / Monumentengroen RAL 6009",
};

const SASH_LABELS: Record<string, Record<string, string>> = {
  fix: { it: "Fisso", fr: "Fixe", de: "Fest", nl: "Vast" },
  tiltturn: { it: "Vasistas / Antaribalta", fr: "Oscillo-battant", de: "Dreh-Kipp", nl: "Draai-kiep" },
  classic: { it: "Battente", fr: "Ouvrant", de: "Dreh", nl: "Draai" },
};

function fmt(cents: number, locale = "it-IT") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

function estimateUw(item: ProjectItem): number {
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

  // Luxembourg 1-click bilingual switch
  const [luLang, setLuLang] = useState<"fr" | "de">("fr");

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
  const items: ProjectItem[] = Array.isArray(quote.items) ? (quote.items as ProjectItem[]) : [];

  const langKey = region === "LU" ? luLang : region === "FR" || region === "BE" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  const today = new Date().toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const signedDate = quote.signedAt
    ? new Date(quote.signedAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const installationTotal = (quote.installationPriceCents ?? 0) + (quote.demolitionPriceCents ?? 0);
  const supplyExVat = quote.priceExVatCents - (installationTotal > 0 ? Math.round(installationTotal / (1 + (quote.vatRatePercent ?? 22) / 100)) : 0);

  // Document Title by Region
  let documentTitle = "PREVENTIVO UFFICIALE";
  let documentTypeBadge = "🇮🇹 ITALIA · UNI 11673";
  if (region === "FR") {
    documentTitle = "DEVIS OFFICIEL & PROPOSITION COMMERCIALE";
    documentTypeBadge = "🇫🇷 FRANCE · DTU 36.5 / RGE";
  } else if (region === "BE") {
    documentTitle = "OFFERTE / DEVIS DE MENUISERIE";
    documentTypeBadge = "🇧🇪 BELGIQUE · TVA 6%/21%";
  } else if (region === "NL") {
    documentTitle = "OFFERTE KOZIJNEN & MONTAGE";
    documentTypeBadge = "🇳🇱 NEDERLAND · BLOKPROFIEL / HVL";
  } else if (region === "DE") {
    documentTitle = "ANGEBOT FENSTERBAU & MONTAGE";
    documentTypeBadge = "🇩🇪 DEUTSCHLAND · RAL-MONTAGE";
  } else if (region === "LU") {
    documentTitle = luLang === "de" ? "ANGEBOT / DEVIS (LUXEMBURG)" : "DEVIS OFFICIEL / ANGEBOT (LUXEMBOURG)";
    documentTypeBadge = "🇱🇺 LUXEMBOURG · TVA 3%";
  }

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
              <p>P.IVA / TVA / MwSt: {(tenant as { vatId?: string })?.vatId ?? "—"}</p>
              {quote.rgeCertificate && (
                <p className="font-semibold text-emerald-700">Certifié RGE QUALIBAT: {quote.rgeCertificate}</p>
              )}
              {quote.decennaleInsurance && (
                <p className="text-gray-600">{quote.decennaleInsurance}</p>
              )}
              <p>{(tenant as { address?: string })?.address ?? "—"}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                {documentTitle}
              </span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              <p className="font-semibold text-gray-700">{documentTypeBadge}</p>
              <p>N° <span className="font-mono font-bold text-gray-800">{quote.publicId?.slice(-8).toUpperCase()}</span></p>
              <p>Data / Date: <strong>{today}</strong></p>
              <p>Validità / Validité: <strong>30 giorni / 30 jours</strong></p>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 border-b border-gray-200 px-8 py-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {langKey === "fr" ? "Entreprise émettrice" : langKey === "de" ? "Ausführendes Unternehmen" : langKey === "nl" ? "Uitvoerend bedrijf" : "Azienda Emittente"}
            </p>
            <p className="font-bold text-gray-800">{tenant?.name}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {langKey === "fr" ? "Client / Maître d'ouvrage" : langKey === "de" ? "Kunde / Auftraggeber" : langKey === "nl" ? "Klant / Opdrachtgever" : "Cliente"}
            </p>
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
            {langKey === "fr" ? "Détail Menuiseries & Prestations de Pose" : langKey === "de" ? "Elemente- & Montageaufstellung" : langKey === "nl" ? "Specificatie Kozijnen & Montage" : "Dettaglio Fornitura e Posa"}
          </h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold text-gray-600">Pos.</th>
                <th className="px-3 py-2 font-semibold text-gray-600">
                  {langKey === "fr" ? "Type / Désignation" : langKey === "de" ? "Bezeichnung" : langKey === "nl" ? "Type" : "Tipologia"}
                </th>
                <th className="px-3 py-2 font-semibold text-gray-600">Dimensioni (mm)</th>
                <th className="px-3 py-2 font-semibold text-gray-600">Materiale / Vetro</th>
                <th className="px-3 py-2 font-semibold text-gray-600">U<sub>w</sub> W/m²K</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Qtà</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const uw = estimateUw(item);
                const matText = MATERIAL_LABELS[item.material]?.[langKey] ?? MATERIAL_LABELS[item.material]?.it ?? item.material;
                const glazingInfo = GLAZING_LABELS[item.glazing] ?? { label: { it: item.glazing }, ug: 1.1 };
                const glazingText = glazingInfo.label[langKey] ?? glazingInfo.label.it;
                const sashTypes = item.sashes?.map((s) => SASH_LABELS[s.type]?.[langKey] ?? s.type).join(" + ") ?? "—";
                return (
                  <tr key={idx} className="border-b border-gray-100 even:bg-gray-50">
                    <td className="px-3 py-3 font-bold text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{item.productType === "balconyDoor" ? "Portafinestra / Porte-fenêtre" : "Finestra / Fenêtre"}</p>
                      <p className="text-gray-500">{sashTypes}</p>
                      <p className="text-gray-500">{COLOR_LABELS[item.color] ?? item.color}</p>
                      {quote.hvlJointCount && (
                        <p className="text-emerald-700 font-medium">✦ HVL 90° Houtverbindingslook ({quote.hvlJointCount} hoeken)</p>
                      )}
                      {quote.rcSecurityLevel && quote.rcSecurityLevel !== "standard" && (
                        <p className="text-blue-700 font-medium">✦ Sicherheitsbeschlag {quote.rcSecurityLevel} (Pilzkopf + P4A)</p>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {item.width} × {item.height}
                      <br />
                      <span className="text-gray-500">{((item.width / 1000) * (item.height / 1000)).toFixed(2)} m²</span>
                    </td>
                    <td className="px-3 py-3">
                      <p>{matText}</p>
                      <p className="text-gray-500">{glazingText}</p>
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
              <span className="font-mono">{fmt(supplyExVat, dateLocale)}</span>
            </div>
            {installationTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Posa + Dépose / Smaltimento:</span>
                <span className="font-mono">{fmt(installationTotal, dateLocale)}</span>
              </div>
            )}
            {(quote.discountPercent ?? 0) > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Sconto / Remise ({quote.discountPercent}%):</span>
                <span className="font-mono">− applicato</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 text-gray-600">
              <span>Imponibile / Total HT:</span>
              <span className="font-mono">{fmt(quote.priceExVatCents, dateLocale)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA / TVA / Btw ({quote.vatRatePercent ?? 20}%):</span>
              <span className="font-mono">{fmt(quote.priceCents - quote.priceExVatCents, dateLocale)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-800 pt-2 text-base font-bold text-gray-900">
              <span>TOTALE / TOTAL TTC:</span>
              <span className="font-mono">{fmt(quote.priceCents, dateLocale)}</span>
            </div>

            {/* Subsidies */}
            {(quote.ecobonusPercent ?? 0) > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
                <p className="font-bold">Detrazione Ecobonus {quote.ecobonusPercent}% (D.L. 63/2013 e s.m.i.)</p>
                <div className="mt-1 flex justify-between">
                  <span>Detrazione totale:</span>
                  <span className="font-mono font-bold">{fmt(quote.ecobonusDeductionCents ?? 0, dateLocale)}</span>
                </div>
              </div>
            )}

            {(quote.maPrimeRenovPercent ?? 0) > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
                <p className="font-bold">Aide MaPrimeRénov&apos; estimée ({quote.maPrimeRenovPercent}%)</p>
                <div className="mt-1 flex justify-between">
                  <span>Montant de l&apos;aide estimé:</span>
                  <span className="font-mono font-bold">{fmt(quote.maPrimeRenovDeductionCents ?? 0, dateLocale)}</span>
                </div>
                <p className="mt-1 text-[10px] text-emerald-600">Sous réserve de validation par l&apos;ANAH et pose par installateur certifié RGE.</p>
              </div>
            )}

            {quote.klimabonusEligible && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
                <p className="font-bold">Éligible Subvention Klimabonus (Luxembourg)</p>
                <p className="mt-0.5 text-[10px] text-emerald-600">Performance thermique conforme aux exigences de l&apos;Administration de l&apos;Environnement.</p>
              </div>
            )}
          </div>
        </div>

        {/* Regional notes & legal */}
        <div className="border-t border-gray-200 px-8 py-5 text-xs text-gray-500 space-y-2">
          {region === "FR" && (
            <>
              <p>
                <strong>Norme de pose DTU 36.5:</strong> La pose est réalisée conformément au Document Technique Unifié
                DTU 36.5 (Mise en œuvre des fenêtres et portes-fenêtres). Étanchéité à l&apos;air et à l&apos;eau garantie par
                membranes et fonds de joint normalisés.
              </p>
              <p>
                <strong>Garanties & Assurance Décennale:</strong> Assurance responsabilité civile décennale obligatoire souscrite
                auprès de {quote.decennaleInsurance || "AXA Assurances"}. Garantie biennale sur les équipements et garantie de parfait achèvement 1 an.
              </p>
              <p>
                <strong>Rétractation (Art. L221-18 Code de la consommation):</strong> En cas de démarchage à domicile ou vente hors établissement,
                le client dispose d&apos;un délai légal de rétractation de 14 jours francs à compter de la signature.
              </p>
            </>
          )}

          {region === "BE" && (
            <>
              <p>
                <strong>Attestation TVA 6% (Belgique):</strong> Pour les travaux de rénovation sur un logement privé de plus de 10 ans,
                le taux réduit de TVA de 6% est applicable sur présentation de la déclaration légale signée par le maître d&apos;ouvrage.
              </p>
              <p>
                <strong>Primes Régionales:</strong> Menuiseries conformes aux normes d&apos;isolation Uw ≤ 1.5 W/m²K ouvrant droit aux
                primes MijnVerbouwPremie (Flandre) et Primes Habitation (Wallonie).
              </p>
            </>
          )}

          {region === "NL" && (
            <>
              <p>
                <strong>VKG / SKG Kwaliteitsnorm:</strong> Kozijnen uitgevoerd in Blokprofiel met HVL 90° rechte hoekverbinding
                conform VKG-richtlijnen en SKG** weerstandsklasse.
              </p>
              <p>
                <strong>ISDE Subsidie:</strong> Beglazing HR++ / HR+++ voldoet aan de eisen van de RVO voor de Investeringssubsidie
                Duurzame Energie (ISDE).
              </p>
            </>
          )}

          {region === "DE" && (
            <>
              <p>
                <strong>RAL-Gütegesicherte Montage (DIN 4108-7 / DIN 18055):</strong> 3-Ebenen-Montage nach den anerkannten Regeln der Technik.
                Innen luftdicht (Dampfbremse), mittig wärme- und schalldämmend, außen schlagregendicht und diffusionsoffen (Compriband).
              </p>
              <p>
                <strong>VOB/B Gewährleistung:</strong> 5 Jahre Gewährleistung auf Profile und Verglasung, 2 Jahre auf Beschläge und Montage.
              </p>
            </>
          )}

          {region === "LU" && (
            <>
              <p>
                <strong>Taux de TVA 3% (Super-réduit):</strong> Application sous réserve de l&apos;accord formel de l&apos;Administration de l&apos;Enregistrement,
                des Domaines et de la TVA (logement affecté à des fins d&apos;habitation principale).
              </p>
            </>
          )}

          {region === "IT" && (
            <>
              <p>
                <strong>Norma UNI 11673-1:2017:</strong> Posa qualificata eseguita con controtelai termici, sigillanti elastici
                e nastri autoespandenti conformi per l&apos;eliminazione dei ponti termici.
              </p>
            </>
          )}

          {quote.depositTerms && (
            <p>
              <strong>Condizioni di pagamento / Modalités:</strong> {quote.depositTerms}
            </p>
          )}
        </div>

        {/* Signature block */}
        <div className="border-t-2 border-gray-300 px-8 py-6">
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {langKey === "fr" ? "Cachet et Signature de l'Entreprise" : langKey === "de" ? "Firmenstempel & Unterschrift" : langKey === "nl" ? "Handtekening Bedrijf" : "Firma e Timbro Aziendale"}
              </p>
              <div className="h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-end pb-2 px-2">
                <span className="text-xs text-gray-400">Pour / Per {tenant?.name}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {langKey === "fr" ? "Bon pour Accord et Signature Client" : langKey === "de" ? "Auftragserteilung Kunde" : langKey === "nl" ? "Akkoord Klant" : "Firma Cliente per Accettazione"}
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
                  <span className="text-xs text-gray-400">Da firmare / À signer</span>
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
