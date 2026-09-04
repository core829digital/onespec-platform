"use client";

import { use, useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { StatusBadge } from "@/components/app-shell/status-badge";

const STATUSES = ["new", "contacted", "quoted", "won", "lost", "spam"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "Nuova",
  contacted: "Contattata",
  quoted: "Preventivo inviato",
  won: "Vinta",
  lost: "Persa",
  spam: "Spam",
};

const eur = (c: number) => `€${(c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

interface SashLike {
  type?: string;
  active?: boolean;
  hardware?: string;
  hardwareColor?: string;
}
interface ItemLike {
  productType?: string;
  material?: string;
  width?: number;
  height?: number;
  quantity?: number;
  glazing?: string;
  color?: string;
  insectScreen?: boolean;
  sashes?: SashLike[];
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quoteId = id as Id<"quoteRequests">;
  const quote = useQuery(api.quotes.getRequest, { quoteId });
  const tenant = useQuery(api.tenants.getMyTenant);
  const members = useQuery(
    api.tenants.listMembers,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  const updateStatus = useMutation(api.quotes.updateStatus);
  const assignRequest = useMutation(api.quotes.assignRequest);
  const addNote = useMutation(api.quotes.addNote);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const slaInfo = useMemo(() => {
    if (!quote) return null;
    const now = Date.now();
    const elapsedMinutes = Math.floor((now - quote._creationTime) / 60000);
    const creationDate = new Date(quote._creationTime);
    const hours = creationDate.getHours();
    const minutes = creationDate.getMinutes();

    // Evening peak traffic: 20:30 to 23:00
    const isEveningPeak = (hours === 20 && minutes >= 30) || (hours >= 21 && hours <= 23);

    return {
      elapsedMinutes,
      isEveningPeak,
      timeString: creationDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      dateString: creationDate.toLocaleDateString("it-IT", { day: "2-digit", month: "long" }),
    };
  }, [quote]);

  if (quote === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }
  if (quote === null) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)]">Richiesta non trovata.</p>
        <Link href="/app/requests" className="text-[var(--color-mint)] hover:underline">
          ← Torna alle richieste
        </Link>
      </div>
    );
  }

  const items: ItemLike[] = Array.isArray(quote.items) ? (quote.items as ItemLike[]) : [];

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  const cleanPhone = quote.leadPhone?.replace(/[^0-9+]/g, "") || "";
  const whatsappGreeting = `Buongiorno ${quote.leadName}, la contatto da parte di ${tenant?.name || "OneSpec"} in merito alla sua richiesta di preventivo per serramenti. Quando possiamo sentirci per fissare un sopralluogo tecnico gratuito?`;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(whatsappGreeting)}`
    : null;

  return (
    <div className="space-y-6">
      {/* SLA & Speed-to-Lead Alert Banner */}
      {slaInfo && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            {slaInfo.elapsedMinutes <= 5 ? (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            ) : slaInfo.elapsedMinutes <= 30 ? (
              <span className="h-3 w-3 rounded-full bg-amber-500"></span>
            ) : (
              <span className="h-3 w-3 rounded-full bg-gray-400"></span>
            )}
            <div>
              <p className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <span>Ricevuta {slaInfo.elapsedMinutes < 60 ? `${slaInfo.elapsedMinutes} min fa` : `${Math.floor(slaInfo.elapsedMinutes / 60)}h ${slaInfo.elapsedMinutes % 60}m fa`}</span>
                <span className="text-xs font-normal text-[var(--color-text-secondary)]">({slaInfo.dateString} alle {slaInfo.timeString})</span>
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {slaInfo.elapsedMinutes <= 5
                  ? "⚡ SLA Ottimale: rispondi in <5 min per aumentare del +390% i sopralluoghi fissati!"
                  : slaInfo.elapsedMinutes <= 30
                  ? "⏱️ Risposta rapida: ricontattare entro 30 min garantisce 3x di chiusure rispetto a >24h."
                  : "📅 Contatta il cliente il prima possibile per non perdere l'interesse all'acquisto."}
              </p>
            </div>
          </div>

          {slaInfo.isEveningPeak && (
            <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>🌙 Lead Serale (20:30-23:00)</span>
              <span className="font-normal opacity-80">· Chiama domattina 09:00–10:30</span>
            </span>
          )}
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/requests"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            aria-label="Torna alle richieste"
          >
            ←
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{quote.leadName}</h1>
          <StatusBadge status={quote.status} />
          {quote.channel === "field_b2b" && (
            <span className="rounded-md bg-[var(--color-mint)]/20 px-2 py-0.5 text-xs font-bold text-[var(--color-mint)]">
              B2B Cantiere
            </span>
          )}
          {quote.regionCode && (
            <span className="rounded-md bg-gray-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
              {quote.regionCode}
            </span>
          )}
        </div>

        {/* 1-Click Fast Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <span>💬</span>
              <span>WhatsApp 1-Click</span>
            </a>
          )}
          {quote.leadPhone && (
            <a
              href={`tel:${quote.leadPhone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
            >
              <span>📞</span>
              <span>Chiama</span>
            </a>
          )}
          <Link
            href={`/app/quotes/${quote._id}/print`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
          >
            <span>🖨️</span>
            <span>Stampa PDF</span>
          </Link>
          {!quote.signedAt && (
            <Link
              href={`/app/quotes/${quote._id}/sign`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-3 py-2 text-xs font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 transition-opacity"
            >
              <span>✍️</span>
              <span>Firma Touch</span>
            </Link>
          )}
        </div>
      </div>

      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          {/* Customer info */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="font-semibold text-[var(--color-text)]">Contatto & Cantiere</h2>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="Email" value={<a href={`mailto:${quote.leadEmail}`} className="text-[var(--color-mint)] hover:underline">{quote.leadEmail}</a>} />
              {quote.leadPhone ? (
                <Row
                  label="Telefono"
                  value={
                    <a href={`tel:${quote.leadPhone}`} className="text-[var(--color-text)] hover:underline font-mono">
                      {quote.leadPhone}
                    </a>
                  }
                />
              ) : null}
              {quote.customerAddress ? (
                <Row
                  label="Indirizzo Cantiere"
                  value={`${quote.customerAddress}${quote.customerCity ? `, ${quote.customerCity}` : ""}${quote.customerPostalCode ? ` (${quote.customerPostalCode})` : ""}`}
                />
              ) : null}
              {quote.leadCompany ? <Row label="Azienda" value={quote.leadCompany} /> : null}
              <Row label="Lingua Richiesta" value={quote.leadLocale.toUpperCase()} />
              {quote.signedByName && (
                <Row
                  label="Firma Digitale"
                  value={
                    <span className="text-emerald-600 font-semibold">
                      ✅ Firmato da {quote.signedByName} in data {new Date(quote.signedAt || 0).toLocaleDateString("it-IT")}
                    </span>
                  }
                />
              )}
            </dl>
            {quote.leadMessage ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap border-l-2 border-[var(--color-border)] pl-3">
                {quote.leadMessage}
              </p>
            ) : null}
          </section>

          {/* Pricing & items */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--color-text)]">Dettaglio Economico</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Catalogo v{quote.catalogVersion}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <Row label="Imponibile Netto" value={eur(quote.priceExVatCents)} />
              <Row label={`IVA (${quote.vatRatePercent}%)`} value={eur(quote.priceCents - quote.priceExVatCents)} />
              <Row label="Totale Complessivo" value={<strong className="text-base text-[var(--color-mint)]">{eur(quote.priceCents)}</strong>} />
              {quote.installationPriceCents ? (
                <Row label="Posa in opera" value={eur(quote.installationPriceCents)} />
              ) : null}
              {quote.demolitionPriceCents ? (
                <Row label="Smaltimento / Dépose" value={eur(quote.demolitionPriceCents)} />
              ) : null}
              {quote.ecobonusPercent && quote.ecobonusPercent > 0 ? (
                <Row label={`Ecobonus ${quote.ecobonusPercent}%`} value={<span className="text-emerald-600 font-semibold">{eur(quote.ecobonusDeductionCents || 0)}</span>} />
              ) : null}
              {quote.maPrimeRenovPercent && quote.maPrimeRenovPercent > 0 ? (
                <Row label={`MaPrimeRénov' ${quote.maPrimeRenovPercent}%`} value={<span className="text-emerald-600 font-semibold">{eur(quote.maPrimeRenovDeductionCents || 0)}</span>} />
              ) : null}
            </dl>

            <div className="mt-4 space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
                  <p className="font-medium text-[var(--color-text)]">
                    {it.productType === "balconyDoor" ? "Porta-finestra" : "Finestra"} ·{" "}
                    {it.width}×{it.height} mm · ×{it.quantity ?? 1}
                  </p>
                  <p className="text-[var(--color-text-secondary)] mt-1 text-xs">
                    {[
                      it.material?.toUpperCase(),
                      it.glazing,
                      it.color,
                      it.insectScreen ? "zanzariera" : null,
                      it.sashes?.length ? `${it.sashes.length} ante` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              {items.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Nessun elemento registrato.</p>
              ) : null}
            </div>
          </section>

          {/* Internal notes */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="font-semibold text-[var(--color-text)]">Note Interne & Cronologia</h2>
            {quote.internalNotes ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)] font-sans">
                {quote.internalNotes.trim()}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Nessuna nota presente.</p>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Aggiungi una nota sul contatto o sopralluogo..."
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              />
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={() =>
                  guard(async () => {
                    await addNote({ quoteId, note: note.trim() });
                    setNote("");
                  })
                }
                className="rounded-lg bg-[var(--color-mint)] px-4 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                Aggiungi
              </button>
            </div>
          </section>
        </div>

        {/* Aside / Status & Assignment */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Stato Trattativa</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || s === quote.status}
                  onClick={() => guard(() => updateStatus({ quoteId, status: s }))}
                  className={
                    s === quote.status
                      ? "rounded-lg border border-[var(--color-mint)] bg-[var(--color-mint)] px-2.5 py-1 text-xs font-bold text-[var(--color-mint-dark)] shadow-sm"
                      : "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-text-secondary)] transition-colors"
                  }
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Assegnata a</h3>
            <select
              value={quote.assignedToUserId ?? ""}
              disabled={busy || members === undefined}
              onChange={(e) => {
                const uid = e.target.value;
                if (uid) guard(() => assignRequest({ quoteId, userId: uid as Id<"users"> }));
              }}
              className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">Non assegnata</option>
              {(members ?? [])
                .filter((m) => m.status === "active")
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userName ?? m.userId}
                  </option>
                ))}
            </select>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-xs text-[var(--color-text-secondary)] space-y-1">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Dettagli Tecnici</h3>
            {quote.sourceOrigin ? <p>Origine: {quote.sourceOrigin}</p> : null}
            <p>Turnstile: {quote.turnstileVerified ? "verificato" : "non verificato"}</p>
            {quote.spamScore !== undefined ? <p>Spam score: {quote.spamScore}</p> : null}
            <p>ID pubblico: {quote.publicId}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[var(--color-text-secondary)] text-xs">{label}</dt>
      <dd className="text-[var(--color-text)] font-medium mt-0.5">{value}</dd>
    </div>
  );
}
