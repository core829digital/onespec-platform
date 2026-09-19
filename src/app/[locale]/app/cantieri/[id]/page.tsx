"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, Key, MapPin, Trash2, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import { RelatedRecords, type RelatedTab } from "@/components/app-shell/related-records";
import { useFriendlyError } from "@/lib/use-friendly-error";

type Tab = "overview" | RelatedTab;
const TABS: Tab[] = ["overview", "quotes", "surveys", "inspections", "installations"];
const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;

export default function CantiereFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const cantiereId = id as Id<"cantieri">;
  const t = useTranslations("folder");
  const tc = useTranslations("cantieri");
  const format = useFormatter();
  const toMessage = useFriendlyError();
  const data = useQuery(api.cantieri.getCantiere, { cantiereId });
  const createTask = useMutation(api.cantieri.createCantiereTask);
  const updateTask = useMutation(api.cantieri.updateCantiereTask);
  const deleteTask = useMutation(api.cantieri.deleteCantiereTask);
  const revokePin = useMutation(api.cantieri.revokeGuestPin);

  const [tab, setTab] = useState<Tab>("overview");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (data === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (data === null) {
    return (
      <EmptyState
        title={t("notFound")}
        action={<Link href="/app/cantieri" className="text-[var(--color-mint)] hover:underline">{t("backCantieri")}</Link>}
      />
    );
  }

  const { cantiere, tasks, client, quote } = data;
  const counts: Record<RelatedTab, number> = {
    quotes: data.quotes.length,
    surveys: data.surveys.length,
    inspections: data.inspections.length,
    installations: data.installations.length,
  };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/app/cantieri"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("backCantieri")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{cantiere.name}</h1>
          <span className="rounded-full bg-[var(--color-mint-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-mint)]">
            {tc(cantiere.status as "preventivo")}
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
            {t("priority")}: {t(cantiere.priority as "low")}
          </span>
          {cantiere.guestPin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">
              <Key className="h-3 w-3" /> {t("pinActive")}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}

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
            {t(k)}
            {k !== "overview" ? (
              <span className="ml-1.5 rounded-full bg-[var(--color-bg-alt)] px-1.5 text-xs tabular-nums">{counts[k]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
            <p className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {cantiere.address}, {cantiere.postalCode} {cantiere.city}
            </p>
            {client && (
              <p className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 shrink-0" />
                <span className="text-[var(--color-text-secondary)]">{t("linkedClient")}:</span>
                <Link href={`/app/clients/${client._id}`} className="text-[var(--color-mint)] hover:underline">
                  {client.name}
                </Link>
              </p>
            )}
            {quote && (
              <p className="text-sm">
                <span className="text-[var(--color-text-secondary)]">{t("linkedQuote")}: </span>
                <Link href={`/app/quotes/${quote._id}/print`} className="text-[var(--color-mint)] hover:underline">
                  {quote.leadName}
                </Link>
              </p>
            )}
            {cantiere.valueCents ? (
              <p className="text-sm text-[var(--color-text)]">
                {format.number(cantiere.valueCents / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
              </p>
            ) : null}
            {cantiere.guestPin && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => revokePin({ cantiereId }))}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] hover:text-[var(--color-danger)] disabled:opacity-50"
              >
                {t("revokePin")}
              </button>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] lg:col-span-2">
            <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
              {t("tasks")}
            </h2>
            <form
              className="flex gap-2 border-b border-[var(--color-border)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim()) return;
                void run(async () => {
                  await createTask({ tenantId: cantiere.tenantId, cantiereId, title: title.trim() });
                  setTitle("");
                });
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("taskPlaceholder")}
                maxLength={200}
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {t("addTask")}
              </button>
            </form>
            {tasks.length === 0 ? (
              <EmptyState title={t("noTasks")} />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {tasks.map((task) => (
                  <li key={task._id} className="flex items-center gap-3 px-4 py-3">
                    <p className={`min-w-0 flex-1 truncate text-sm ${task.status === "done" ? "text-[var(--color-text-secondary)] line-through" : "text-[var(--color-text)]"}`}>
                      {task.title}
                    </p>
                    <select
                      value={task.status}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() => updateTask({ taskId: task._id, status: e.target.value as (typeof TASK_STATUSES)[number] }))
                      }
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                      aria-label={t("statusLabel")}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(s)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => deleteTask({ taskId: task._id }))}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      title={t("deleteTask")}
                      aria-label={t("deleteTask")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab !== "overview" && <RelatedRecords data={data} tab={tab} linkQuery={`cantiereId=${cantiereId}`} />}
    </div>
  );
}
