"use client";

import { use, useState } from "react";
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

  return (
    <div className="space-y-6">
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
        {quote.overQuota ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
            Oltre quota piano
          </span>
        ) : null}
        <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
          {new Date(quote._creationTime).toLocaleString("it-IT")}
        </span>
      </div>

      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="font-semibold text-[var(--color-text)]">Contatto</h2>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="Email" value={<a href={`mailto:${quote.leadEmail}`} className="text-[var(--color-mint)]">{quote.leadEmail}</a>} />
              {quote.leadPhone ? <Row label="Telefono" value={quote.leadPhone} /> : null}
              {quote.leadCompany ? <Row label="Azienda" value={quote.leadCompany} /> : null}
              <Row label="Lingua" value={quote.leadLocale.toUpperCase()} />
            </dl>
            {quote.leadMessage ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap border-l-2 border-[var(--color-border)] pl-3">
                {quote.leadMessage}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--color-text)]">Preventivo</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Catalogo v{quote.catalogVersion}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="Imponibile" value={eur(quote.priceExVatCents)} />
              <Row label={`IVA ${quote.vatRatePercent}%`} value={eur(quote.priceCents - quote.priceExVatCents)} />
              <Row label="Totale" value={<strong className="text-[var(--color-text)]">{eur(quote.priceCents)}</strong>} />
              {quote.clientReportedPriceCents !== undefined &&
              quote.clientReportedPriceCents !== quote.priceCents ? (
                <Row
                  label="Prezzo widget"
                  value={
                    <span className="text-amber-500">
                      {eur(quote.clientReportedPriceCents)} (ricalcolato dal server)
                    </span>
                  }
                />
              ) : null}
            </dl>

            <div className="mt-4 space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
                  <p className="font-medium text-[var(--color-text)]">
                    {it.productType === "balconyDoor" ? "Porta-finestra" : "Finestra"} ·{" "}
                    {it.width}×{it.height} mm · ×{it.quantity ?? 1}
                  </p>
                  <p className="text-[var(--color-text-secondary)] mt-1">
                    {[
                      it.material,
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

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="font-semibold text-[var(--color-text)]">Note interne</h2>
            {quote.internalNotes ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)] font-sans">
                {quote.internalNotes.trim()}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Nessuna nota.</p>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Aggiungi una nota..."
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

        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Stato</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || s === quote.status}
                  onClick={() => guard(() => updateStatus({ quoteId, status: s }))}
                  className={
                    s === quote.status
                      ? "rounded-lg border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-2.5 py-1 text-xs text-[var(--color-mint)]"
                      : "rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
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
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Provenienza</h3>
            {quote.sourceOrigin ? <p>Origine: {quote.sourceOrigin}</p> : null}
            <p>Turnstile: {quote.turnstileVerified ? "verificato" : "non verificato"}</p>
            {quote.spamScore !== undefined ? <p>Spam score: {quote.spamScore}</p> : null}
            <p>/w/{quote.publicId}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
