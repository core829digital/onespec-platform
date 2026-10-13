import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

export function StatCard({
  label,
  value,
  accent = false,
  icon: Icon,
  delta,
  hint,
  count,
  index = 0,
  idle = false,
}: {
  label: string;
  /** `undefined` renders a loading shimmer. */
  value?: string;
  accent?: boolean;
  icon?: LucideIcon;
  /** Fractional change vs the previous period (0.12 = +12%). Omit to hide. */
  delta?: number;
  hint?: string;
  /** When given, the number grows to its value instead of appearing; `value` stays the exact final text. */
  count?: { value: number; format: (n: number) => string; decimals?: number };
  /** Position in the row: staggers the entrance. */
  index?: number;
  /** A barely-there hover in the air (KPI row only). */
  idle?: boolean;
}) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) >= 0.001;
  const up = (delta ?? 0) >= 0;

  return (
    <div
      className={cn("os-rise os-float bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-4", idle && "os-float-idle")}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{label}</p>
        {Icon ? <Icon size={15} className="text-[var(--color-text-secondary)]" aria-hidden="true" /> : null}
      </div>
      {value === undefined ? (
        <div className="mt-1.5 h-8 w-16 rounded bg-[var(--color-border)] os-skel sm:h-9" />
      ) : (
        <p
          className={cn(
            "text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums",
            accent ? "text-[var(--color-mint-text)]" : "text-[var(--color-text)]",
          )}
        >
          {count ? <CountUp value={count.value} format={count.format} decimals={count.decimals} /> : value}
        </p>
      )}
      {/* The line under the number always has its place: the delta / hint arriving later must not push the page down (layout shift). */}
      <div className="mt-1 min-h-[1.125rem]">
        {value === undefined ? null : showDelta ? (
          <p
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              up ? "text-emerald-500" : "text-[var(--color-danger)]",
            )}
          >
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta! * 100).toFixed(0)}%
          </p>
        ) : hint ? (
          <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
