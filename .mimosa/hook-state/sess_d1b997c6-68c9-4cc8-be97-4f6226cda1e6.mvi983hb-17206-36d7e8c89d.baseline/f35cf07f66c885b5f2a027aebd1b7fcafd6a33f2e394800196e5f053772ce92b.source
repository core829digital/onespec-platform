"use client";

import { useLocale, useTranslations } from "next-intl";
import { GRADES, GRADE_FAMILIES } from "@/shared/grades";
import { GRADE_FAMILY_LABELS, gradeLabel, isGradeLocale } from "@/shared/grade-labels";

/** The professional grades grouped by family. Admin-level grades are marked, and only the owner may pick them. */
export function GradeSelect({
  value,
  onChange,
  canGrantAdmin,
  placeholder,
  disabled,
  id,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (grade: string) => void;
  canGrantAdmin: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("team");
  const families = GRADE_FAMILY_LABELS[isGradeLocale(locale) ? locale : "it"];
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className ?? "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {GRADE_FAMILIES.map((family) => (
        <optgroup key={family} label={families[family]}>
          {GRADES.filter((g) => g.family === family).map((g) => (
            <option key={g.key} value={g.key} disabled={g.tier === "admin" && !canGrantAdmin}>
              {gradeLabel(locale, g.key)}
              {g.tier === "admin" ? ` — ${t("adminLevel")}` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
