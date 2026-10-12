"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4";
const PERIODS = [7, 30, 90] as const;

/** 90 minutes → "1.5 h"; 40 minutes → "40 min"; 2 days → "2 d". Localised by Intl. */
function useDuration() {
  const locale = useLocale();
  return (ms: number | null) => {
    if (ms === null) return "—";
    const unit = ms >= 86_400_000 * 2 ? "day" : ms >= 3_600_000 ? "hour" : "minute";
    const value = unit === "day" ? ms / 86_400_000 : unit === "hour" ? ms / 3_600_000 : ms / 60_000;
    return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: unit === "minute" ? 0 : 1 }).format(value);
  };
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
  );
}

function Bars({ title, rows, total }: { title: string; rows: { label: string; n: number }[]; total: number }) {
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between gap-3 text-[var(--color-text)]"><span>{r.label}</span><span className="font-mono">{r.n}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div className="h-full rounded-full bg-[var(--color-mint)]" style={{ width: `${total ? Math.round((r.n / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SupportStatsPage() {
  const t = useTranslations("supportAdmin");
  const duration = useDuration();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const m = useQuery(api.supportAdmin.metrics, { days });
  const tab = (active: boolean) =>
    `min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${active ? "border-[var(--color-mint)] bg-[var(--color-bg-alt)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`;

  return (
    <div className="space-y-5">
      <Link href="/app/admin/support" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← {t("back")}</Link>
      <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("statsTitle")}</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("statsPeriod")}>
        {PERIODS.map((d) => <button key={d} type="button" onClick={() => setDays(d)} className={tab(days === d)}>{t("lastDays", { n: d })}</button>)}
      </div>

      {m === undefined ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : m.created === 0 ? (
        <p className={`${card} text-sm text-[var(--color-text-secondary)]`}>{t("statsEmpty")}</p>
      ) : (
        <>
          {m.truncated && <p className="text-xs text-[var(--color-text-secondary)]">{t("statsTruncated")}</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t("statCreated")} value={String(m.created)} />
            <Kpi label={t("statSolved")} value={String(m.solved)} hint={`${Math.round((m.solved / m.created) * 100)}%`} />
            <Kpi label={t("statFirstResponse")} value={duration(m.firstResponseMedianMs)} hint={t("statMedian")} />
            <Kpi label={t("statWithinTarget")} value={m.withinTargetPct === null ? "—" : `${m.withinTargetPct}%`} hint={t("statWithinTargetHint")} />
            <Kpi label={t("statSolveTime")} value={duration(m.solveMedianMs)} hint={t("statMedian")} />
            <Kpi label={t("statRating")} value={m.ratingAvg === null ? "—" : `${m.ratingAvg} / 5`} hint={t("statRatingCount", { n: m.ratingCount })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Bars title={t("statByCategory")} total={m.created} rows={SUPPORT_CATEGORIES.map((c) => ({ label: t(`cat_${c}`), n: m.byCategory[c] ?? 0 }))} />
            <Bars title={t("statByPriority")} total={m.created} rows={SUPPORT_PRIORITIES.map((p) => ({ label: t(`prio_${p}`), n: m.byPriority[p] ?? 0 }))} />
          </div>
        </>
      )}
    </div>
  );
}
