"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { PriorityLabel, StatusBadge } from "@/components/support/ticket-badges";
import type { SupportStatus } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4";
const TABS: SupportStatus[] = ["open", "waiting", "resolved", "closed"];

export default function AdminSupportPage() {
  const t = useTranslations("supportAdmin");
  const locale = useLocale();
  const [status, setStatus] = useState<SupportStatus>("open");
  const [mine, setMine] = useState(false);
  const [now] = useState(() => Date.now());
  const stats = useQuery(api.supportAdmin.stats);
  const contactsNew = useQuery(api.supportContact.newCount);
  const list = usePaginatedQuery(api.supportAdmin.queue, { status, mine }, { initialNumItems: 20 });
  const date = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const tab = (active: boolean) =>
    `min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${active ? "border-[var(--color-mint)] bg-[var(--color-bg-alt)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <Link href="/app/admin/support/contacts" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">
          {t("contactsLink")}{contactsNew ? ` (${contactsNew})` : ""}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([["openCount", stats?.open], ["waitingCount", stats?.waiting], ["resolvedCount", stats?.resolved]] as const).map(([k, n]) => (
          <div key={k} className={card}>
            <p className="text-xs text-[var(--color-text-secondary)]">{t(k)}</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">{n ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={tab(status === s)}>{t(`status_${s}`)}</button>
        ))}
        <span className="mx-1 hidden w-px bg-[var(--color-border)] sm:block" />
        <button type="button" onClick={() => setMine(false)} className={tab(!mine)}>{t("all")}</button>
        <button type="button" onClick={() => setMine(true)} className={tab(mine)}>{t("mine")}</button>
      </div>

      {list.status === "LoadingFirstPage" ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : list.results.length === 0 ? (
        <p className={`${card} text-sm text-[var(--color-text-secondary)]`}>{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {list.results.map((tk) => {
            const overdue = !tk.firstResponseAt && tk.status === "open" && now - tk.createdAt > tk.slaHours * 3_600_000;
            return (
              <li key={tk._id}>
                <Link href={`/app/admin/support/${tk._id}`} className={`${card} block transition-colors hover:border-[var(--color-mint)]`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-[var(--color-text)]">
                      <span className="mr-2 font-mono text-xs text-[var(--color-text-secondary)]">TKT-{String(tk.number).padStart(4, "0")}</span>
                      {tk.unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-hidden />}
                      {tk.subject}
                    </span>
                    <span className="flex items-center gap-2">
                      <PriorityLabel priority={tk.priority} label={t(`prio_${tk.priority}`)} />
                      <StatusBadge status={tk.status} label={t(`status_${tk.status}`)} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {tk.tenantName} · {tk.requester} · {t(`cat_${tk.category}`)} · {date(tk.lastMessageAt)}
                    {overdue && <span className="ml-2 font-semibold text-red-600">{t("overdue")} ({t("sla", { h: tk.slaHours })})</span>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {list.status === "CanLoadMore" && (
        <button type="button" onClick={() => list.loadMore(20)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">{t("loadMore")}</button>
      )}
    </div>
  );
}
