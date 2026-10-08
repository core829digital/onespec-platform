"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";

type Status = "pending" | "qualified" | "rewarded" | "rejected" | "expired" | "clawback";
const STATUSES: Status[] = ["pending", "qualified", "rewarded", "rejected", "expired", "clawback"];
const TONE: Record<Status, string> = {
  pending: "bg-[var(--color-bg)] text-[var(--color-text-secondary)]",
  qualified: "bg-amber-500/15 text-amber-500",
  rewarded: "bg-[var(--color-mint)]/15 text-[var(--color-mint-text)]",
  rejected: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  expired: "bg-[var(--color-bg)] text-[var(--color-text-secondary)]",
  clawback: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

/** One CSV cell: quoted, quotes doubled, and a leading = + - @ neutralised against spreadsheet formulas. */
function cell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export default function AdminReferralsPage() {
  const t = useTranslations("adminReferrals");
  const locale = useLocale();
  const run = useRunAction();
  const viewer = useQuery(api.users.viewer);
  const [status, setStatus] = useState<Status | "">("");
  const isAdmin = viewer?.isPlatformAdmin === true;
  const rows = useQuery(api.referrals.adminListReferrals, isAdmin ? (status ? { status } : {}) : "skip");
  const reject = useMutation(api.referrals.adminReject);
  const reopen = useMutation(api.referrals.adminReopen);
  const setCodeDisabled = useMutation(api.referrals.adminSetCodeDisabled);

  const eur = (c: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(c / 100);
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale);

  if (viewer === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (!isAdmin) return <p className="text-sm text-[var(--color-text-secondary)]">{t("forbidden")}</p>;

  function exportCsv() {
    if (!rows) return;
    const head = ["id", "status", "reason", "code", "created", "qualified", "holdUntil", "rewardEur", "referrer", "referrerEmail", "referred", "referredEmail"];
    const lines = rows.map((r) =>
      [r.id, r.status, r.reason, r.code, new Date(r.createdAt).toISOString(), r.qualifiedAt ? new Date(r.qualifiedAt).toISOString() : "", r.holdUntil ? new Date(r.holdUntil).toISOString() : "", r.rewardCents !== null ? (r.rewardCents / 100).toFixed(2) : "", r.referrer.name, r.referrer.email, r.referred.name, r.referred.email].map(cell).join(","),
    );
    const url = URL.createObjectURL(new Blob([[head.map(cell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "referrals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/admin" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label={t("back")}>←</Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | "")} aria-label={t("filter")} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]">
            <option value="">{t("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!rows?.length}>{t("exportCsv")}</Button>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("hint")}</p>

      {rows === undefined ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[r.status as Status]}`}>{t(`status.${r.status as Status}`)}</span>
                  {r.reason ? <span className="font-mono text-xs text-[var(--color-text-secondary)]">{r.reason}</span> : null}
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">{r.code}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{day(r.createdAt)}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("referrer")}</p>
                  <p className="truncate font-medium text-[var(--color-text)]">{r.referrer.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{r.referrer.email} · {r.referrer.plan}/{r.referrer.planStatus}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("referred")}</p>
                  <p className="truncate font-medium text-[var(--color-text)]">{r.referred.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{r.referred.email} · {r.referred.plan}/{r.referred.planStatus}</p>
                </div>
              </div>
              {r.rewardCents !== null || r.holdUntil || r.clawbackNote ? (
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {r.rewardCents !== null ? `${t("credit")}: ${eur(r.rewardCents)}${r.payoutMethod ? ` (${t(`method.${r.payoutMethod}`)})` : ""}` : ""}
                  {r.holdUntil ? ` · ${t("holdUntil")}: ${day(r.holdUntil)}` : ""}
                  {r.clawbackNote ? ` · ${r.clawbackNote}` : ""}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "pending" || r.status === "qualified" ? (
                  <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("confirmReject"))) void run(reject({ referralId: r.id as Id<"referrals"> })); }}>
                    {t("reject")}
                  </Button>
                ) : null}
                {r.status === "rejected" || r.status === "expired" ? (
                  <Button size="sm" variant="ghost" onClick={() => void run(reopen({ referralId: r.id as Id<"referrals"> }))}>{t("reopen")}</Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("confirmDisable"))) void run(setCodeDisabled({ tenantId: r.referrer.tenantId, disabled: true })); }}>
                  {t("disableCode")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void run(setCodeDisabled({ tenantId: r.referrer.tenantId, disabled: false }))}>{t("enableCode")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
