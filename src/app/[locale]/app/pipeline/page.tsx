"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";

const COLUMNS = ["new", "contacted", "quoted", "won", "lost"] as const;
type Col = (typeof COLUMNS)[number];
const LABEL: Record<Col, string> = {
  new: "Nuove",
  contacted: "Contattate",
  quoted: "Preventivo inviato",
  won: "Vinte",
  lost: "Perse",
};

const eur = (c: number) =>
  `€${(c / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;

type Req = {
  _id: string;
  _creationTime: number;
  leadName: string;
  leadCompany?: string;
  priceCents: number;
  status: string;
};

export default function PipelinePage() {
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 200 } : "skip",
  ) as Req[] | undefined;
  const updateStatus = useMutation(api.quotes.updateStatus);

  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Col>>({});
  const [err, setErr] = useState("");

  const board = useMemo(() => {
    const b: Record<Col, Req[]> = { new: [], contacted: [], quoted: [], won: [], lost: [] };
    for (const r of requests ?? []) {
      const col = (pending[r._id] ?? r.status) as Col;
      if (col in b) b[col].push(r);
    }
    return b;
  }, [requests, pending]);

  async function move(id: string, to: Col, from: string) {
    if (to === from) return;
    setPending((p) => ({ ...p, [id]: to }));
    setErr("");
    try {
      await updateStatus({ quoteId: id as never, status: to });
    } catch (e) {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setErr(e instanceof Error ? e.message : "Errore nello spostamento");
    }
  }

  if (requests === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">Pipeline commerciale</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Trascina una scheda o usa i controlli per cambiare fase. Ogni spostamento è registrato.
        </p>
      </div>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const cards = board[col];
          const total = cards.reduce((s, c) => s + c.priceCents, 0);
          return (
            <section
              key={col}
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={() => {
                const card = (requests ?? []).find((r) => r._id === dragId);
                if (card) move(card._id, col, pending[card._id] ?? card.status);
                setDragId(null);
              }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] flex flex-col min-h-[160px]"
              aria-label={LABEL[col]}
            >
              <header className="px-3 py-2 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{LABEL[col]}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{cards.length}</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] tabular-nums mt-0.5">{eur(total)}</p>
              </header>

              <div className="p-2 space-y-2 flex-1">
                {cards.map((c) => {
                  const cur = (pending[c._id] ?? c.status) as Col;
                  const idx = COLUMNS.indexOf(cur);
                  return (
                    <article
                      key={c._id}
                      draggable
                      onDragStart={() => setDragId(c._id)}
                      onDragEnd={() => setDragId(null)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" && idx < COLUMNS.length - 1)
                          move(c._id, COLUMNS[idx + 1], cur);
                        if (e.key === "ArrowLeft" && idx > 0) move(c._id, COLUMNS[idx - 1], cur);
                        if (e.key === "Enter") router.push(`/app/requests/${c._id}`);
                      }}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-sm cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/50"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/app/requests/${c._id}`)}
                        className="font-medium text-[var(--color-text)] hover:underline text-left"
                      >
                        {c.leadName}
                      </button>
                      {c.leadCompany ? (
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{c.leadCompany}</p>
                      ) : null}
                      <p className="text-xs text-[var(--color-text)] tabular-nums mt-1">{eur(c.priceCents)}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => move(c._id, COLUMNS[idx - 1], cur)}
                          aria-label="Fase precedente"
                          className="rounded border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-text-secondary)] disabled:opacity-30"
                        >
                          ←
                        </button>
                        <select
                          value={cur}
                          onChange={(e) => move(c._id, e.target.value as Col, cur)}
                          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-1.5 py-1 text-xs text-[var(--color-text)]"
                          aria-label={`Fase di ${c.leadName}`}
                        >
                          {COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={idx === COLUMNS.length - 1}
                          onClick={() => move(c._id, COLUMNS[idx + 1], cur)}
                          aria-label="Fase successiva"
                          className="rounded border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-text-secondary)] disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                    </article>
                  );
                })}
                {cards.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] px-1 py-4 text-center">Vuota</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
