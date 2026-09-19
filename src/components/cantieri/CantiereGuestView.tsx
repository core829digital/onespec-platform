"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Cantiere {
  _id: string;
  name: string;
  status: string;
  priority?: string;
  address: string;
  postalCode?: string;
  city?: string;
  clientName?: string;
  estimatedStart?: number;
  estimatedEnd?: number;
  pinExpiresAt?: number;
  tasks?: Array<{
    id?: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate?: number;
  }>;
}

interface CantiereGuestViewProps {
  cantiere: Cantiere;
  pin: string;
}

const STATUS_LABELS: Record<string, string> = {
  preventivo: "Preventivo",
  confermato: "Confermato",
  in_produzione: "In Produzione",
  pronto_consegna: "Pronto Consegna",
  in_posa: "In Posa",
  collaudo: "Collaudo",
  chiuso: "Chiuso",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

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

export function CantiereGuestView({ cantiere, pin }: CantiereGuestViewProps) {
  const t = useTranslations("cantieri");
  const [showTasks, setShowTasks] = useState(false);

  const formatDate = (ts: number | undefined) =>
    ts ? new Date(ts).toLocaleDateString("it-IT") : "—";

  const tasks = cantiere.tasks ?? [];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-6">
      {/* Header */}
      <header className="mb-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">{cantiere.name}</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("guestView")} · PIN: <code className="bg-[var(--color-muted)] px-1.5 py-0.5 rounded text-xs font-mono">{pin}</code>
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-[var(--color-text-secondary)]">
            <p>{t("validUntil")}: {formatDate(cantiere.pinExpiresAt)}</p>
          </div>
        </div>

        {/* Status & Priority badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cantiere.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABELS[cantiere.status ?? ""] ?? cantiere.status}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[cantiere.priority ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
            {PRIORITY_LABELS[cantiere.priority ?? ""] ?? cantiere.priority}
          </span>
        </div>
      </header>

      {/* Cantiere Info Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 max-w-4xl mx-auto">
        <InfoCard label={t("client")} value={cantiere.clientName ?? "—"} icon={<UserIcon />} />
        <InfoCard label={t("address")} value={cantiere.address ?? "—"} icon={<MapPinIcon />} />
        <InfoCard label={t("estimatedStart")} value={formatDate(cantiere.estimatedStart)} icon={<CalendarIcon />} />
        <InfoCard label={t("estimatedEnd")} value={formatDate(cantiere.estimatedEnd)} icon={<CalendarIcon />} />
      </div>

      {/* Tasks Section */}
      <section className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            {t("tasks")} ({tasks.length})
          </h2>
          <button
            onClick={() => setShowTasks(!showTasks)}
            className="text-sm text-[var(--color-mint)] hover:underline"
          >
            {showTasks ? t("hideTasks") : t("showTasks")}
          </button>
        </div>

        {showTasks ? (
          tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <TaskCard key={task.id ?? idx} task={task} />
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
        <span className="text-[var(--color-mint)]">{icon}</span>
        {label}
      </div>
      <p className="text-base font-medium text-[var(--color-text)] whitespace-pre-line">{value}</p>
    </div>
  );
}

function TaskCard({ task }: { task: { id?: string; title: string; description?: string; completed: boolean; dueDate?: number } }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          disabled
          className="mt-1 w-5 h-5 text-[var(--color-mint)] rounded border-[var(--color-border)]"
        />
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${task.completed ? "line-through text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{task.description}</p>
          )}
          {task.dueDate && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Scadenza: {new Date(task.dueDate).toLocaleDateString("it-IT")}
            </p>
          )}
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