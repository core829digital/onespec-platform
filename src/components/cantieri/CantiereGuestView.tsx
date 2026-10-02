"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

/** Exactly what getCantiereByGuestPin returns to an external collaborator. */
export interface GuestCantiere {
  name: string;
  address: string;
  status: "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso";
  priority: "low" | "medium" | "high" | "urgent";
  estimatedStartAt: number | null;
  estimatedEndAt: number | null;
  guestPinExpiresAt: number | null;
  clientName: string | null;
}

export interface GuestTask {
  title: string;
  description: string | null;
  done: boolean;
  dueAt: number | null;
}

interface CantiereGuestViewProps {
  cantiere: GuestCantiere;
  tasks: GuestTask[];
  tenantName: string;
  pin: string;
}

const STATUS_COLORS: Record<string, string> = {
  preventivo: "bg-blue-100 text-blue-800",
  confermato: "bg-indigo-100 text-indigo-800",
  in_produzione: "bg-amber-100 text-amber-800",
  pronto_consegna: "bg-lime-100 text-lime-800",
  in_posa: "bg-orange-100 text-orange-800",
  collaudo: "bg-purple-100 text-purple-800",
  chiuso: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function CantiereGuestView({ cantiere, tasks, tenantName, pin }: CantiereGuestViewProps) {
  const t = useTranslations("cantieri");
  const locale = useLocale();
  const [showTasks, setShowTasks] = useState(false);

  const formatDate = (ts: number | null) => (ts ? new Date(ts).toLocaleDateString(locale) : "—");

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-6">
      {/* Header */}
      <header className="mb-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10 text-[var(--color-mint-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">{cantiere.name}</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {tenantName} · {t("guestView")} · PIN: <code className="bg-[var(--color-muted)] px-1.5 py-0.5 rounded text-xs font-mono">{pin}</code>
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-[var(--color-text-secondary)]">
            <p>{t("validUntil")}: {formatDate(cantiere.guestPinExpiresAt)}</p>
          </div>
        </div>

        {/* Status & Priority badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cantiere.status] ?? "bg-gray-100 text-gray-700"}`}>
            {t(cantiere.status)}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[cantiere.priority] ?? "bg-gray-100 text-gray-700"}`}>
            {t(`priority.${cantiere.priority}`)}
          </span>
        </div>
      </header>

      {/* Cantiere Info Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 max-w-4xl mx-auto">
        <InfoCard label={t("client")} value={cantiere.clientName ?? "—"} icon={<UserIcon />} />
        <InfoCard label={t("address")} value={cantiere.address || "—"} icon={<MapPinIcon />} />
        <InfoCard label={t("estimatedStart")} value={formatDate(cantiere.estimatedStartAt)} icon={<CalendarIcon />} />
        <InfoCard label={t("estimatedEnd")} value={formatDate(cantiere.estimatedEndAt)} icon={<CalendarIcon />} />
      </div>

      {/* Tasks Section */}
      <section className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            {t("tasks")} ({tasks.length})
          </h2>
          <button
            onClick={() => setShowTasks(!showTasks)}
            className="text-sm text-[var(--color-mint-text)] hover:underline"
          >
            {showTasks ? t("hideTasks") : t("showTasks")}
          </button>
        </div>

        {showTasks ? (
          tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <TaskCard key={idx} task={task} dueLabel={task.dueAt ? t("dueOn", { date: formatDate(task.dueAt) }) : null} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              {t("noTasks")}
            </div>
          )
        ) : null}
      </section>

      {/* Footer note */}
      <div className="mt-12 p-4 rounded-lg bg-[var(--color-muted)] text-center text-sm text-[var(--color-text-secondary)] max-w-4xl mx-auto">
        <p>{t("guestNote")}</p>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] mb-1">
        <span className="text-[var(--color-mint-text)]">{icon}</span>
        {label}
      </div>
      <p className="text-base font-medium text-[var(--color-text)] whitespace-pre-line">{value}</p>
    </div>
  );
}

function TaskCard({ task, dueLabel }: { task: GuestTask; dueLabel: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.done}
          disabled
          className="mt-1 w-5 h-5 text-[var(--color-mint-text)] rounded border-[var(--color-border)]"
        />
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${task.done ? "line-through text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{task.description}</p>
          )}
          {dueLabel && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{dueLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function UserIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h18a7 7 0 00-7-7z" /></svg>;
}

function MapPinIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}

function CalendarIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}