"use client";

import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { usePlanAccess } from "@/lib/plan-gates";
import { StatCard } from "@/components/app-shell/stat-card";
import { EmptyState } from "@/components/app-shell/empty-state";
import { RangeSwitcher, RANGE_LABEL, type AnalyticsRange } from "@/components/analytics/range-switcher";
import {
  Eye,
  FileText,
  Percent,
  Trophy,
  Calculator,
  Gauge,
  Truck,
  Users,
  Building2,
  PenLine,
  Contact,
  Package,
} from "lucide-react";

const PieChart = lazy(() =>
  import("@/components/analytics/PieChart").then((m) => ({ default: m.PieChart })),
);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const rel = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : undefined);

const TYPE_LABELS: Record<string, string> = {
  private: "Privato",
  company: "Azienda",
  developer: "Costruttore",
  architect: "Architetto",
  contractor: "Impresa",
};

const CATEGORY_COLORS: Record<string, string> = {
  private: "#10b981",
  company: "#3b82f6",
  developer: "#8b5cf6",
  architect: "#f59e0b",
  contractor: "#f97316",
  unlinked: "#9a9aa0",
};

function UsageBar({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const finite = Number.isFinite(limit);
  const ratio = finite && limit > 0 ? Math.min(used / limit, 1) : 0;
  const over = finite && used >= limit;
  const warn = finite && used >= limit * 0.8 && !over;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="tabular-nums font-medium text-[var(--color-text)]">
          {used} / {finite ? limit : "∞"}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            over ? "bg-[var(--color-danger)]" : warn ? "bg-amber-500" : "bg-[var(--color-mint)]"
          }`}
          style={{ width: finite ? `${ratio * 100}%` : "100%" }}
        />
      </div>
    </div>
  );
}

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
  const planUsage = useQuery(
    api.analytics.getPlanUsage,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  // Modules the plan locks (widget-first plans) are skipped, not queried: the
  // server would refuse them and the dashboard must keep working.
  const access = usePlanAccess(tenant?._id);
  const logisticsSummary = useQuery(
    api.logistics.getLogisticsSummary,
    tenant && access && !access.isLocked("logistics") ? { tenantId: tenant._id } : "skip",
  );
  const clients = useQuery(
    api.clients.listClients,
    tenant && access && !access.isLocked("crm") ? { tenantId: tenant._id, limit: 200 } : "skip",
  );
  const members = useQuery(
    api.tenants.listMembers,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const cantieriLocked = access ? access.isLocked("cantieri") : false;
  const cantieri = useQuery(
    api.cantieri.listCantieri,
    tenant && access && !cantieriLocked ? { tenantId: tenant._id, limit: 6 } : "skip",
  );
  // Quick actions / panels only for modules the plan includes (Level plans
  // lock B2B quotes, CRM and cantieri — those links would open a lock page).
  const can = (f: "fieldQuotes" | "crm" | "cantieri") => !!access && !access.isLocked(f);

  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  // Requests grouped by the linked client's category (G2 clientId link).
  const categoryData = useMemo(() => {
    if (!requests || !clients) return [];
    const typeById = new Map(clients.map((c) => [c._id, c.type]));
    const counts = new Map<string, number>();
    for (const r of requests) {
      const key = r.clientId ? (typeById.get(r.clientId) ?? "unlinked") : "unlinked";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        label: key === "unlinked" ? t("unlinked") : (TYPE_LABELS[key] ?? key),
        value,
        color: CATEGORY_COLORS[key] ?? "#9a9aa0",
      }));
  }, [requests, clients, t]);

  // How many open (non-"chiuso") cantieri each active team member is
  // assigned to — real data from cantieri.assignedUserIds, not invented.
  const openCantieriPerMember = useMemo(() => {
    if (!cantieri) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const c of cantieri) {
      if (c.status === "chiuso") continue;
      for (const uid of c.assignedUserIds) counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    return counts;
  }, [cantieri]);

  const clientNameById = useMemo(() => {
    if (!clients) return new Map<string, string>();
    return new Map(clients.map((c) => [c._id, c.name]));
  }, [clients]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {t("subtitle")} · {RANGE_LABEL[range]}
          </p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {/* Quick actions — Fitt's Law: the most common next steps sit right
          under the page title, one click away, instead of buried in nav. */}
      <div className="flex flex-wrap gap-2">
{can("fieldQuotes") ? (
        <Link
          href="/app/quotes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] transition-opacity hover:opacity-90"
        >
          <PenLine className="h-4 w-4" />
          {t("quickActions.newQuote")}
        </Link>
        ) : null}
{can("crm") ? (
        <Link
          href="/app/clients?new=1"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
        >
          <Contact className="h-4 w-4" />
          {t("quickActions.newClient")}
        </Link>
        ) : null}
{can("cantieri") ? (
        <Link
          href="/app/cantieri?new=1"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
        >
          <Building2 className="h-4 w-4" />
          {t("quickActions.newCantiere")}
        </Link>
        ) : null}
        <Link
          href="/app/configurators"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
        >
          <Package className="h-4 w-4" />
          {t("quickActions.newConfigurator")}
        </Link>
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

      {(planUsage !== undefined || logisticsSummary !== undefined || categoryData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {planUsage && (
            <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[var(--color-mint-text)]" />
                  {t("planUsage")}
                </h2>
                <span className="rounded-full bg-[var(--color-mint-light)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-mint-text)]">
                  {planUsage.plan}
                </span>
              </div>
              <div className="space-y-4">
                <UsageBar
                  label={t("quotesThisMonth")}
                  used={planUsage.quotes.used}
                  limit={planUsage.quotes.limit}
                />
                <UsageBar
                  label={t("configuratorsUsed")}
                  used={planUsage.configurators.used}
                  limit={planUsage.configurators.limit}
                />
                <UsageBar
                  label={t("teamMembers")}
                  used={planUsage.members.used}
                  limit={planUsage.members.limit}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
                <p className="text-xs text-[var(--color-text-secondary)]">{t("planCtaHint")}</p>
                <Link
                  href="/app/account/billing?tab=plan"
                  className="inline-flex items-center rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] transition-opacity hover:opacity-90"
                >
                  {t("viewSubscription")}
                </Link>
              </div>
            </section>
          )}
          {logisticsSummary ? (
            <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-[var(--color-mint-text)]" />
                {t("logisticsSummary.title")}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label={t("logisticsSummary.upcoming")} value={String(logisticsSummary.upcomingDeliveries7d)} />
                <StatCard label={t("logisticsSummary.receivedMonth")} value={String(logisticsSummary.receivedThisMonth)} />
                <StatCard label={t("logisticsSummary.inStock")} value={String(logisticsSummary.itemsInStock)} />
              </div>
              <div className="mt-4 flex justify-end border-t border-[var(--color-border)] pt-4">
                <Link href="/app/logistics" className="text-sm font-medium text-[var(--color-mint-text)] hover:underline">
                  {t("logisticsSummary.viewAll")}
                </Link>
              </div>
            </section>
          ) : null}
          {categoryData.length > 0 && (
            <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="font-semibold text-[var(--color-text)] mb-4">
                {t("requestsByCategory")}
              </h2>
              <Suspense
                fallback={
                  <div className="h-48 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
                  </div>
                }
              >
                <PieChart data={categoryData} size={200} innerRadius={75} showLegend />
              </Suspense>
            </section>
          )}
        </div>
      )}

      {/* Team & cantieri — real data straight from tenants.listMembers and
          cantieri.listCantieri (the same queries the Team and Cantieri
          pages themselves use), not a separate/invented data source. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-mint-text)]" />
              {t("team.title")}
            </h2>
            <Link href="/app/account/team" className="text-sm text-[var(--color-mint-text)] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          {members === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--color-bg)]" />
              ))}
            </div>
          ) : members.filter((m) => m.status === "active").length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("team.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {members
                .filter((m) => m.status === "active")
                .map((m) => (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-bg)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-mint-light)] text-xs font-bold text-[var(--color-mint-text)]">
                        {(m.userName ?? m.userEmail ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text)]">
                          {m.userName ?? m.userEmail}
                        </p>
                        <p className="truncate text-xs capitalize text-[var(--color-text-secondary)]">{m.role}</p>
                      </div>
                    </div>
                    {!cantieriLocked ? (
                      <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {t("team.openCantieri", { count: openCantieriPerMember.get(m.userId) ?? 0 })}
                      </span>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
        </section>

{!cantieriLocked ? (
        <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--color-mint-text)]" />
              {t("cantieriPanel.title")}
            </h2>
            <Link href="/app/cantieri" className="text-sm text-[var(--color-mint-text)] hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          {cantieri === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--color-bg)]" />
              ))}
            </div>
          ) : cantieri.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("cantieriPanel.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {cantieri.map((c) => (
                <li key={c._id}>
                  <Link
                    href={`/app/cantieri/${c._id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-bg)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-text)]">{c.name}</p>
                      <p className="truncate text-xs text-[var(--color-text-secondary)]">
                        {c.clientId ? (clientNameById.get(c.clientId) ?? c.city) : c.city}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {t(`cantieriPanel.status.${c.status}`)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}
      </div>

      <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--color-text)]">{t("recentRequests")}</h2>
          <Link href="/app/requests" className="text-sm text-[var(--color-mint-text)] hover:underline">
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