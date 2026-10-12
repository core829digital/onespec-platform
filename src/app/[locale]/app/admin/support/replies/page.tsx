"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { SUPPORT_LIMITS } from "@/shared/support";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4";
const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-base text-[var(--color-text)] focus:border-[var(--color-mint)] focus:outline-none";
const btn = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)] disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-50";

export default function QuickRepliesPage() {
  const t = useTranslations("supportAdmin");
  const tf = useFriendlyError();
  const replies = useQuery(api.supportReplies.list);
  const save = useMutation(api.supportReplies.save);
  const remove = useMutation(api.supportReplies.remove);
  const [editing, setEditing] = useState<Id<"supportCannedReplies"> | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = title.trim().length >= SUPPORT_LIMITS.cannedTitleMin && body.trim().length >= SUPPORT_LIMITS.bodyMin;

  function reset() {
    setEditing(null);
    setTitle("");
    setBody("");
  }

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

  return (
    <div className="space-y-5">
      <Link href="/app/admin/support" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← {t("back")}</Link>
      <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("repliesTitle")}</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("repliesHelp")}</p>

      <form
        onSubmit={(e) => { e.preventDefault(); if (valid) run(() => save({ id: editing ?? undefined, title, body }), reset); }}
        className={`${card} space-y-3`}
      >
        <h2 className="font-semibold text-[var(--color-text)]">{editing ? t("replyEdit") : t("replyNew")}</h2>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--color-text)]">{t("replyTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={SUPPORT_LIMITS.cannedTitleMax} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--color-text)]">{t("replyBody")}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={SUPPORT_LIMITS.bodyMax} rows={5} className={field} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !valid} className={primary}>{t("save")}</button>
          {editing && <button type="button" onClick={reset} className={btn}>{t("cancel")}</button>}
        </div>
      </form>

      {replies === undefined ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
      ) : replies.length === 0 ? (
        <p className={`${card} text-sm text-[var(--color-text-secondary)]`}>{t("repliesEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {replies.map((r) => (
            <li key={r._id} className={card}>
              <p className="font-medium text-[var(--color-text)]">{r.title}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--color-text-secondary)]">{r.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => { setEditing(r._id); setTitle(r.title); setBody(r.body); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                <button type="button" className={btn} onClick={() => { if (window.confirm(t("replyDeleteConfirm"))) run(() => remove({ id: r._id })); }}>{t("delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
