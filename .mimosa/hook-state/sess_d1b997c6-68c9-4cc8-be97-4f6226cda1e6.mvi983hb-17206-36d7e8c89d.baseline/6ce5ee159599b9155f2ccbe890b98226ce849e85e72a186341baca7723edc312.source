import type { SupportPriority, SupportStatus } from "@/shared/support";

const STATUS_STYLE: Record<SupportStatus, string> = {
  open: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  waiting: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  resolved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  closed: "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
};
const PRIORITY_STYLE: Record<SupportPriority, string> = {
  low: "text-[var(--color-text-secondary)]",
  normal: "text-[var(--color-text-secondary)]",
  high: "text-amber-700 dark:text-amber-300",
  urgent: "text-red-700 dark:text-red-300 font-semibold",
};

export function StatusBadge({ status, label }: { status: SupportStatus; label: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{label}</span>;
}

export function PriorityLabel({ priority, label }: { priority: SupportPriority; label: string }) {
  return <span className={`text-xs ${PRIORITY_STYLE[priority]}`}>{label}</span>;
}
