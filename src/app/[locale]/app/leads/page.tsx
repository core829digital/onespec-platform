"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { Building2, Contact, FileUp, Link2, Mail, MapPin, Phone, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { useQuery } from "@/lib/convex-query";
import { useHydrated } from "@/hooks/useHydrated";
import { useSwipeDismissProps } from "@/hooks/useSwipeDismiss";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { requestConfirm } from "@/lib/confirm-dialog";
import { EmptyState } from "@/components/app-shell/empty-state";
import { LeadImportWizard } from "@/components/leads/import-wizard";
import { cn } from "@/lib/utils";

type Status = Doc<"leads">["status"];
const STATUSES: Status[] = ["new", "contacted", "qualified", "converted", "discarded"];
const FORM_FIELDS = ["company", "name", "email", "phone", "address", "city", "postalCode", "notes"] as const;

const fieldClass = "min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] sm:min-h-10";

function AddLeadModal({ tenantId, onClose, onSaved }: { tenantId: Id<"tenants">; onClose: () => void; onSaved: (warnings: number) => void }) {
  const t = useTranslations("leads");
  const toMessage = useFriendlyError();
  const create = useMutation(api.leads.createLead);
  const swipe = useSwipeDismissProps<HTMLFormElement>(onClose);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const args = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ""));
      const r = await create({ tenantId, ...args });
      onSaved(r.warnings.length);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 pt-[env(safe-area-inset-top,0px)] sm:items-center sm:p-4" onClick={onClose}>
      <form {...swipe} onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label={t("form.title")} className="max-h-[100dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("form.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("form.cancel")} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"><X size={20} /></button>
        </div>
        <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t("form.hint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FORM_FIELDS.map((f) => (
            <label key={f} className={cn("block text-xs font-medium text-[var(--color-text-secondary)]", (f === "notes" || f === "address") && "sm:col-span-2")}>
              {t(`field.${f}`)}
              {f === "notes" ? (
                <textarea value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} maxLength={2000} rows={3} className={cn(fieldClass, "mt-1 py-2")} />
              ) : (
                <input value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} maxLength={f === "email" ? 320 : 200} type={f === "email" ? "email" : "text"} inputMode={f === "phone" ? "tel" : undefined} className={cn(fieldClass, "mt-1")} />
              )}
            </label>
          ))}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)]">{t("form.cancel")}</button>
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50">{t("form.save")}</button>
        </div>
      </form>
    </div>
  );
}

function CantiereModal({ lead, tenantId, onClose, onDone }: { lead: Doc<"leads">; tenantId: Id<"tenants">; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("leads");
  const toMessage = useFriendlyError();
  const link = useMutation(api.leads.linkLeadToCantiere);
  const swipe = useSwipeDismissProps<HTMLFormElement>(onClose);
  const cantieri = useQuery(api.cantieri.listCantieri, { tenantId, limit: 100 });
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState(t("cantiere.defaultName", { name: lead.name }).slice(0, 200));
  const [pick, setPick] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const free = (cantieri ?? []).filter((c) => !c.clientId || c.clientId === lead.clientId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await link(mode === "new" ? { leadId: lead._id, newCantiereName: name } : { leadId: lead._id, cantiereId: pick as Id<"cantieri"> });
      onDone();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 pt-[env(safe-area-inset-top,0px)] sm:items-center sm:p-4" onClick={onClose}>
      <form {...swipe} onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label={t("cantiere.title")} className="max-h-[100dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("cantiere.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("form.cancel")} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"><X size={20} /></button>
        </div>
        <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t("cantiere.hint")}</p>
        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--color-text)]"><input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} className="h-4 w-4 accent-[var(--color-mint)]" />{t("cantiere.new")}</label>
          {mode === "new" ? <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} aria-label={t("cantiere.name")} className={fieldClass} /> : null}
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--color-text)]"><input type="radio" name="mode" checked={mode === "existing"} onChange={() => setMode("existing")} className="h-4 w-4 accent-[var(--color-mint)]" />{t("cantiere.existing")}</label>
          {mode === "existing" ? (free.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">{t("cantiere.none")}</p> : (
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("cantiere.existing")} className={fieldClass}>
              <option value="">—</option>
              {free.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )) : null}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)]">{t("form.cancel")}</button>
          <button type="submit" disabled={saving || (mode === "new" ? name.trim() === "" : pick === "")} className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50">{t("cantiere.confirm")}</button>
        </div>
      </form>
    </div>
  );
}

