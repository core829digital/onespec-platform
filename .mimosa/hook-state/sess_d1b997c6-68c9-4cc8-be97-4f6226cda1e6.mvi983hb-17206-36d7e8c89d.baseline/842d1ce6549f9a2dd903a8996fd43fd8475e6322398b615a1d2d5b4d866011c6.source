"use client";

import { useTranslations } from "next-intl";

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

const RANGES: AnalyticsRange[] = ["24h", "3d", "5d", "7d", "14d", "1m", "3m", "6m", "1y", "3y", "5y", "10y"];

/** The period's name in the interface language ("1 mese", "1 month", …). */
export function useRangeLabel(): (r: AnalyticsRange) => string {
  const t = useTranslations("analyticsRange");
  return (r) => t(r);
}

export function RangeSwitcher({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (r: AnalyticsRange) => void;
}) {
  const t = useTranslations("analyticsRange");
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-[var(--color-text-secondary)]">{t("label")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AnalyticsRange)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/40"
      >
        {RANGES.map((r) => (
          <option key={r} value={r}>
            {t(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
