"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/app-shell/stat-card";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 100 } : "skip",
  );

  const stats = useMemo(() => {
    if (!requests) return null;
    const active = requests.filter((r) => r.status !== "spam");
    const values = active.map((r) => r.priceCents).filter((c) => c > 0);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      total: active.length,
      pending: active.filter((r) => r.status === "new").length,
      avgCents: avg,
      thisMonth: active.filter((r) => r._creationTime >= monthStart.getTime()).length,
    };
  }, [requests]);

  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={t("totalRequests")} value={stats ? String(stats.total) : undefined} />
        <StatCard label={t("pending")} value={stats ? String(stats.pending) : undefined} accent={!!stats?.pending} />
        <StatCard label={t("avgValue")} value={stats ? money(stats.avgCents) : undefined} />
        <StatCard label={t("thisMonth")} value={stats ? String(stats.thisMonth) : undefined} />
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
            {requests.slice(0, 8).map((req) => (
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