function LeadRow({ lead, selected, onSelect, onConvert, onCantiere, onDelete, onStatus }: {
  lead: Doc<"leads">;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onConvert: () => void;
  onCantiere: () => void;
  onDelete: () => void;
  onStatus: (s: Status) => void;
}) {
  const t = useTranslations("leads");
  const [open, setOpen] = useState(false);
  const extra = lead.extra ? Object.entries(lead.extra) : [];
  const place = [lead.address, [lead.postalCode, lead.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <li className="px-3 py-3 sm:px-4" data-testid="lead-row">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.2fr)_9rem] md:items-start">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={t("selectRow", { name: lead.name })} className="mt-1 h-5 w-5 accent-[var(--color-mint)]" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 break-words font-semibold text-[var(--color-text)]">
            {lead.company ? <Building2 size={15} aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]" /> : <Contact size={15} aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]" />}
            <span className="min-w-0 break-words">{lead.name}</span>
          </p>
          {lead.contactName ? <p className="break-words text-sm text-[var(--color-text-secondary)]">{lead.contactName}</p> : null}
          {lead.tags.length > 0 ? <p className="mt-1 flex flex-wrap gap-1">{lead.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">{tag}</span>)}</p> : null}
        </div>
        <div className="min-w-0 space-y-0.5 text-sm text-[var(--color-text-secondary)]">
          {lead.email ? <p className="flex items-center gap-1.5 break-all"><Mail size={13} aria-hidden="true" className="shrink-0" /><a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a></p> : null}
          {lead.phone ? <p className="flex items-center gap-1.5"><Phone size={13} aria-hidden="true" className="shrink-0" /><a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a></p> : null}
          {place ? <p className="flex items-start gap-1.5 break-words"><MapPin size={13} aria-hidden="true" className="mt-0.5 shrink-0" />{place}</p> : null}
        </div>
        <label className="block text-xs text-[var(--color-text-secondary)]">
          <span className="sr-only">{t("status.new")}</span>
          <select value={lead.status} onChange={(e) => onStatus(e.target.value as Status)} disabled={lead.status === "converted"} aria-label={`${lead.name}: status`} className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] sm:min-h-10">
            {STATUSES.map((s) => <option key={s} value={s} disabled={s === "converted" && lead.status !== "converted"}>{t(`status.${s}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 md:pl-8">
        {lead.clientId ? (
          <Link href={`/app/clients/${lead.clientId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-3 text-xs font-semibold text-[var(--color-mint-dark)] sm:min-h-9">{t("openClient")}</Link>
        ) : (
          <button type="button" onClick={onConvert} data-testid="lead-as-client" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-3 text-xs font-semibold text-[var(--color-mint-dark)] sm:min-h-9"><UserPlus size={14} aria-hidden="true" />{t("asClient")}</button>
        )}
        {lead.cantiereId ? (
          <Link href={`/app/cantieri`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] sm:min-h-9">{t("openCantiere")}</Link>
        ) : (
          <button type="button" onClick={onCantiere} data-testid="lead-to-cantiere" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] sm:min-h-9"><Link2 size={14} aria-hidden="true" />{t("toCantiere")}</button>
        )}
        {(extra.length > 0 || lead.notes || lead.vatNumber || lead.website) ? <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex min-h-11 items-center px-2 text-xs text-[var(--color-mint-text)] hover:underline sm:min-h-9">{t("more")}</button> : null}
        <button type="button" onClick={onDelete} aria-label={`${t("delete")}: ${lead.name}`} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 sm:min-h-9 sm:min-w-9"><Trash2 size={16} aria-hidden="true" /></button>
      </div>
      {open ? (
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2 md:pl-8">
          {lead.vatNumber ? <div><dt className="inline font-semibold">{t("field.vatNumber")}: </dt><dd className="inline break-all">{lead.vatNumber}</dd></div> : null}
          {lead.fiscalCode ? <div><dt className="inline font-semibold">{t("field.fiscalCode")}: </dt><dd className="inline break-all">{lead.fiscalCode}</dd></div> : null}
          {lead.website ? <div className="min-w-0"><dt className="inline font-semibold">{t("field.website")}: </dt><dd className="inline break-all">{lead.website}</dd></div> : null}
          {lead.notes ? <div className="sm:col-span-2"><dt className="inline font-semibold">{t("field.notes")}: </dt><dd className="inline whitespace-pre-wrap break-words">{lead.notes}</dd></div> : null}
          {extra.map(([k, val]) => <div key={k} className="min-w-0"><dt className="inline font-semibold">{k}: </dt><dd className="inline break-words">{val}</dd></div>)}
        </dl>
      ) : null}
    </li>
  );
}

export default function LeadsPage() {
  const t = useTranslations("leads");
  const toMessage = useFriendlyError();
  const format = useFormatter();
  const hydrated = useHydrated();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [status, setStatus] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const term = useDeferredValue(search.trim());
  const [wizard, setWizard] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cantiereFor, setCantiereFor] = useState<Doc<"leads"> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const args = tenant && hydrated ? { tenantId: tenant._id, status: status === "all" ? undefined : status, search: term || undefined } : "skip";
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.leads.listLeads, args, { initialNumItems: 25 });
  const stats = useQuery(api.leads.leadStats, tenant ? { tenantId: tenant._id } : "skip");
  const imports = useQuery(api.leads.listImports, tenant ? { tenantId: tenant._id } : "skip");

  const convert = useMutation(api.leads.convertLeadToClient);
  const convertMany = useMutation(api.leads.convertLeadsToClients);
  const remove = useMutation(api.leads.deleteLeads);
  const update = useMutation(api.leads.updateLead);
  const undo = useMutation(api.leads.undoImport);

  const total = useMemo(() => (stats ? Object.values(stats.counts).reduce((a, b) => a + b, 0) : 0), [stats]);
  const say = (msg: string) => { setNote(msg); setError(""); };
  const fail = (e: unknown) => { setError(toMessage(e)); setNote(""); };
  const toggle = (id: string, on: boolean) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
  const ids = (): Id<"leads">[] => [...selected] as Id<"leads">[];

  async function onConvert(lead: Doc<"leads">) {
    try { const r = await convert({ leadId: lead._id }); say(r.created ? t("toastClientCreated") : t("toastClientLinked")); } catch (e) { fail(e); }
  }
  async function onDelete(lead: Doc<"leads">) {
    if (!(await requestConfirm(t("confirmDelete"), { danger: true }))) return;
    try { await remove({ tenantId: lead.tenantId, leadIds: [lead._id] }); toggle(lead._id, false); say(t("toastDeleted", { count: 1 })); } catch (e) { fail(e); }
  }
  async function onDeleteSelected() {
    if (!tenant || selected.size === 0 || !(await requestConfirm(t("confirmDeleteMany", { count: selected.size }), { danger: true }))) return;
    try { const r = await remove({ tenantId: tenant._id, leadIds: ids() }); setSelected(new Set()); say(t("toastDeleted", { count: r.deleted })); } catch (e) { fail(e); }
  }
  async function onConvertSelected() {
    if (!tenant || selected.size === 0 || !(await requestConfirm(t("confirmConvertMany", { count: selected.size })))) return;
    try { const r = await convertMany({ tenantId: tenant._id, leadIds: ids() }); setSelected(new Set()); say(t("toastManyConverted", { created: r.created, linked: r.linked })); } catch (e) { fail(e); }
  }
  async function onUndoImport(id: Id<"leadImports">) {
    if (!(await requestConfirm(t("confirmUndoImport"), { danger: true }))) return;
    try { await undo({ importId: id }); say(t("undone")); } catch (e) { fail(e); }
  }

  const allOnPage = results.length > 0 && results.every((l) => selected.has(l._id));
  const loading = !hydrated || !tenant || pageStatus === "LoadingFirstPage";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-[var(--color-text-secondary)]">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAdding(true)} disabled={!tenant} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:opacity-50"><Plus size={16} aria-hidden="true" />{t("addManual")}</button>
          <button type="button" data-testid="lead-import-open" onClick={() => setWizard(true)} disabled={!tenant} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mint)] px-4 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50"><FileUp size={16} aria-hidden="true" />{t("import")}</button>
        </div>
      </div>

      {note ? <p role="status" className="rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] px-3 py-2 text-sm text-[var(--color-text)]">{note}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("listAria")}>
        {(["all", ...STATUSES] as const).map((s) => {
          const n = s === "all" ? total : (stats?.counts[s] ?? 0);
          return (
            <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setSelected(new Set()); }} className={cn("min-h-11 rounded-full border px-3 text-sm font-medium sm:min-h-9", status === s ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-alt)]")}>
              {s === "all" ? t("tabs.all") : t(`status.${s}`)} <span className="tabular-nums opacity-70">{n}{stats?.capped && n >= 2000 ? "+" : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={80} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)]" />
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] px-3 py-2" data-testid="lead-bulk-bar">
          <span className="text-sm font-semibold text-[var(--color-text)]">{t("selected", { count: selected.size })}</span>
          <button type="button" onClick={() => void onConvertSelected()} disabled={selected.size > 50} className="min-h-11 rounded-lg bg-[var(--color-mint)] px-3 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-50 sm:min-h-9">{t("convertSelected")}</button>
          <button type="button" onClick={() => void onDeleteSelected()} className="min-h-11 rounded-lg border border-[var(--color-danger)]/50 px-3 text-xs font-semibold text-[var(--color-danger)] sm:min-h-9">{t("deleteSelected")}</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto min-h-11 px-2 text-xs text-[var(--color-text-secondary)] hover:underline sm:min-h-9">{t("clearSelection")}</button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
        {loading ? (
          <div className="divide-y divide-[var(--color-border)]">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse px-4 py-4"><div className="h-5 w-48 rounded bg-[var(--color-border)]" /><div className="mt-2 h-4 w-32 rounded bg-[var(--color-border)]" /></div>)}</div>
        ) : results.length === 0 ? (
          term || status !== "all" ? <EmptyState title={t("noResults")} /> : <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} action={<button type="button" onClick={() => setWizard(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mint)] px-4 text-sm font-bold text-[var(--color-mint-dark)]"><FileUp size={16} aria-hidden="true" />{t("import")}</button>} />
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 sm:px-4">
              <input type="checkbox" checked={allOnPage} onChange={(e) => setSelected(e.target.checked ? new Set(results.map((l) => l._id)) : new Set())} aria-label={t("selectAll")} className="h-5 w-5 accent-[var(--color-mint)]" />
              <span className="text-xs text-[var(--color-text-secondary)]">{t("selectAll")}</span>
            </div>
            <ul className="divide-y divide-[var(--color-border)]" aria-label={t("listAria")}>
              {results.map((lead) => (
                <LeadRow
                  key={lead._id}
                  lead={lead}
                  selected={selected.has(lead._id)}
                  onSelect={(on) => toggle(lead._id, on)}
                  onConvert={() => void onConvert(lead)}
                  onCantiere={() => setCantiereFor(lead)}
                  onDelete={() => void onDelete(lead)}
                  onStatus={(s) => void update({ leadId: lead._id, status: s }).catch(fail)}
                />
              ))}
            </ul>
            {pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? (
              <div className="border-t border-[var(--color-border)] p-3 text-center">
                <button type="button" onClick={() => loadMore(25)} disabled={pageStatus === "LoadingMore"} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50">{t("loadMore")}</button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {imports && imports.length > 0 ? (
        <section aria-labelledby="lead-imports-title" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <h2 id="lead-imports-title" className="text-sm font-semibold text-[var(--color-text)]">{t("importsTitle")}</h2>
          <ul className="mt-2 divide-y divide-[var(--color-border)]">
            {imports.slice(0, 5).map((imp) => (
              <li key={imp._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="break-all font-medium text-[var(--color-text)]">{imp.fileName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{format.dateTime(imp.createdAt, { dateStyle: "medium", timeStyle: "short" })} · {t("importLine", { inserted: imp.inserted, duplicates: imp.duplicates, invalid: imp.invalid })}</p>
                </div>
                {imp.status === "done" && imp.inserted > 0 ? <button type="button" onClick={() => void onUndoImport(imp._id)} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 sm:min-h-9">{t("undoImport")}</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {wizard && tenant ? <LeadImportWizard tenantId={tenant._id} country={tenant.country} onClose={() => setWizard(false)} onDone={() => setNote("")} /> : null}
      {adding && tenant ? <AddLeadModal tenantId={tenant._id} onClose={() => setAdding(false)} onSaved={(w) => { setAdding(false); say(w > 0 ? t("form.warnings") : t("form.save")); }} /> : null}
      {cantiereFor && tenant ? <CantiereModal lead={cantiereFor} tenantId={tenant._id} onClose={() => setCantiereFor(null)} onDone={() => { setCantiereFor(null); say(t("toastSiteLinked")); }} /> : null}
    </div>
  );
}
