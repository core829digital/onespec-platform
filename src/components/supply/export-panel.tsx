"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildSupplyCsv, supplyCsvName } from "@/shared/supply-export";
import { useEuro } from "./money";

const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOfDay = (isoDate: string) => Date.parse(`${isoDate}T00:00:00.000Z`);
const endOfDay = (isoDate: string) => Date.parse(`${isoDate}T23:59:59.999Z`);
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Preset = "month" | "quarter" | "year" | "lastYear";

/** First day (UTC) of the period a preset names, and its last day. */
export function presetRange(preset: Preset, now: number): { from: string; to: string } {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const range = (fy: number, fm: number, ty: number, tm: number) => ({ from: iso(Date.UTC(fy, fm, 1)), to: iso(Date.UTC(ty, tm + 1, 0)) });
  if (preset === "month") return range(y, m, y, m);
  if (preset === "quarter") {
    const q = Math.floor(m / 3) * 3;
    return range(y, q, y, q + 2);
  }
  if (preset === "year") return range(y, 0, y, 11);
  return range(y - 1, 0, y - 1, 11);
}

/** Download of the supplies delivered in a period, as a CSV for the accountant. */
export function ExportPanel({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("supply.export");
  const locale = useLocale();
  const euro = useEuro();
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState(() => presetRange("year", now));
  const valid = VALID_DATE.test(range.from) && VALID_DATE.test(range.to) && !Number.isNaN(startOfDay(range.from)) && !Number.isNaN(endOfDay(range.to)) && startOfDay(range.from) <= endOfDay(range.to) && endOfDay(range.to) - startOfDay(range.from) <= 10 * 366 * DAY;
  const rows = useQuery(api.supplies.exportRows, valid ? { tenantId, from: startOfDay(range.from), to: endOfDay(range.to) } : "skip");
  const built = useMemo(() => (rows ? buildSupplyCsv(rows, locale) : null), [rows, locale]);

  function download() {
    if (!built || built.rows === 0) return;
    const url = URL.createObjectURL(new Blob([built.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = supplyCsvName(startOfDay(range.from), endOfDay(range.to));
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4" data-testid="export-panel">
      <h3 className="font-semibold text-[var(--color-text)]">{t("title")}</h3>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
      <div className="flex flex-wrap gap-2">
        {(["month", "quarter", "year", "lastYear"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setRange(presetRange(p, now))} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg)]">
            {t(`preset.${p}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {t("from")}
          <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1 block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
        </label>
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {t("to")}
          <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1 block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
        </label>
        <button type="button" disabled={!built || built.rows === 0} onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50">
          <Download size={15} aria-hidden="true" />
          {t("download")}
        </button>
      </div>
      {!valid ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">{t("invalidRange")}</p>
      ) : built ? (
        <p className="text-xs text-[var(--color-text-secondary)]" role="status">
          {built.rows === 0 ? t("none") : t("summary", { count: built.rows, revenue: euro(built.totals.revenueExVatCents), profit: euro(built.totals.profitCents) })}
        </p>
      ) : null}
      <p className="text-xs text-[var(--color-text-secondary)]">{t("note")}</p>
    </section>
  );
}
