import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  accent = false,
  icon: Icon,
  delta,
  hint,
}: {
  label: string;
  /** `undefined` renders a loading shimmer. */
  value?: string;
  accent?: boolean;
  icon?: LucideIcon;
  /** Fractional change vs the previous period (0.12 = +12%). Omit to hide. */
  delta?: number;
  hint?: string;
}) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) >= 0.001;
  const up = (delta ?? 0) >= 0;

  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{label}</p>
        {Icon ? <Icon size={15} className="text-[var(--color-text-secondary)]" aria-hidden="true" /> : null}
      </div>
      {value === undefined ? (
        <div className="h-8 w-16 rounded bg-[var(--color-border)] animate-pulse mt-2" />
      ) : (
        <p
          className={cn(
            "text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums",
            accent ? "text-[var(--color-mint)]" : "text-[var(--color-text)]",
          )}
        >
          {value}
        </p>
      )}
      {showDelta ? (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
            up ? "text-emerald-500" : "text-[var(--color-danger)]",
          )}
        >
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(delta! * 100).toFixed(0)}%
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}
