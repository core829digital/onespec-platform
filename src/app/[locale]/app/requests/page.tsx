"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { StatusBadge } from "@/components/app-shell/status-badge";

const STATUSES = ["new", "contacted", "quoted", "won", "lost", "spam"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABEL: Record<Status, string> = {
  new: "Nuove",
  contacted: "Contattate",
  quoted: "Preventivo inviato",
  won: "Vinte",
  lost: "Perse",
  spam: "Spam",
};

type SortKey = "date" | "value" | "name";

export default function RequestsPage() {
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [status, setStatus] = useState<Status | "all">("all");
  const requests = useQuery(
    api.quotes.listRequests,
    tenant
      ? { tenantId: tenant._id, limit: 200, ...(status !== "all" ? { status } : {}) }
      : "skip",
  );
  const exportCsv = useMutation(api.exports.exportRequestsCsv);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");

  const rows = useMemo(() => {
    if (!requests) return requests;
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? requests.filter(
          (r) =>
            r.leadName.toLowerCase().includes(needle) ||
            r.leadEmail.toLowerCase().includes(needle) ||
            (r.leadCompany ?? "").toLowerCase().includes(needle),
        )
      : [...requests];
    filtered.sort((a, b) => {
      if (sort === "value") return b.priceCents - a.priceCents;
      if (sort === "name") return a.leadName.localeCompare(b.leadName);
      return b._creationTime - a._creationTime;
    });
    return filtered;
  }, [requests, q, sort]);

  async function handleExport() {
    if (!tenant) return;
    setExporting(true);
    setMsg("");
    try {
      const res = await exportCsv({
        tenantId: tenant._id,
        ...(status !== "all" ? { status } : {}),
      });
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(
        `Esportate ${res.rowCount} righe${res.truncated ? " (troncato al massimo consentito)" : ""}.`,
      );
    } catch (e) {
      setMsg(
        e instanceof Error && /RATE_LIMITED/.test(e.message)
          ? "Limite di esportazioni orarie raggiunto. Riprova più tardi."
          : e instanceof Error
            ? e.message
            : "Errore nell'esportazione",
      );
    } finally {
      setExporting(false);
    }
  }

  const th = "text-left px-4 py-3 font-medium";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">Richieste</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Preventivi ricevuti dai widget</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !rows || rows.length === 0}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50"
        >
          {exporting ? "Esportazione..." : "Esporta CSV"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus("all")}
          className={chip(status === "all")}
        >
          Tutte
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={chip(status === s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome, email o azienda..."
          className="flex-1 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="date">Più recenti</option>
          <option value="value">Valore più alto</option>
          <option value="name">Nome (A-Z)</option>
        </select>
      </div>

      {msg ? <p className="text-sm text-[var(--color-text-secondary)]">{msg}</p> : null}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <tr>
              <th className={th}>Cliente</th>
              <th className={th}>Email</th>
              <th className={th}>Azienda</th>
              <th className={`${th} text-right`}>Valore</th>
              <th className={th}>Stato</th>
              <th className={`${th} text-right`}>Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows === undefined ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Caricamento...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Nessuna richiesta
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => router.push(`/app/requests/${r._id}`)}
                  className="hover:bg-[var(--color-bg)] cursor-pointer"
                >
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.leadName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadEmail}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadCompany ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text)] tabular-nums">
                    €{(r.priceCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                    {new Date(r._creationTime).toLocaleDateString("it-IT")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return active
    ? "rounded-full border border-[var(--color-mint)] bg-[var(--color-mint)] px-3 py-1 text-xs font-bold text-[var(--color-mint-dark)] shadow-sm"
    : "rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-text-secondary)] transition-colors";
}
