"use client";

import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { FileText, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { useQuery } from "@/lib/convex-query";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { requestConfirm } from "@/lib/confirm-dialog";
import { EmptyState } from "@/components/app-shell/empty-state";

const MAX_BYTES = 15 * 1024 * 1024;
const field = "min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] sm:min-h-10";

export interface PanelQuote {
  _id: Id<"quoteRequests">;
  leadName: string;
  priceCents: number;
}
export interface PanelSite {
  _id: Id<"cantieri">;
  name: string;
}

/** The first bytes of the file: a quick check for the person's benefit — the server reads and verifies the real content. */
async function looksLikePdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === "%PDF-";
}

/**
 * The customer's folder of documents: above all the final quote (PDF) the customer received, kept beside the quote made in the platform
 * and the site. `fixedSiteId` is set when the panel sits inside a site.
 */
export function DocumentsPanel({ clientId, sites, quotes, fixedSiteId }: { clientId: Id<"clients">; sites: PanelSite[]; quotes: PanelQuote[]; fixedSiteId?: Id<"cantieri"> }) {
  const t = useTranslations("docs");
  const format = useFormatter();
  const toMessage = useFriendlyError();
  const docs = useQuery(api.clientDocuments.listDocuments, { clientId, cantiereId: fixedSiteId });
  const generateUploadUrl = useMutation(api.clientDocuments.generateUploadUrl);
  const finalize = useAction(api.clientDocuments.finalizeUpload);
  const open = useMutation(api.clientDocuments.openDocument);
  const update = useMutation(api.clientDocuments.updateDocument);
  const remove = useMutation(api.clientDocuments.deleteDocument);

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"final_quote" | "other">("final_quote");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [siteId, setSiteId] = useState<string>(fixedSiteId ?? "");
  const [quoteId, setQuoteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const eur = (cents: number) => format.number(cents / 100, { style: "currency", currency: "EUR" });
  const siteName = (id?: Id<"cantieri">) => sites.find((s) => s._id === id)?.name;
  const quoteOf = (id?: Id<"quoteRequests">) => quotes.find((q) => q._id === id);

  async function onPick(f: File | null) {
    setError("");
    setNote("");
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) { setFile(null); return setError(t("tooLarge")); }
    if (!(await looksLikePdf(f))) { setFile(null); return setError(t("notPdf")); }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").slice(0, 120));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const uploadUrl = await generateUploadUrl({ clientId });
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const cents = amount.trim() ? Math.round(Number(amount.replace(",", ".")) * 100) : undefined;
      await finalize({
        storageId, clientId, kind, title: title.trim() || file.name, fileName: file.name,
        cantiereId: (siteId || undefined) as Id<"cantieri"> | undefined,
        quoteId: (quoteId || undefined) as Id<"quoteRequests"> | undefined,
        amountCents: cents !== undefined && Number.isFinite(cents) && cents >= 0 ? cents : undefined,
      });
      setFile(null); setTitle(""); setAmount(""); setQuoteId("");
      if (fileRef.current) fileRef.current.value = "";
      setNote(t("uploaded"));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(id: Id<"clientDocuments">) {
    try {
      const { url } = await open({ documentId: id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(toMessage(err));
    }
  }

  return (
    <div className="space-y-4" data-testid="documents-panel">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("hint")}</p>
        </div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("chooseFile")}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" data-testid="doc-file-input" disabled={busy} onChange={(e) => void onPick(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-[var(--color-text)] file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[var(--color-mint)] file:px-4 file:text-sm file:font-semibold file:text-[var(--color-mint-dark)]" />
        </label>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("limits")}</p>
        {file ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">{t("kindLabel")}
              <select value={kind} onChange={(e) => setKind(e.target.value as "final_quote" | "other")} className={`${field} mt-1`}>
                <option value="final_quote">{t("kind.final_quote")}</option>
                <option value="other">{t("kind.other")}</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">{t("titleLabel")}
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">{t("amount")}
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" maxLength={14} className={`${field} mt-1`} />
            </label>
            {fixedSiteId ? null : (
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">{t("site")}
                <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={`${field} mt-1`}>
                  <option value="">{t("noSite")}</option>
                  {sites.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] sm:col-span-2">{t("quote")}
              <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className={`${field} mt-1`}>
                <option value="">{t("noQuote")}</option>
                {quotes.map((q) => <option key={q._id} value={q._id}>{q.leadName} · {eur(q.priceCents)}</option>)}
              </select>
            </label>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        {note ? <p role="status" className="text-sm text-[var(--color-mint-text)]">{note}</p> : null}
        <button type="submit" disabled={!file || busy} data-testid="doc-submit" className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50">{busy ? t("uploading") : t("submit")}</button>
      </form>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
        {docs === undefined ? (
          <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)]">…</p>
        ) : docs.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {docs.map((d) => {
              const linked = quoteOf(d.quoteId);
              const diff = linked && d.amountCents !== undefined ? d.amountCents - linked.priceCents : null;
              return (
                <li key={d._id} className="space-y-2 px-4 py-3" data-testid="doc-row">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 break-words font-semibold text-[var(--color-text)]"><FileText size={16} aria-hidden="true" className="shrink-0 text-[var(--color-mint-text)]" /><span className="min-w-0 break-words">{d.title}</span></p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                        <span className="rounded-full bg-[var(--color-mint-light)] px-2 py-0.5 font-semibold text-[var(--color-mint-text)]">{t(`kind.${d.kind}`)}</span>
                        <span className="break-all">{d.fileName}</span>
                        <span>{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                        <span>{t("uploadedOn", { date: format.dateTime(d.createdAt, { dateStyle: "medium" }) })}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => void onOpen(d._id)} className="min-h-11 rounded-lg bg-[var(--color-mint)] px-3 text-xs font-semibold text-[var(--color-mint-dark)] sm:min-h-9">{t("open")}</button>
                      <button type="button" aria-label={`${t("delete")}: ${d.title}`} onClick={async () => { if (await requestConfirm(t("confirmDelete"), { danger: true })) await remove({ documentId: d._id }).catch((err) => setError(toMessage(err))); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 sm:min-h-9 sm:min-w-9"><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                    {siteName(d.cantiereId) ? <span>{t("forSite", { name: siteName(d.cantiereId)! })}</span> : null}
                    {d.amountCents !== undefined ? <span className="font-semibold text-[var(--color-text)]">{t("finalAmount", { amount: eur(d.amountCents) })}</span> : null}
                    {linked ? <span>{t("linkedQuote", { amount: eur(linked.priceCents) })} · <Link href={`/app/quotes/${linked._id}/print`} className="text-[var(--color-mint-text)] hover:underline">{t("openQuote")}</Link></span> : null}
                    {diff !== null && diff !== 0 ? <span>{t("difference", { amount: `${diff > 0 ? "+" : ""}${eur(diff)}` })}</span> : null}
                    <label className="ml-auto flex items-center gap-2">
                      <span className="sr-only">{t("outcomeLabel")}</span>
                      <select value={d.outcome} onChange={(e) => void update({ documentId: d._id, outcome: e.target.value as "pending" | "accepted" | "rejected" }).catch((err) => setError(toMessage(err)))} aria-label={`${t("outcomeLabel")}: ${d.title}`} className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs text-[var(--color-text)] sm:min-h-9">
                        {(["pending", "accepted", "rejected"] as const).map((o) => <option key={o} value={o}>{t(`outcome.${o}`)}</option>)}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
