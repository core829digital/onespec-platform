"use client";

import { useState, Suspense, lazy } from "react";
import { useQuery } from "convex/react";
import { useTranslations, useFormatter } from "next-intl";
import { api } from "@/convex/_generated/api";
import { RangeSwitcher, RANGE_LABEL, type AnalyticsRange } from "@/components/analytics/range-switcher";
import {
  Eye,
  FileText,
  Percent,
  Trophy,
  Calculator,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";

const PieChart = lazy(() => import("@/components/analytics/PieChart").then((m) => ({ default: m.PieChart })));
const FunnelChart = lazy(() => import("@/components/analytics/PieChart").then((m) => ({ default: m.FunnelChart })));
const PeakHoursHeatmap = lazy(() => import("@/components/analytics/PieChart").then((m) => ({ default: m.PeakHoursHeatmap })));
const TrendChart = lazy(() => import("@/components/analytics/PieChart").then((m) => ({ default: m.TrendChart })));
const StatsGrid = lazy(() => import("@/components/analytics/PieChart").then((m) => ({ default: m.StatsGrid })));

const eur = (c: number) => `€${(c / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const FUNNEL_LABEL: Record<string, string> = {
  new: "Nuove",
  contacted: "Contattate",
  quoted: "Preventivo inviato",
  won: "Vinte",
};

const FUNNEL_COLORS = {
  new: "#3b82f6",
  contacted: "#8b5cf6",
  quoted: "#f59e0b",
  won: "#10b981",
};

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

interface OverviewData {
  range: AnalyticsRange;
  previous: {
    totalRequests: number;
    won: number;
    wonValueCents: number;
    conversionRate: number;
    widgetViews: number;
    visitorConversionRate: number;
    avgDealCents: number;
  };
  totalRequests: number;
  widgetViews: number;
  widgetViewsApprox: boolean;
  visitorConversionRate: number;
  realLeads: number;
  won: number;
  lost: number;
  spam: number;
  conversionRate: number;
  wonValueCents: number;
  pipelineValueCents: number;
  avgDealCents: number;
  byStatus: Record<string, number>;
  funnel: Array<{ key: string; count: number }>;
  trend: Array<{ label: string; count: number; valueCents: number }>;
  byConfigurator: Array<{ name: string; count: number; valueCents: number }>;
  bySource: Array<{ host: string; count: number }>;
  truncated: boolean;
}

interface PeakHourData {
  hour: number;
  day: number;
  value: number;
}

const ChartSkeleton = () => (
  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 animate-pulse">
    <div className="h-6 w-40 rounded bg-[var(--color-border)] mb-4" />
    <div className="h-64 bg-[var(--color-border)] rounded" />
  </div>
);

const StatsSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div className="h-5 w-24 rounded bg-[var(--color-border)] mb-2" />
        <div className="h-8 w-32 rounded bg-[var(--color-border)]" />
      </div>
    ))}
  </div>
);

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const format = useFormatter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [range, setRange] = useState<AnalyticsRange>("1m");
  const overview = useQuery(
    api.analytics.getOverview,
    tenant ? { tenantId: tenant._id, range } : "skip",
  ) as OverviewData | undefined;
  const peakHours = useQuery(
    api.analytics.getPeakHours,
    tenant ? { tenantId: tenant._id, range } : "skip",
  ) as PeakHourData[] | undefined;

  if (!tenant) return null;

  const stats = overview ? [
    {
      label: t("widgetViews"),
      value: overview.widgetViewsApprox ? `~${overview.widgetViews}` : overview.widgetViews,
      icon: <Eye className="w-5 h-5" />,
      delta: overview.previous ? ((overview.widgetViews - overview.previous.widgetViews) / Math.max(overview.previous.widgetViews, 1)) * 100 : undefined,
      trend: (overview.previous && overview.widgetViews > overview.previous.widgetViews ? "up" : overview.previous && overview.widgetViews < overview.previous.widgetViews ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    {
      label: t("totalRequests"),
      value: overview.totalRequests,
      icon: <FileText className="w-5 h-5" />,
      delta: overview.previous ? ((overview.totalRequests - overview.previous.totalRequests) / Math.max(overview.previous.totalRequests, 1)) * 100 : undefined,
      trend: (overview.previous && overview.totalRequests > overview.previous.totalRequests ? "up" : overview.previous && overview.totalRequests < overview.previous.totalRequests ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    {
      label: t("visitorConversion"),
      value: pct(overview.visitorConversionRate),
      icon: <Percent className="w-5 h-5" />,
      accent: true,
      delta: overview.previous ? ((overview.visitorConversionRate - overview.previous.visitorConversionRate) / Math.max(overview.previous.visitorConversionRate, 0.001)) * 100 : undefined,
      trend: (overview.previous && overview.visitorConversionRate > overview.previous.visitorConversionRate ? "up" : overview.previous && overview.visitorConversionRate < overview.previous.visitorConversionRate ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    {
      label: t("conversionRate"),
      value: pct(overview.conversionRate),
      icon: <Trophy className="w-5 h-5" />,
      delta: overview.previous ? ((overview.conversionRate - overview.previous.conversionRate) / Math.max(overview.previous.conversionRate, 0.001)) * 100 : undefined,
      trend: (overview.previous && overview.conversionRate > overview.previous.conversionRate ? "up" : overview.previous && overview.conversionRate < overview.previous.conversionRate ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    {
      label: t("wonValue"),
      value: eur(overview.wonValueCents),
      icon: <TrendingUp className="w-5 h-5" />,
      delta: overview.previous ? ((overview.wonValueCents - overview.previous.wonValueCents) / Math.max(overview.previous.wonValueCents, 1)) * 100 : undefined,
      trend: (overview.previous && overview.wonValueCents > overview.previous.wonValueCents ? "up" : overview.previous && overview.wonValueCents < overview.previous.wonValueCents ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    {
      label: t("avgDeal"),
      value: eur(overview.avgDealCents),
      icon: <Calculator className="w-5 h-5" />,
      delta: overview.previous ? ((overview.avgDealCents - overview.previous.avgDealCents) / Math.max(overview.previous.avgDealCents, 1)) * 100 : undefined,
      trend: (overview.previous && overview.avgDealCents > overview.previous.avgDealCents ? "up" : overview.previous && overview.avgDealCents < overview.previous.avgDealCents ? "down" : "neutral") as "up" | "down" | "neutral",
    },
  ] : [];

  const funnelData = overview ? overview.funnel.map((f: { key: string; count: number }) => ({
    label: FUNNEL_LABEL[f.key] || f.key,
    value: f.count,
    color: FUNNEL_COLORS[f.key as keyof typeof FUNNEL_COLORS] || CHART_COLORS[0],
  })) : [];

  const pieData = overview ? overview.funnel.map((f: { key: string; count: number }, i: number) => ({
    label: FUNNEL_LABEL[f.key] || f.key,
    value: f.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) : [];

  const trendData = overview ? overview.trend.map((t: { label: string; count: number }) => ({
    label: t.label,
    value: t.count,
  })) : [];

  const peakHoursData = peakHours || [];

  const byConfiguratorData = overview ? overview.byConfigurator.map((c: { name: string; count: number }, i: number) => ({
    label: c.name,
    value: c.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {t("subtitle")} · {RANGE_LABEL[range]}
          </p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsGrid stats={stats} columns={6} />
      </Suspense>

      {overview === undefined ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 animate-pulse">
              <div className="h-6 w-40 rounded bg-[var(--color-border)] mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-[var(--color-border)] rounded" />
                <div className="h-32 bg-[var(--color-border)] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : overview.totalRequests === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] mb-4" />
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("noData")}</h2>
          <p className="text-[var(--color-text-secondary)]">{t("noDataHint")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <Suspense fallback={<ChartSkeleton />}>
                <PieChart
                  data={pieData}
                  title={t("funnelDistribution")}
                  size={240}
                  innerRadius={90}
                />
              </Suspense>
            </section>

            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <Suspense fallback={<ChartSkeleton />}>
                <FunnelChart
                  data={funnelData}
                  title={t("salesFunnel")}
                  showPercentages={true}
                />
              </Suspense>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <Suspense fallback={<ChartSkeleton />}>
                <TrendChart
                  data={trendData}
                  title={t("requestsTrend")}
                  color="var(--color-mint)"
                />
              </Suspense>
            </section>

            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <Suspense fallback={<ChartSkeleton />}>
                <PieChart
                  data={byConfiguratorData}
                  title={t("byConfigurator")}
                  size={240}
                  innerRadius={90}
                />
              </Suspense>
            </section>
          </div>

          {peakHoursData.length > 0 && (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <Suspense fallback={<ChartSkeleton />}>
                <PeakHoursHeatmap
                  data={peakHoursData}
                  title={t("peakHours")}
                />
              </Suspense>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <h2 className="font-semibold text-[var(--color-text)] mb-4">{t("byConfigurator")}</h2>
              <div className="space-y-3">
                {overview.byConfigurator.map((c: { name: string; count: number; valueCents: number }, i: number) => {
                  const max = Math.max(...overview.byConfigurator.map((x: { count: number }) => x.count), 1);
                  return (
                    <motion.div
                      key={c.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-40 truncate text-[var(--color-text)] shrink-0" title={c.name}>
                        {c.name}
                      </span>
                      <div className="flex-1 h-4 rounded bg-[var(--color-bg)] overflow-hidden">
                        <motion.div
                          layout
                          className="h-full transition-all duration-500"
                          style={{
                            background: CHART_COLORS[i % CHART_COLORS.length],
                            width: `${(c.count / max) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-[var(--color-text)]">{c.count}</span>
                      <span className="w-16 text-right tabular-nums text-[var(--color-text-secondary)]">{eur(c.valueCents)}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
              <h2 className="font-semibold text-[var(--color-text)] mb-4">{t("bySource")}</h2>
              <div className="space-y-3">
                {overview.bySource.map((s: { host: string; count: number }, i: number) => {
                  const max = Math.max(...overview.bySource.map((x: { count: number }) => x.count), 1);
                  return (
                    <motion.div
                      key={s.host}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-40 truncate text-[var(--color-text)] shrink-0" title={s.host}>
                        {s.host}
                      </span>
                      <div className="flex-1 h-4 rounded bg-[var(--color-bg)] overflow-hidden">
                        <motion.div
                          layout
                          className="h-full transition-all duration-500"
                          style={{
                            background: CHART_COLORS[i % CHART_COLORS.length],
                            width: `${(s.count / max) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-[var(--color-text)]">{s.count}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>

          {overview.truncated && (
            <p className="text-xs text-[var(--color-text-secondary)] text-center">
              {t("truncatedNotice", { count: 5000 })}
            </p>
          )}
        </>
      )}
    </div>
  );
}