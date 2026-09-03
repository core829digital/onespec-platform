"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/app-shell/status-badge";

function fmt(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function QuotesPage() {
  const tenant = useQuery(api.tenants.getMyTenant);

  // Field quotes only: channel = "field_b2b" OR status = "quoted" / "won" (signed)
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 500 } : "skip",
  );

  const [q, setQ] = useState("");

  const fieldQuotes = useMemo(() => {
    if (!requests) return requests;
    const needle = q.trim().toLowerCase();
    const filtered = requests.filter(
      (r) =>
        r.channel === "field_b2b" ||
        r.status === "quoted" ||
        r.status === "won",
    );
    if (!needle) return filtered;
    return filtered.filter(
      (r) =>
        r.leadName.toLowerCase().includes(needle) ||
        r.leadEmail.toLowerCase().includes(needle) ||
        (r.customerCity ?? "").toLowerCase().includes(needle),
    );
  }, [requests, q]);

  const stats = useMemo(() => {
    if (!fieldQuotes) return null;
    const won = fieldQuotes.filter((r) => r.status === "won");
    const signed = won.filter((r) => !!r.signedAt);
    const total = fieldQuotes.reduce((acc, r) => acc + r.priceCents, 0);
    return {
      total: fieldQuotes.length,
      won: won.length,
      signed: signed.length,
      totalValue: total,
    };
  }, [fieldQuotes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[var(--color-mint)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-mint)] uppercase tracking-wider">
              Fase 21 · Italia (IT)
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">Strumento B2B da Cantiere</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mt-1">
            Preventivi da Cantiere (B2B Rapido)
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Preventivi generati con firma digitale on-site. Norma UNI 11673 · Ecobonus · IVA agevolata.
          </p>
        </div>
        <Link
          href="/app/quotes/new"
          className="rounded-xl bg-[var(--color-mint)] px-5 py-3 text-sm font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 transition-opacity"
        >
          + Nuovo Preventivo Cantiere
        </Link>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Totale Preventivi", value: stats.total, color: "" },
            { label: "Vinti", value: stats.won, color: "text-[var(--color-mint)]" },
            { label: "Firmati dal Cliente", value: stats.signed, color: "text-emerald-500" },
            { label: "Valore Totale", value: fmt(stats.totalValue), color: "text-[var(--color-mint)]" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color || "text-[var(--color-text)]"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome, email o città…"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)]"
        />
      </div>

      {/* Table */}
      {!fieldQuotes ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
        </div>
      ) : fieldQuotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] p-12 text-center">
          <p className="text-lg font-medium text-[var(--color-text-secondary)]">Nessun preventivo ancora.</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Inizia con il pulsante{" "}
            <Link href="/app/quotes/new" className="text-[var(--color-mint)] hover:underline font-medium">
              + Nuovo Preventivo Cantiere
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Città / CAP</th>
                <th className="px-4 py-3 text-left">Serramenti</th>
                <th className="px-4 py-3 text-right">Totale</th>
                <th className="px-4 py-3 text-center">Firma</th>
                <th className="px-4 py-3 text-center">Stato</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {fieldQuotes.map((r) => {
                const items = Array.isArray(r.items) ? r.items : [];
                const date = new Date(r._creationTime).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <tr key={r._id} className="bg-[var(--color-bg)] hover:bg-[var(--color-bg-alt)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text)]">{r.leadName}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{r.leadEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {r.customerCity ?? "—"}
                      {r.customerPostalCode ? ` ${r.customerPostalCode}` : ""}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {items.length} pz
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--color-text)]">
                      {fmt(r.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.signedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ✅ {r.signedByName?.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                      {date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!r.signedAt && (
                          <Link
                            href={`/app/quotes/${r._id}/sign`}
                            className="rounded-lg border border-[var(--color-mint)] px-2 py-1 text-xs font-semibold text-[var(--color-mint)] hover:bg-[var(--color-mint)]/10"
                          >
                            ✍️ Firma
                          </Link>
                        )}
                        <Link
                          href={`/app/quotes/${r._id}/print`}
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
                        >
                          🖨️ PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
