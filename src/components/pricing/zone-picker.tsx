"use client";

import { useTranslations } from "next-intl";
import { ZONE_REGIONS, type PriceZone } from "@/shared/standard-pricing";

const ZONES: PriceZone[] = ["nord", "centro", "sud"];

/**
 * Where in Italy the installer works: picks which standard price list applies.
 * Controlled radio group (arrow keys move the choice), shared by onboarding and settings.
 */
export function ZonePicker({ value, onChange, disabled }: { value: PriceZone | null; onChange: (z: PriceZone) => void; disabled?: boolean }) {
  const t = useTranslations("priceZone");
  return (
    <div role="radiogroup" aria-label={t("label")} className="grid gap-3 sm:grid-cols-3">
      {ZONES.map((z) => {
        const selected = value === z;
        return (
          <label
            key={z}
            className={`cursor-pointer rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[var(--color-mint)] ${
              selected ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)] hover:border-[var(--color-mint)]"
            } ${disabled ? "opacity-50" : ""}`}
          >
            <input
              type="radio"
              name="price-zone"
              value={z}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(z)}
              className="sr-only"
            />
            <span className="block font-bold text-[var(--color-text)]">{t(`${z}.name`)}</span>
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{t(`${z}.note`)}</span>
            <span className="mt-2 block text-xs text-[var(--color-text-secondary)]">{ZONE_REGIONS[z].join(", ")}</span>
          </label>
        );
      })}
    </div>
  );
}
