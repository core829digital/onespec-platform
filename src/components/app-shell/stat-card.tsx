import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  /** `undefined` renders a loading shimmer. */
  value?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{label}</p>
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
    </div>
  );
}
