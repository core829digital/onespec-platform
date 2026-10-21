"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { StatusBadge } from "@/components/support/ticket-badges";
import { AttachmentPicker, type PendingFile } from "@/components/support/attachments";
import { SUPPORT_CATEGORIES, SUPPORT_LIMITS, type SupportCategory } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5";
const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-base text-[var(--color-text)] focus:border-[var(--color-mint)] focus:outline-none";

export default function SupportPage() {
  const t = useTranslations("support");
  const locale = useLocale();
  const tf = useFriendlyError();
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const create = useMutation(api.support.create);
  const list = usePaginatedQuery(api.support.list, tenant ? { tenantId: tenant._id } : "skip", { initialNumItems: 20 });

  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid =
    subject.trim().length >= SUPPORT_LIMITS.subjectMin && body.trim().length >= SUPPORT_LIMITS.bodyMin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await create({ tenantId: tenant._id, subject, body, category, attachmentIds: files.map((f) => f.attachmentId), pagePath: window.location.pathname.replace(/^\/(it|en|fr|de|nl|ro)(?=\/)/, "") });
      router.push(`/app/support/${id}`);
    } catch (err) {
      setError(tf(err));
      setBusy(false);
    }
  }

  const date = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("subtitle")}</p>
      </div>

      <form onSubmit={submit} className={`${card} space-y-4`}>
        <h2 className="font-semibold text-[var(--color-text)]">{t("newTicket")}</h2>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--color-text)]">{t("category")}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} className={field}>
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`cat_${c}`)}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--color-text)]">{t("subject")}</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUPPORT_LIMITS.subjectMax} placeholder={t("subjectHint")} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--color-text)]">{t("message")}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={6} className={field} />
          <span className="flex justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>{t("messageHint")}</span>
            <span className="shrink-0">{t("chars", { n: body.length, max: SUPPORT_LIMITS.bodyMax })}</span>
          </span>
        </label>
        <AttachmentPicker tenantId={tenant?._id} value={files} onChange={setFiles} disabled={busy || !tenant} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={!valid || busy || !tenant} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-50">
          {busy ? t("sending") : t("send")}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold text-[var(--color-text)]">{t("yourTickets")}</h2>
        {list.status === "LoadingFirstPage" || !tenant ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
        ) : list.results.length === 0 ? (
          <p className={`${card} text-sm text-[var(--color-text-secondary)]`}>{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {list.results.map((tk) => (
              <li key={tk._id}>
                <Link href={`/app/support/${tk._id}`} className={`${card} block transition-colors hover:border-[var(--color-mint)]`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-[var(--color-text)]">
                      <span className="mr-2 font-mono text-xs text-[var(--color-text-secondary)]">TKT-{String(tk.number).padStart(4, "0")}</span>
                      {tk.subject}
                    </span>
                    <span className="flex items-center gap-2">
                      {tk.unread && <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent-ink)]">{t("unread")}</span>}
                      <StatusBadge status={tk.status} label={t(`status_${tk.status}`)} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(`cat_${tk.category}`)} · {date(tk.lastMessageAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {list.status === "CanLoadMore" && (
          <button type="button" onClick={() => list.loadMore(20)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">
            {t("loadMore")}
          </button>
        )}
      </section>
    </div>
  );
}
