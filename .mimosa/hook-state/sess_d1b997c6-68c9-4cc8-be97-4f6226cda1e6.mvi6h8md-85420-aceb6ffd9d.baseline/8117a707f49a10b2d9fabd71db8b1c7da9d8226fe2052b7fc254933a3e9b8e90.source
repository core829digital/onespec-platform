"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { StatusBadge } from "@/components/support/ticket-badges";
import { AttachmentList, AttachmentPicker, type PendingFile } from "@/components/support/attachments";
import { SUPPORT_LIMITS } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5";
const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-base text-[var(--color-text)] focus:border-[var(--color-mint)] focus:outline-none";

export default function TicketPage() {
  const t = useTranslations("support");
  const locale = useLocale();
  const tf = useFriendlyError();
  const params = useParams<{ id: string }>();
  const ticketId = params.id as Id<"supportTickets">;
  const data = useQuery(api.support.get, { ticketId });
  const reply = useMutation(api.support.reply);
  const close = useMutation(api.support.close);
  const rate = useMutation(api.support.rate);
  const markRead = useMutation(api.support.markRead);
  const tenant = useQuery(api.tenants.getMyTenant);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unread = data?.ticket.unread;

  useEffect(() => {
    if (unread) markRead({ ticketId }).catch(() => {});
  }, [unread, ticketId, markRead]);

  const date = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  if (data === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;
  const tk = data.ticket;
  const closed = tk.status === "closed";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || body.trim().length < SUPPORT_LIMITS.bodyMin) return;
    setBusy(true);
    setError("");
    try {
      await reply({ ticketId, body, attachmentIds: files.map((f) => f.attachmentId) });
      setBody("");
      setFiles([]);
    } catch (err) {
      setError(tf(err));
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(tf(err));
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/app/support" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← {t("back")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-text-secondary)]">TKT-{String(tk.number).padStart(4, "0")} · {t(`cat_${tk.category}`)}</p>
          <h1 className="break-words text-xl font-bold text-[var(--color-text)] sm:text-2xl">{tk.subject}</h1>
        </div>
        <StatusBadge status={tk.status} label={t(`status_${tk.status}`)} />
      </div>

      <ol className="space-y-3">
        {data.messages.map((m) => (
          <li key={m._id} className={`rounded-xl border p-4 ${m.authorKind === "support" ? "border-[var(--color-mint)] bg-[var(--color-bg-alt)]" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}>
            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">
              {m.authorKind === "support" ? t("team") : m.mine ? t("you") : m.authorName} · {date(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">{m.body}</p>
            <AttachmentList items={m.attachments} />
          </li>
        ))}
      </ol>

      {tk.status === "resolved" && <p className={`${card} text-sm text-[var(--color-text)]`}>{t("resolvedNote")}</p>}
      {closed && <p className={`${card} text-sm text-[var(--color-text)]`}>{t("closedNote")}</p>}

      {(tk.status === "resolved" || closed) && tk.userId && (
        <div className={card}>
          {tk.rating !== undefined ? (
            <p className="text-sm text-[var(--color-text)]">{t("rated")} {t("stars", { n: tk.rating })}</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("rateTitle")}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={t("stars", { n })} onClick={() => run(() => rate({ ticketId, rating: n }))} className="min-h-11 min-w-11 rounded-lg border border-[var(--color-border)] text-base font-semibold text-[var(--color-text)] hover:border-[var(--color-mint)]">
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!closed && (
        <form onSubmit={send} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--color-text)]">{t("reply")}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={5} placeholder={t("replyPlaceholder")} className={field} />
          </label>
          <AttachmentPicker tenantId={tenant?._id} value={files} onChange={setFiles} disabled={busy || !tenant} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || body.trim().length < SUPPORT_LIMITS.bodyMin} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-50">
              {busy ? t("sending") : t("send")}
            </button>
            <button type="button" onClick={() => { if (window.confirm(t("closeConfirm"))) run(() => close({ ticketId })); }} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">
              {t("closeTicket")}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
