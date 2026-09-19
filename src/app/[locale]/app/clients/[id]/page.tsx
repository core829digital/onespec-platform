"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, Building, Mail, MapPin, Phone, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import { RelatedRecords, type RelatedTab } from "@/components/app-shell/related-records";
import { useFriendlyError } from "@/lib/use-friendly-error";

type Tab = "overview" | "cantieri" | RelatedTab | "activity";

const TABS: Tab[] = ["overview", "cantieri", "quotes", "surveys", "inspections", "installations", "activity"];

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export default function ClientFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const t = useTranslations("folder");
  const tc = useTranslations("clients");
  const format = useFormatter();
  const toMessage = useFriendlyError();
  const data = useQuery(api.clients.getClient, { clientId });
  const addActivity = useMutation(api.clients.addClientActivity);

  const [tab, setTab] = useState<Tab>("overview");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (data === undefined) {
    return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  }
  if (data === null) {
    return <EmptyState title={t("notFound")} action={<Link href="/app/clients" className="text-[var(--color-mint)] hover:underline">{t("backClients")}</Link>} />;
  }

  const { client, activities, cantieri } = data;
  const counts: Record<Tab, number | null> = {
    overview: null,
    cantieri: cantieri.length,
    quotes: data.quotes.length,
    surveys: data.surveys.length,
    inspections: data.inspections.length,
    installations: data.installations.length,
    activity: activities.length,
  };
  const linkQuery = `clientId=${clientId}`;
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" });

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await addActivity({ clientId, type: "note", title: note.trim() });
      setNote("");
      setMsg({ kind: "ok", text: t("noteSaved") });
    } catch (e) {
      setMsg({ kind: "err", text: toMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("backClients")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{client.name}</h1>
          <span className="rounded-full bg-[var(--color-mint-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-mint)]">
            {tc(client.type)}
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
            {tc(client.status)}
          </span>
        </div>
        {client.tags.length > 0 && (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{client.tags.join(" · ")}</p>
        )}
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === k
                ? "border-[var(--color-mint)] font-semibold text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {t(k === "overview" ? "overview" : k)}
            {counts[k] !== null ? (
              <span className="ml-1.5 rounded-full bg-[var(--color-bg-alt)] px-1.5 text-xs tabular-nums">{counts[k]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <User className="h-4 w-4" /> {t("contacts")}
            </h2>
            <dl className="space-y-3">
              <Field label={tc("contactName")} value={client.contactName} />
              <Field label={tc("email")} value={client.email} />
              <Field label={tc("phone")} value={client.phone} />
            </dl>
          </section>
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <Building className="h-4 w-4" /> {t("billing")}
            </h2>
            <dl className="space-y-3">
              <Field label={tc("billingAddress")} value={[client.billingAddress, client.billingPostalCode, client.billingCity].filter(Boolean).join(", ")} />
              <Field label={t("vat")} value={client.vatNumber} />
              <Field label={t("fiscal")} value={client.fiscalCode} />
            </dl>
          </section>
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <MapPin className="h-4 w-4" /> {t("site")}
            </h2>
            <dl className="space-y-3">
              <Field label={tc("siteAddress")} value={[client.siteAddress, client.sitePostalCode, client.siteCity].filter(Boolean).join(", ")} />
              <Field label={tc("notes")} value={client.notes} />
            </dl>
          </section>
          <div className="flex flex-wrap gap-2 md:col-span-3">
            {client.email && (
              <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-alt)]">
                <Mail className="h-4 w-4" /> {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-alt)]">
                <Phone className="h-4 w-4" /> {client.phone}
              </a>
            )}
          </div>
        </div>
      )}

      {tab === "cantieri" && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="flex justify-end border-b border-[var(--color-border)] px-4 py-3">
            <Link href="/app/cantieri" className="rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90">
              + {t("newCantiere")}
            </Link>
          </div>
          {cantieri.length === 0 ? (
            <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {cantieri.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {c.address}, {c.postalCode} {c.city}
                    </p>
                  </div>
                  <Link href={`/app/cantieri/${c._id}`} className="shrink-0 text-xs text-[var(--color-mint)] hover:underline">
                    {t("open")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(tab === "quotes" || tab === "surveys" || tab === "inspections" || tab === "installations") && (
        <RelatedRecords data={data} tab={tab} linkQuery={linkQuery} />
      )}

      {tab === "activity" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              {t("addNote")}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                rows={2}
                maxLength={500}
                className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={saveNote}
                disabled={busy || !note.trim()}
                className="rounded-lg bg-[var(--color-mint)] px-4 py-1.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {t("addNote")}
              </button>
              {msg && (
                <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-[var(--color-danger)]"}`} role="status">
                  {msg.text}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
            {activities.length === 0 ? (
              <EmptyState title={t("noActivity")} />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {activities.map((a) => (
                  <li key={a._id} className="px-4 py-3">
                    <p className="text-sm text-[var(--color-text)]">
                      <span className="mr-2 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {t(`act.${a.type}` as "act.note")}
                      </span>
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{date(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
