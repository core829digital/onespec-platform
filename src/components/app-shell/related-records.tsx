"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import type { Id } from "@/convex/_generated/dataModel";

export type RelatedTab = "quotes" | "surveys" | "inspections" | "installations";

export interface RelatedData {
  quotes: Array<{
    _id: Id<"quoteRequests">;
    leadName: string;
    priceCents: number;
    status: string;
    signedAt?: number;
    createdAt: number;
  }>;
  surveys: Array<{
    _id: Id<"siteSurveys">;
    customerName: string;
    status: string;
    openingsCount: number;
    createdAt: number;
  }>;
  inspections: Array<{
    _id: Id<"inspectionReports">;
    customerName: string;
    status: string;
    createdAt: number;
  }>;
  installations: Array<{
    _id: Id<"installationDossiers">;
    jobType: string;
    nodeType: string;
    createdAt: number;
  }>;
}

const NEW_ROUTE: Record<RelatedTab, { href: string; label: string }> = {
  quotes: { href: "/app/quotes/new", label: "newQuote" },
  surveys: { href: "/app/surveys", label: "newSurvey" },
  inspections: { href: "/app/inspections", label: "newInspection" },
  installations: { href: "/app/installations", label: "newInstallation" },
};

/**
 * The auto-created "sub-folders" of a client / cantiere: quotes, surveys,
 * inspections and installation dossiers tied to it, each with an open/print
 * link and a "new … for this client" button that arrives pre-linked
 * (`?clientId=` / `?cantiereId=` is read by ClientCantierePicker).
 */
export function RelatedRecords({
  data,
  tab,
  linkQuery,
}: {
  data: RelatedData;
  tab: RelatedTab;
  /** e.g. "clientId=abc" — appended to every "new …" link. */
  linkQuery: string;
}) {
  const t = useTranslations("folder");
  const format = useFormatter();
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium" });
  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const statusText = (s: string) => {
    const known = ["draft", "completed", "synced", "quoted", "won", "new", "contacted"];
    if (s === "signed") return t("signedStatus");
    if (s === "lost") return t("lostStatus");
    if (s === "new") return t("newStatus");
    return known.includes(s) ? t(s as "draft") : s;
  };

  const newLink = NEW_ROUTE[tab];
  const rows: Array<{ id: string; title: string; meta: string; href: string; badge?: ReactNode }> = [];

  if (tab === "quotes") {
    for (const q of data.quotes) {
      rows.push({
        id: q._id,
        title: q.leadName,
        meta: `${money(q.priceCents)} · ${date(q.createdAt)}`,
        href: `/app/quotes/${q._id}/print`,
        badge: (
          <span className={q.signedAt ? "text-emerald-600" : "text-amber-600"}>
            {q.signedAt ? t("signed") : t("awaitingSignature")}
          </span>
        ),
      });
    }
  } else if (tab === "surveys") {
    for (const s of data.surveys) {
      rows.push({
        id: s._id,
        title: s.customerName,
        meta: `${t("openingsCount", { count: s.openingsCount })} · ${date(s.createdAt)}`,
        href: "/app/surveys",
        badge: <span className="text-[var(--color-text-secondary)]">{statusText(s.status)}</span>,
      });
    }
  } else if (tab === "inspections") {
    for (const i of data.inspections) {
      rows.push({
        id: i._id,
        title: i.customerName,
        meta: date(i.createdAt),
        href: `/app/inspections/${i._id}/print`,
        badge: <span className="text-[var(--color-text-secondary)]">{statusText(i.status)}</span>,
      });
    }
  } else {
    for (const d of data.installations) {
      rows.push({
        id: d._id,
        title: `${d.jobType} · ${d.nodeType}`,
        meta: date(d.createdAt),
        href: `/app/installations/${d._id}/print`,
      });
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
      <div className="flex items-center justify-end border-b border-[var(--color-border)] px-4 py-3">
        <Link
          href={`${newLink.href}?${linkQuery}`}
          className="rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90"
        >
          + {t(newLink.label as "newQuote")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--color-text)]">{r.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{r.meta}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                {r.badge}
                <Link href={r.href} className="text-[var(--color-mint)] hover:underline">
                  {t("open")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
