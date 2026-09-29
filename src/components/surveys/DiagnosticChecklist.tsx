"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

export interface DiagnosticData {
  wallType: string;
  mould: boolean;
  floorAccess: string;
  counterFrame: string;
  existingShutter: boolean;
  notes: string;
}

type RecKey =
  | "recMould"
  | "recThermal"
  | "recConcrete"
  | "recStone"
  | "recAccess"
  | "recWoodFrame"
  | "recMonobloc"
  | "recShutter"
  | "recNone";

/**
 * Deterministic install recommendation from the checklist — shared with the page.
 * Matches the stored option values (kept in their original form so existing
 * surveys stay valid) and writes the advice through `tr`, i.e. in the language
 * of whoever fills in the survey.
 */
export function computeRecommendation(data: DiagnosticData, tr: (key: RecKey) => string): string {
  const parts: string[] = [];
  if (data.mould) parts.push(tr("recMould"));
  if (data.wallType.includes("Porotherm") || data.wallType.includes("cappotto")) parts.push(tr("recThermal"));
  else if (data.wallType.includes("Calcestruzzo")) parts.push(tr("recConcrete"));
  else if (data.wallType.includes("Pietra")) parts.push(tr("recStone"));
  if (data.floorAccess.includes("2 senza ascensore") || data.floorAccess.includes("3+")) parts.push(tr("recAccess"));
  if (data.counterFrame.includes("legno vecchio")) parts.push(tr("recWoodFrame"));
  else if (data.counterFrame.includes("Monoblocco")) parts.push(tr("recMonobloc"));
  if (data.existingShutter) parts.push(tr("recShutter"));
  return parts.join(" · ") || tr("recNone");
}

interface DiagnosticChecklistProps {
  data: DiagnosticData;
  onChange: (data: DiagnosticData) => void;
  readOnly?: boolean;
}

// Stored values (unchanged for existing surveys); labels come from diagnostic.wall<i> / frame<i> / floor<i>.
const WALL_TYPES = [
  "Laterizio Porotherm 30 cm",
  "Laterizio + cappotto EPS 10 cm",
  "Calcestruzzo armato",
  "Pietra / muratura storica",
  "Cartongesso + lana",
];

const COUNTER_FRAMES = [
  "Controtelaio metallico esistente",
  "Monoblocco termico",
  "Telaio in legno vecchio (da mantenere)",
  "Nessun controtelaio — muratura grezza",
];

const FLOOR_ACCESS = [
  "Piano terra — accesso diretto",
  "Piano 1 — ponteggio leggero",
  "Piano 2 senza ascensore",
  "Piano 3+ — necessaria autogrù",
];

/** Display label of a stored checklist value, in the current language (unknown values shown as-is). */
export function diagnosticOptionLabel(
  field: "wallType" | "counterFrame" | "floorAccess",
  value: string | undefined,
  t: (key: string) => string,
): string {
  if (!value) return "—";
  const [list, prefix] =
    field === "wallType" ? [WALL_TYPES, "wall"] : field === "counterFrame" ? [COUNTER_FRAMES, "frame"] : [FLOOR_ACCESS, "floor"];
  const i = list.indexOf(value);
  return i >= 0 ? t(`${prefix}${i}`) : value;
}

export function DiagnosticChecklist({ data, onChange, readOnly = false }: DiagnosticChecklistProps) {
  const t = useTranslations("diagnostic");
  const recommendation = useMemo(() => computeRecommendation(data, (k) => t(k)), [data, t]);


  const handleChange = (field: keyof DiagnosticData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{t("title")}</h3>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">{t("wallType")}</span>
          <select
            value={data.wallType}
            onChange={(e) => handleChange("wallType", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {WALL_TYPES.map((w) => (
              <option key={w} value={w}>{diagnosticOptionLabel("wallType", w, t)}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">{t("counterFrame")}</span>
          <select
            value={data.counterFrame}
            onChange={(e) => handleChange("counterFrame", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {COUNTER_FRAMES.map((c) => (
              <option key={c} value={c}>{diagnosticOptionLabel("counterFrame", c, t)}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">{t("floorAccess")}</span>
          <select
            value={data.floorAccess}
            onChange={(e) => handleChange("floorAccess", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {FLOOR_ACCESS.map((f) => (
              <option key={f} value={f}>{diagnosticOptionLabel("floorAccess", f, t)}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.mould}
              onChange={(e) => handleChange("mould", e.target.checked)}
              disabled={readOnly}
              className="rounded border-[var(--color-border)]"
            />
            {t("mould")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.existingShutter}
              onChange={(e) => handleChange("existingShutter", e.target.checked)}
              disabled={readOnly}
              className="rounded border-[var(--color-border)]"
            />
            {t("shutter")}
          </label>
        </div>
      </div>

      <label className="text-sm block">
        <span className="text-[var(--color-muted-fg)] block mb-1">{t("notes")}</span>
        <textarea
          value={data.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={readOnly}
          placeholder={t("notesPlaceholder")}
          className="min-h-[70px] w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      {recommendation && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">💡</span>
            <div className="text-sm text-zinc-800">
              <span className="font-semibold">{t("recommendation")} </span>
              {recommendation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}