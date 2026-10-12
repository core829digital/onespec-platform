"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4";
const btn = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)] disabled:opacity-50";

export default function AdminContactsPage() {
  const t = useTranslations("supportAdmin");
  const locale = useLocale();
  const tf = useFriendlyError();
  const [status, setStatus] = useState<"new" | "handled">("new");
  const [error, setError] = useState("");
  const list = usePaginatedQuery(api.supportContact.list, { status }, { initialNumItems: 20 });
  const setHandled = useMutation(api.supportContact.setHandled);
  const remove = useMutation(api.supportContact.remove);
  const date = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const tab = (active: boolean) =>
    `min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${active ? "border-[var(--color-mint)] bg-[var(--color-bg-alt)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`;

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try { await fn(); } catch (e) { setError(tf(e)); }
  }

  return (
    <div className="space-y-5">
      <Link href="/app/admin/support" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← {t("back")}</Link>
      <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("contactsTitle")}</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("contactsHelp")}</p>
      <div className="flex gap-2">
        <button type="button" className={tab(status === "new")} onClick={() => setStatus("new")}>{t("contactsNew")}</button>
        <button type="button" className={tab(status === "handled")} onClick={() => setStatus("handled")}>{t("contactsHandled")}</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {list.status === "LoadingFirstPage" ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : list.results.length === 0 ? (
        <p className={`${card} text-sm text-[var(--color-text-secondary)]`}>{t("contactsEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {list.results.map((c) => (
            <li key={c._id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--color-text)]">{c.name} · <span className="font-normal text-[var(--color-text-secondary)]">{t(`topic_${c.topic}`)}</span></p>
                <span className="text-xs text-[var(--color-text-secondary)]">{date(c.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">{c.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className={btn} href={`mailto:${encodeURIComponent(c.email).replace("%40", "@")}?subject=${encodeURIComponent("Re: onespec")}`}>{t("replyByEmail")} · {c.email}</a>
                <button type="button" className={btn} onClick={() => run(() => setHandled({ id: c._id, handled: c.status === "new" }))}>{c.status === "new" ? t("markHandled") : t("reopen")}</button>
                <button type="button" className={btn} onClick={() => { if (window.confirm(t("deleteConfirm"))) run(() => remove({ id: c._id })); }}>{t("delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.status === "CanLoadMore" && <button type="button" className={btn} onClick={() => list.loadMore(20)}>{t("loadMore")}</button>}
    </div>
  );
}
