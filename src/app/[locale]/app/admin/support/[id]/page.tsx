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
import { PriorityLabel, StatusBadge } from "@/components/support/ticket-badges";
import { AttachmentList, AttachmentPicker, type PendingFile } from "@/components/support/attachments";
import { SUPPORT_LIMITS, SUPPORT_PRIORITIES } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4";
const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-base text-[var(--color-text)] focus:border-[var(--color-mint)] focus:outline-none";
const btn = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-[var(--color-accent)] text-[var(--color-accent-ink)]`;
const ghost = `${btn} border border-[var(--color-border)] font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]`;

export default function AdminTicketPage() {
  const t = useTranslations("supportAdmin");
  const locale = useLocale();
  const tf = useFriendlyError();
  const params = useParams<{ id: string }>();
  const ticketId = params.id as Id<"supportTickets">;
  const me = useQuery(api.users.viewer);
  const data = useQuery(api.supportAdmin.get, { ticketId });
  const quick = useQuery(api.supportReplies.list);
  const reply = useMutation(api.supportAdmin.reply);
  const addNote = useMutation(api.supportAdmin.addNote);
  const setStatus = useMutation(api.supportAdmin.setStatus);
  const setPriority = useMutation(api.supportAdmin.setPriority);
  const assign = useMutation(api.supportAdmin.assign);
  const markRead = useMutation(api.supportAdmin.markRead);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unread = data?.ticket.supportUnread;

  useEffect(() => {
    if (unread) markRead({ ticketId }).catch(() => {});
  }, [unread, ticketId, markRead]);

  const date = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy(false);
    }
  }

  if (data === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;
  const tk = data.ticket;
  const closed = tk.status === "closed";
  const myId = me?._id;
  const assignedLabel = !tk.assignedToUserId ? t("unassigned") : tk.assignedToUserId === myId ? t("assignedToYou") : t("assignedOther");

  return (
    <div className="space-y-5">
      <Link href="/app/admin/support" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← {t("back")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-text-secondary)]">TKT-{String(tk.number).padStart(4, "0")} · {t(`cat_${tk.category}`)}</p>
          <h1 className="break-words text-xl font-bold text-[var(--color-text)] sm:text-2xl">{tk.subject}</h1>
        </div>
        <StatusBadge status={tk.status} label={t(`status_${tk.status}`)} />
      </div>

      <div className={`${card} grid gap-3 text-sm sm:grid-cols-2`}>
        <p><span className="text-[var(--color-text-secondary)]">{t("customer")}: </span>{tk.requester}</p>
        <p><span className="text-[var(--color-text-secondary)]">{t("company")}: </span>{tk.tenantName}</p>
        <p><span className="text-[var(--color-text-secondary)]">{t("plan")}: </span>{tk.tenantPlan ?? "—"}</p>
        <p><span className="text-[var(--color-text-secondary)]">{t("assignee")}: </span>{assignedLabel}</p>
        {tk.rating !== undefined && <p>{t("rating", { n: tk.rating })}</p>}
        <label className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)]">{t("priority")}:</span>
          <select value={tk.priority} disabled={busy} onChange={(e) => run(() => setPriority({ ticketId, priority: e.target.value as (typeof SUPPORT_PRIORITIES)[number] }))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-base text-[var(--color-text)]">
            {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p}>{t(`prio_${p}`)}</option>)}
          </select>
          <PriorityLabel priority={tk.priority} label="" />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {myId && tk.assignedToUserId !== myId && <button type="button" disabled={busy} onClick={() => run(() => assign({ ticketId, assigneeId: myId }))} className={ghost}>{t("assignMe")}</button>}
          {tk.assignedToUserId && <button type="button" disabled={busy} onClick={() => run(() => assign({ ticketId, assigneeId: null }))} className={ghost}>{t("unassign")}</button>}
          {tk.status === "resolved" && <button type="button" disabled={busy} onClick={() => run(() => setStatus({ ticketId, status: "open" }))} className={ghost}>{t("reopen")}</button>}
          {!closed && <button type="button" disabled={busy} onClick={() => { if (window.confirm(t("closeConfirm"))) run(() => setStatus({ ticketId, status: "closed" })); }} className={ghost}>{t("setClosed")}</button>}
        </div>
      </div>

      <ol className="space-y-3">
        {data.messages.map((m) => (
          <li key={m._id} className={`rounded-xl border p-4 ${m.authorKind === "support" ? "border-[var(--color-mint)] bg-[var(--color-bg-alt)]" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}>
            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{m.authorKind === "support" ? t("supportMsg") : t("customerMsg")} · {date(m.createdAt)}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">{m.body}</p>
            <AttachmentList items={m.attachments} asStaff />
          </li>
        ))}
      </ol>

      {!closed && (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim().length >= SUPPORT_LIMITS.bodyMin) run(() => reply({ ticketId, body, attachmentIds: files.map((f) => f.attachmentId) }), () => { setBody(""); setFiles([]); }); }} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--color-text)]">{t("replyToCustomer")}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={5} className={field} />
          </label>
          {quick && quick.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">{t("quickReply")}</span>
              <select
                value=""
                onChange={(e) => {
                  const r = quick.find((x) => x._id === e.target.value);
                  if (r) setBody((cur) => (cur.trim() ? `${cur.replace(/\s+$/, "")}\n\n${r.body}` : r.body).slice(0, SUPPORT_LIMITS.bodyMax));
                }}
                className="min-h-11 max-w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-base text-[var(--color-text)]"
              >
                <option value="">{t("quickReplyPick")}</option>
                {quick.map((r) => <option key={r._id} value={r._id}>{r.title}</option>)}
              </select>
            </label>
          )}
          <AttachmentPicker value={files} onChange={setFiles} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || body.trim().length < SUPPORT_LIMITS.bodyMin} className={primary}>{t("send")}</button>
            <button type="button" disabled={busy || body.trim().length < SUPPORT_LIMITS.bodyMin} onClick={() => run(() => reply({ ticketId, body, resolve: true, attachmentIds: files.map((f) => f.attachmentId) }), () => { setBody(""); setFiles([]); })} className={ghost}>{t("sendResolve")}</button>
          </div>
        </form>
      )}

      <section className={`${card} space-y-3 border-dashed`}>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("internalNotes")}</h2>
        {data.notes.map((n) => (
          <div key={n._id} className="rounded-lg bg-[var(--color-bg)] p-3">
            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{date(n.createdAt)}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">{n.body}</p>
          </div>
        ))}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={3} placeholder={t("notePlaceholder")} className={field} />
        <button type="button" disabled={busy || note.trim().length < SUPPORT_LIMITS.bodyMin} onClick={() => run(() => addNote({ ticketId, body: note }), () => setNote(""))} className={ghost}>{t("addNote")}</button>
      </section>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
