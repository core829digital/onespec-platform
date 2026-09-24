"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Pagination } from "@/components/ui/Pagination";

export default function QuotesPage() {
  const t = useTranslations("quotes.list");
  const locale = useLocale();
  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
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

  // Client-side pagination of the already-fetched (up to 500) list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pagedQuotes = fieldQuotes?.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <span className="text-xs text-[var(--color-text-secondary)]">{t("kicker")}</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mt-1">
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/app/quotes/new"
          className="rounded-xl bg-[var(--color-mint)] px-5 py-3 text-sm font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 transition-opacity"
        >
          {t("newQuote")}
        </Link>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("statTotal"), value: stats.total, color: "" },
            { label: t("statWon"), value: stats.won, color: "text-[var(--color-mint)]" },
            { label: t("statSigned"), value: stats.signed, color: "text-emerald-500" },
            { label: t("statValue"), value: fmt(stats.totalValue), color: "text-[var(--color-mint)]" },
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
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder={t("searchPlaceholder")}
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
          <p className="text-lg font-medium text-[var(--color-text-secondary)]">{t("empty")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("emptyHint")}{" "}
            <Link href="/app/quotes/new" className="text-[var(--color-mint)] hover:underline font-medium">
              {t("newQuote")}
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm" aria-label={t("colClient")}>
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 text-left">{t("colClient")}</th>
                <th className="px-4 py-3 text-left">{t("colCity")}</th>
                <th className="px-4 py-3 text-left">{t("colWindows")}</th>
                <th className="px-4 py-3 text-right">{t("colTotal")}</th>
                <th className="px-4 py-3 text-center">{t("colSignature")}</th>
                <th className="px-4 py-3 text-center">{t("colStatus")}</th>
                <th className="px-4 py-3 text-left">{t("colDate")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {pagedQuotes?.map((r) => {
                const items = Array.isArray(r.items) ? r.items : [];
                const date = new Date(r._creationTime).toLocaleDateString(locale, {
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
                      {items.length} {t("pieces")}
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
                            {t("sign")}
                          </Link>
                        )}
                        <Link
                          href={`/app/quotes/${r._id}/print`}
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
                        >
                          {t("pdf")}
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

      {fieldQuotes && fieldQuotes.length > 0 && (
        <Pagination
          totalItems={fieldQuotes.length}
          config={{ itemsPerPage: pageSize }}
          onPageChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
        />
      )}
    </div>
  );
}
