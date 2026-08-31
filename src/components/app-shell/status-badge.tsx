import { cn } from "@/lib/utils";

export type QuoteStatus = "new" | "contacted" | "quoted" | "won" | "lost" | "spam";

const STYLES: Record<QuoteStatus, string> = {
  new: "bg-[var(--color-mint)]/15 text-[var(--color-mint)] border-[var(--color-mint)]/30",
  contacted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  quoted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  won: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  lost: "bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)] border-[var(--color-border)]",
  spam: "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = (status in STYLES ? status : "lost") as QuoteStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STYLES[key],
      )}
    >
      {label ?? status}
    </span>
  );
}
