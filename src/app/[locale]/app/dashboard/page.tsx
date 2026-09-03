"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/app-shell/stat-card";
import { EmptyState } from "@/components/app-shell/empty-state";
import { RangeSwitcher, RANGE_LABEL, type AnalyticsRange } from "@/components/analytics/range-switcher";
import { Eye, FileText, Percent, Trophy, Calculator } from "lucide-react";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const rel = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : undefined);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [range, setRange] = useState<AnalyticsRange>("1m");

  const overview = useQuery(
    api.analytics.getOverview,
    tenant ? { tenantId: tenant._id, range } : "skip",
  );
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 8 } : "skip",
  );

  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {t("subtitle")} · {RANGE_LABEL[range]}
          </p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          icon={Eye}
          label={t("widgetViews")}
          value={overview ? `${overview.widgetViewsApprox ? "~" : ""}${overview.widgetViews}` : undefined}
        />
        <StatCard
          icon={FileText}
          label={t("totalRequests")}
          value={overview ? String(overview.totalRequests) : undefined}
          delta={overview ? rel(overview.totalRequests, overview.previous.totalRequests) : undefined}
        />
        <StatCard
          icon={Percent}
          label={t("visitorConversion")}
          value={overview ? pct(overview.visitorConversionRate) : undefined}
          accent
        />
        <StatCard
          icon={Trophy}
          label={t("wonValue")}
          value={overview ? money(overview.wonValueCents) : undefined}
          delta={overview ? rel(overview.wonValueCents, overview.previous.wonValueCents) : undefined}
        />
        <StatCard icon={Calculator} label={t("avgValue")} value={overview ? money(overview.avgDealCents) : undefined} />
      </div>

      <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--color-text)]">{t("recentRequests")}</h2>
          <Link href="/app/requests" className="text-sm text-[var(--color-mint)] hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        {requests === undefined ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="h-4 w-40 rounded bg-[var(--color-border)]" />
                <div className="h-3 w-24 rounded bg-[var(--color-border)] mt-2" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState title={t("noRequests")} hint={t("noRequestsHint")} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {requests.map((req) => (
              <li key={req._id}>
                <Link
                  href={`/app/requests/${req._id}`}
                  className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-[var(--color-bg)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text)] truncate">{req.leadName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{req.leadEmail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-[var(--color-text)]">{money(req.priceCents)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {format.dateTime(new Date(req._creationTime), { dateStyle: "medium" })}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
