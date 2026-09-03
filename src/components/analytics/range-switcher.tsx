"use client";

export type AnalyticsRange =
  | "24h"
  | "3d"
  | "5d"
  | "7d"
  | "14d"
  | "1m"
  | "3m"
  | "6m"
  | "1y"
  | "3y"
  | "5y"
  | "10y";

export const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "24h", label: "24 ore" },
  { value: "3d", label: "3 giorni" },
  { value: "5d", label: "5 giorni" },
  { value: "7d", label: "7 giorni" },
  { value: "14d", label: "2 settimane" },
  { value: "1m", label: "1 mese" },
  { value: "3m", label: "3 mesi" },
  { value: "6m", label: "6 mesi" },
  { value: "1y", label: "1 anno" },
  { value: "3y", label: "3 anni" },
  { value: "5y", label: "5 anni" },
  { value: "10y", label: "10 anni" },
];

export const RANGE_LABEL: Record<AnalyticsRange, string> = Object.fromEntries(
  RANGE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AnalyticsRange, string>;

export function RangeSwitcher({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (r: AnalyticsRange) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-[var(--color-text-secondary)]">Periodo</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AnalyticsRange)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/40"
      >
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
