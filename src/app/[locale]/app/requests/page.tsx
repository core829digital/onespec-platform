"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Pagination } from "@/components/ui/Pagination";
import { useFriendlyError } from "@/lib/use-friendly-error";

const STATUSES = ["new", "contacted", "quoted", "won", "lost", "spam"] as const;
type Status = (typeof STATUSES)[number];

type SortKey = "date" | "value" | "name";

export default function RequestsPage() {
  const t = useTranslations("requests");
  const locale = useLocale();
  const tf = useFriendlyError();
  const router = useRouter();
  const STATUS_LABEL: Record<Status, string> = {
    new: t("statusNew"),
    contacted: t("statusContacted"),
    quoted: t("statusQuoted"),
    won: t("statusWon"),
    lost: t("statusLost"),
    spam: t("statusSpam"),
  };
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

  // Client-side pagination of the already-fetched (up to 200) list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pagedRows = rows?.slice((page - 1) * pageSize, page * pageSize);

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
        t("exportDone", { count: res.rowCount, truncated: res.truncated ? t("exportTruncated") : "" }),
      );
    } catch (e) {
      setMsg(tf(e));
    } finally {
      setExporting(false);
    }
  }

  const th = "text-left px-4 py-3 font-medium";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !rows || rows.length === 0}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-50"
        >
          {exporting ? t("exporting") : t("export")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setStatus("all"); setPage(1); }}
          className={chip(status === "all")}
        >
          {t("all")}
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => { setStatus(s); setPage(1); }} className={chip(status === s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder={t("searchPlaceholder")}
          className="flex-1 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="date">{t("sortDate")}</option>
          <option value="value">{t("sortValue")}</option>
          <option value="name">{t("sortName")}</option>
        </select>
      </div>

      {msg ? <p className="text-sm text-[var(--color-text-secondary)]">{msg}</p> : null}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]" aria-label={t("title")}>
<thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
              <tr>
                <th className={th}>{t("colClient")}</th>
                <th className={th}>{t("colEmail")}</th>
                <th className={th}>{t("colPhone")}</th>
                <th className={th}>{t("colCompany")}</th>
                <th className={`${th} text-right`}>{t("colValue")}</th>
                <th className={th}>{t("colStatus")}</th>
                <th className={`${th} text-right`}>{t("colDate")}</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows === undefined ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  {t("loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              pagedRows?.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => router.push(`/app/requests/${r._id}`)}
                  className="hover:bg-[var(--color-bg)] cursor-pointer"
                >
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.leadName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadEmail}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadPhone ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadCompany ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text)] tabular-nums">
                    {(r.priceCents / 100).toLocaleString(locale, { style: "currency", currency: "EUR" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                    {new Date(r._creationTime).toLocaleDateString(locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows && rows.length > 0 && (
        <Pagination
          totalItems={rows.length}
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

function chip(active: boolean) {
  return active
    ? "rounded-full border border-[var(--color-mint)] bg-[var(--color-mint)] px-3 py-1 text-xs font-bold text-[var(--color-mint-dark)] shadow-sm"
    : "rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-text-secondary)] transition-colors";
}
