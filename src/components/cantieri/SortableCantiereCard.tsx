"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin, Calendar, Euro, Users, Package, CheckCircle, AlertCircle, Clock, Key, Edit, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import type { Cantiere } from "@/app/[locale]/app/cantieri/page";
import type { Id } from "@/convex/_generated/dataModel";

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const STATUS_CONFIG = [
  { key: "preventivo", label: "Preventivo", color: "bg-blue-100 text-blue-700" },
  { key: "confermato", label: "Confermato", color: "bg-purple-100 text-purple-700" },
  { key: "in_produzione", label: "In Produzione", color: "bg-amber-100 text-amber-700" },
  { key: "pronto_consegna", label: "Pronto Consegna", color: "bg-indigo-100 text-indigo-700" },
  { key: "in_posa", label: "In Posa", color: "bg-orange-100 text-orange-700" },
  { key: "collaudo", label: "Collaudo", color: "bg-teal-100 text-teal-700" },
  { key: "chiuso", label: "Chiuso", color: "bg-emerald-100 text-emerald-700" },
] as const;

export interface SortableCantiereCardProps {
  cantiere: Cantiere;
  onEdit: () => void;
  onDelete: () => void;
  onGeneratePin: () => void;
  onRevokePin: () => void;
  t: (key: string) => string;
  format: ReturnType<typeof useFormatter>;
  index: number;
  items: Cantiere[];
}

export function SortableCantiereCard({
  cantiere,
  onEdit,
  onDelete,
  onGeneratePin,
  onRevokePin,
  t,
  format,
  index,
  items,
}: SortableCantiereCardProps) {
  const config = STATUS_CONFIG.find((s) => s.key === cantiere.status);
  // Lazy initializer: read "now" once at mount, not on every render (Date.now()
  // directly in the render body is an impure-render violation).
  const [now] = useState(() => Date.now());
  const isOverdue = cantiere.estimatedEndAt && cantiere.estimatedEndAt < now && cantiere.status !== "chiuso";
  const locale = useLocale();

  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({ id: cantiere._id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : 'none',
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={style}
      className={`bg-white border border-[var(--color-border)] rounded-lg p-3 hover:shadow-md transition-shadow ${isDragging ? "shadow-lg ring-2 ring-[var(--color-mint)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="p-1 rounded hover:bg-[var(--color-bg-alt)] cursor-grab active:cursor-grabbing text-[var(--color-text-secondary)]"
            aria-label={t("dragHandle")}
            title={t("dragHandle")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </span>
          <h3 className="font-semibold text-[var(--color-text)] truncate">
            {cantiere._id ? (
              <Link href={`/app/cantieri/${cantiere._id}`} className="hover:text-[var(--color-mint)] hover:underline">
                {cantiere.name}
              </Link>
            ) : (
              cantiere.name
            )}
          </h3>
        </div>
        {cantiere.guestPin && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700" title={t("guestAccessActive")}>
            <Key className="w-3 h-3" />
            {t("pinActive")}
          </span>
        )}
      </div>
      <div className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{cantiere.address}, {cantiere.postalCode} {cantiere.city}</span>
        </div>
        {cantiere.client && (
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="truncate">{cantiere.client.name}</span>
          </div>
        )}
        {cantiere.valueCents && (
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2.049.65 2.43 1.5l1.5-1.5a6.02 6.02 0 010 8.486l-1.5 1.5c-.381.85-.93 1.5-2.43 1.5A5.977 5.977 0 016 18c-1.105 0-2.049-.65-2.43-1.5l-1.5 1.5a6.02 6.02 0 000 8.486l1.5 1.5c.381.85.93 1.5 2.43 1.5A5.977 5.977 0 0018 18a5.977 5.977 0 00-2.43-1.5l1.5-1.5c.381-.85.93-1.5 2.43-1.5z" />
            </svg>
            <span>{(cantiere.valueCents / 100).toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {cantiere.estimatedStartAt ? new Date(cantiere.estimatedStartAt).toLocaleDateString(locale, { dateStyle: "short" }) : "—"}
            {cantiere.estimatedEndAt ? ` → ${new Date(cantiere.estimatedEndAt).toLocaleDateString(locale, { dateStyle: "short" })}` : ""}
            {isOverdue && <span className="ml-1 text-red-500">({t("overdue")})</span>}
          </span>
        </div>
        {cantiere.assignedUserIds?.length && (
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{cantiere.assignedUserIds.length} {t("assigned")}</span>
          </div>
        )}
        {cantiere.totalTasks !== undefined && cantiere.totalTasks > 0 && (
          <div className="flex items-center gap-1 pt-1 border-t border-[var(--color-border)]">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-xs">
              {cantiere.taskCounts?.done || 0} / {cantiere.totalTasks} {t("tasksDone")}
            </span>
            <div className="ml-2 flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${((cantiere.taskCounts?.done || 0) / cantiere.totalTasks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-[var(--color-border)]">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[cantiere.priority as keyof typeof PRIORITY_COLORS] || "bg-gray-100 text-gray-700"}`}>
          {t(`priority.${cantiere.priority}`)}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-[var(--color-bg-alt)]" title={t("edit")} aria-label={t("edit")}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {cantiere.guestPin ? (
            <button onClick={onRevokePin} className="p-1.5 rounded hover:bg-red-50 text-red-500" title={t("revokePin")} aria-label={t("revokePin")}>
              <Key className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={onGeneratePin} className="p-1.5 rounded hover:bg-[var(--color-bg-alt)]" title={t("generatePin")} aria-label={t("generatePin")}>
              <Key className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-500" title={t("delete")} aria-label={t("delete")}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}