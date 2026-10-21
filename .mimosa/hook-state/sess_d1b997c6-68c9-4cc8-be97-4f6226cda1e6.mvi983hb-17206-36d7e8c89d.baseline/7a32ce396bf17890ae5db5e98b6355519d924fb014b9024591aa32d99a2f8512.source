"use client";

import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { SUPPORT_ATTACHMENT_ACCEPT, SUPPORT_LIMITS } from "@/shared/support";

export interface PendingFile {
  attachmentId: Id<"supportAttachments">;
  fileName: string;
}

const chip =
  "inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";

/**
 * Attach up to 3 pictures/PDFs to a message. Each file is uploaded, then verified on the server (the real bytes are read; a fake file is
 * deleted) before it shows up here. `tenantId` is the customer's company; leave it out for platform admins.
 */
export function AttachmentPicker({
  tenantId, value, onChange, disabled,
}: {
  tenantId?: Id<"tenants">;
  value: PendingFile[];
  onChange: (next: PendingFile[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("support");
  const tf = useFriendlyError();
  const generateUploadUrl = useMutation(api.supportFiles.generateUploadUrl);
  const finalize = useAction(api.supportFiles.finalizeUpload);
  const discard = useMutation(api.supportFiles.discardPending);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = value.length >= SUPPORT_LIMITS.attachmentsPerMessage;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    let next = value;
    try {
      for (const file of files) {
        if (next.length >= SUPPORT_LIMITS.attachmentsPerMessage) break;
        if (file.size > SUPPORT_LIMITS.attachmentMaxBytes) {
          setError(t("attachTooBig"));
          continue;
        }
        const url = await generateUploadUrl({ tenantId });
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error("upload failed");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        const done = await finalize({ storageId, tenantId, fileName: file.name });
        next = [...next, { attachmentId: done.attachmentId, fileName: done.fileName }];
        onChange(next);
      }
    } catch (err) {
      setError(tf(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: Id<"supportAttachments">) {
    onChange(value.filter((f) => f.attachmentId !== id));
    await discard({ attachmentId: id }).catch(() => {});
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((f) => (
          <span key={f.attachmentId} className={chip}>
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{f.fileName}</span>
            <button type="button" onClick={() => remove(f.attachmentId)} aria-label={t("attachRemove")} className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-bg-alt)]">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </span>
        ))}
        {!full && (
          <button type="button" disabled={busy || disabled} onClick={() => ref.current?.click()} className={`${chip} hover:border-[var(--color-mint)] disabled:opacity-50`}>
            <Paperclip className="h-4 w-4" aria-hidden />
            {busy ? t("attaching") : t("attach")}
          </button>
        )}
        <input ref={ref} type="file" multiple accept={SUPPORT_ATTACHMENT_ACCEPT} onChange={pick} className="hidden" />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{t("attachHint")}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Files of a sent message; opening asks the server for a fresh, short-lived link. */
export function AttachmentList({
  items, asStaff,
}: {
  items: { _id: Id<"supportAttachments">; fileName: string; contentType: string; sizeBytes: number }[];
  asStaff?: boolean;
}) {
  const t = useTranslations("support");
  const tf = useFriendlyError();
  const openCustomer = useMutation(api.supportFiles.open);
  const openStaff = useMutation(api.supportFiles.openAsStaff);
  const verify = useAction(api.supportFiles.verifyIntegrity);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<string, "busy" | "ok" | "ko">>({});
  if (!items.length) return null;

  async function open(id: Id<"supportAttachments">) {
    setError("");
    try {
      const { url } = await (asStaff ? openStaff : openCustomer)({ attachmentId: id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(tf(err));
    }
  }

  async function check(id: Id<"supportAttachments">) {
    setError("");
    setChecks((c) => ({ ...c, [id]: "busy" }));
    try {
      const r = await verify({ attachmentId: id });
      setChecks((c) => ({ ...c, [id]: r.ok ? "ok" : "ko" }));
    } catch (err) {
      setChecks((c) => { const n = { ...c }; delete n[id]; return n; });
      setError(tf(err));
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <span key={a._id} className="inline-flex max-w-full flex-wrap items-center gap-1">
        <button type="button" onClick={() => open(a._id)} aria-label={t("attachOpen", { name: a.fileName })} className={`${chip} hover:border-[var(--color-mint)]`}>
          <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{a.fileName}</span>
          <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
        </button>
        {asStaff && (
          <button type="button" disabled={checks[a._id] === "busy"} onClick={() => check(a._id)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-3 text-xs hover:border-[var(--color-mint)] disabled:opacity-50">
            {checks[a._id] === "busy" ? t("verifyBusy") : t("verifyIntegrity")}
          </button>
        )}
        {checks[a._id] === "ok" && <span role="status" className="text-xs text-emerald-700">{t("verifyOk")}</span>}
        {checks[a._id] === "ko" && <span role="alert" className="text-xs text-red-600">{t("verifyKo")}</span>}
        </span>
      ))}
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
