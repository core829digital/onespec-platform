"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatCard } from "@/components/app-shell/stat-card";
import { RangeSwitcher, RANGE_LABEL, type AnalyticsRange } from "@/components/analytics/range-switcher";

const eur = (c: number) => `€${(c / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const FUNNEL_LABEL: Record<string, string> = {
  new: "Nuove",
  contacted: "Contattate",
  quoted: "Preventivo inviato",
  won: "Vinte",
};

export default function AnalyticsPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const [range, setRange] = useState<AnalyticsRange>("1m");
  const data = useQuery(
    api.analytics.getOverview,
    tenant ? { tenantId: tenant._id, range } : "skip",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">Analytics</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Dati reali del tuo account · {RANGE_LABEL[range]}
          </p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Aperture widget" value={data ? `${data.widgetViewsApprox ? "~" : ""}${data.widgetViews}` : undefined} />
        <StatCard label="Richieste" value={data ? String(data.totalRequests) : undefined} />
        <StatCard
          label="Conv. visite"
          value={data ? pct(data.visitorConversionRate) : undefined}
          accent
        />
        <StatCard label="Conv. lead→vinta" value={data ? pct(data.conversionRate) : undefined} />
        <StatCard label="Valore vinto" value={data ? eur(data.wonValueCents) : undefined} />
        <StatCard label="Valore medio" value={data ? eur(data.avgDealCents) : undefined} />
      </div>

      {data === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Caricamento...</p>
      ) : data.totalRequests === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nessuna richiesta nel periodo selezionato.
        </p>
      ) : (
        <>
          <Panel title="Andamento richieste">
            <TrendChart trend={data.trend} />
          </Panel>

          <Panel title="Imbuto di vendita" hint="Distribuzione delle richieste per fase attuale.">
            <div className="space-y-2">
              {data.funnel.map((f) => {
                const max = Math.max(...data.funnel.map((x) => x.count), 1);
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="w-36 text-sm text-[var(--color-text-secondary)] shrink-0">
                      {FUNNEL_LABEL[f.key]}
                    </span>
                    <div className="flex-1 h-6 rounded bg-[var(--color-bg)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-mint)]"
                        style={{ width: `${(f.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm text-[var(--color-text)] tabular-nums">
                      {f.count}
                    </span>
                  </div>
                );
              })}
            </div>
            <table className="sr-only">
              <caption>Imbuto di vendita</caption>
              <tbody>
                {data.funnel.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">{FUNNEL_LABEL[f.key]}</th>
                    <td>{f.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Per configuratore">
              <BreakdownTable
                rows={data.byConfigurator.map((c) => ({
                  label: c.name,
                  count: c.count,
                  extra: eur(c.valueCents),
                }))}
              />
            </Panel>
            <Panel title="Per sorgente">
              <BreakdownTable
                rows={data.bySource.map((s) => ({ label: s.host, count: s.count }))}
              />
            </Panel>
          </div>

          {data.truncated ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Analisi limitata alle {5000} richieste più recenti.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
      <h2 className="font-semibold text-[var(--color-text)]">{title}</h2>
      {hint ? <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TrendChart({ trend }: { trend: Array<{ label: string; count: number }> }) {
  const max = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-32" role="img" aria-label="Grafico andamento richieste">
      {trend.map((t, i) => (
        <div key={i} className="flex-1 group relative flex items-end">
          <div
            className="w-full bg-[var(--color-mint)]/70 group-hover:bg-[var(--color-mint)] rounded-t"
            style={{ height: `${Math.max((t.count / max) * 100, t.count > 0 ? 6 : 0)}%` }}
            title={`${t.label}: ${t.count}`}
          />
        </div>
      ))}
    </div>
  );
}

function BreakdownTable({
  rows,
}: {
  rows: Array<{ label: string; count: number; extra?: string }>;
}) {
  if (rows.length === 0) return <p className="text-sm text-[var(--color-text-secondary)]">Nessun dato.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-40 truncate text-[var(--color-text)] shrink-0" title={r.label}>
            {r.label}
          </span>
          <div className="flex-1 h-4 rounded bg-[var(--color-bg)] overflow-hidden">
            <div className="h-full bg-[var(--color-mint)]/60" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums text-[var(--color-text)]">{r.count}</span>
          {r.extra ? (
            <span className="w-16 text-right tabular-nums text-[var(--color-text-secondary)]">{r.extra}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
