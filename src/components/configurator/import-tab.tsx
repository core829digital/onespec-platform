"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCsv } from "@/lib/csv-parse";
import { Section, SelectInput } from "./editor-primitives";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useLocale, useTranslations } from "next-intl";

type Target = "materials" | "glazing" | "finish" | "hardware";

const TARGETS: Target[] = ["materials", "glazing", "finish", "hardware"];

// Labels come from editor.import.field_<k>.
const FIELDS: Record<Target, Array<{ k: string; price?: boolean }>> = {
  materials: [{ k: "key" }, { k: "label" }, { k: "basePerM2Cents", price: true }, { k: "profilePerMlCents", price: true }],
  glazing: [{ k: "key" }, { k: "label" }, { k: "priceCents", price: true }],
  finish: [{ k: "key" }, { k: "label" }, { k: "priceCents", price: true }],
  hardware: [{ k: "key" }, { k: "label" }, { k: "priceCents", price: true }, { k: "kind" }],
};

const toCents = (s: string) => Math.round(parseFloat(String(s).replace(",", ".")) * 100);

export function ImportTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const t = useTranslations("editor.import");
  const locale = useLocale();
  const tf = useFriendlyError();
  const importRows = useMutation(api.catalogImport.importRows);
  const undoImport = useMutation(api.catalogImport.undoImport);
  const history = useQuery(api.catalogImport.listImports, { configuratorId });

  const [target, setTarget] = useState<Target>("materials");
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    summary: { created: number; updated: number; rejected: number };
    rejected: Array<{ row: number; reason: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const header = grid?.[0] ?? [];
  const dataRows = useMemo(() => grid?.slice(1) ?? [], [grid]);

  function onFile(file: File) {
    setErr("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 2) {
        setErr(t("errEmpty"));
        return;
      }
      setGrid(parsed);
      // Auto-map by header name match.
      const auto: Record<string, number> = {};
      FIELDS[target].forEach((f) => {
        const idx = parsed[0].findIndex((h) =>
          h.trim().toLowerCase().includes(f.k.toLowerCase().replace("cents", "").slice(0, 4)),
        );
        if (idx >= 0) auto[f.k] = idx;
      });
      setMap(auto);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!grid) return;
    const fields = FIELDS[target];
    if (fields.some((f) => map[f.k] === undefined)) {
      setErr(t("errMap"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const rows = dataRows.map((r) => {
        const obj: Record<string, string | number> = {};
        for (const f of fields) {
          const raw = (r[map[f.k]] ?? "").trim();
          obj[f.k] = f.price ? toCents(raw) : raw;
        }
        return obj as { key: string; label: string };
      });
      const res = await importRows({ configuratorId, target, rows });
      setResult(res);
      setGrid(null);
      setMap({});
    } catch (e) {
      setErr(tf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <Section title={t("step1")}>
        <SelectInput
          value={target}
          onChange={(e) => {
            setTarget(e.target.value as Target);
            setGrid(null);
            setMap({});
            setResult(null);
          }}
        >
          {TARGETS.map((tg) => (
            <option key={tg} value={tg}>
              {t(`target_${tg}`)}
            </option>
          ))}
        </SelectInput>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-mint)] cursor-pointer">
          {t("chooseFile")}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </Section>

      {grid ? (
        <Section title={t("step2")} description={t("rowsDetected", { count: dataRows.length })}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS[target].map((f) => (
              <label key={f.k} className="text-sm">
                <span className="block text-[var(--color-text)] mb-1">{t(`field_${f.k}`)}</span>
                <SelectInput
                  value={map[f.k] ?? ""}
                  onChange={(e) => setMap((m) => ({ ...m, [f.k]: Number(e.target.value) }))}
                >
                  <option value="">{t("columnPlaceholder")}</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || t("columnN", { n: i + 1 })}
                    </option>
                  ))}
                </SelectInput>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs min-w-[480px]" aria-label={t("previewAria")}>
              <thead>
                <tr>
                  {header.map((h, i) => (
                    <th key={i} className="text-left px-2 py-1 text-[var(--color-text-secondary)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {dataRows.slice(0, 5).map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className="px-2 py-1 text-[var(--color-text)]">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {dataRows.length > 5 ? (
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t("moreRows", { count: dataRows.length - 5 })}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={runImport}
            disabled={busy}
            className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {busy ? t("importing") : t("importN", { count: dataRows.length })}
          </button>
        </Section>
      ) : null}

      {result ? (
        <Section title={t("resultTitle")}>
          <p className="text-sm text-[var(--color-text)]">
            {t("resultSummary", {
              created: result.summary.created,
              updated: result.summary.updated,
              rejected: result.summary.rejected,
            })}
          </p>
          {result.rejected.length > 0 ? (
            <div className="mt-2 rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
              {result.rejected.map((r) => (
                <p key={r.row} className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                  {t("rowReason", { row: r.row, reason: r.reason })}
                </p>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {history && history.length > 0 ? (
        <Section title={t("historyTitle")}>
          <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
            {history.map((h) => (
              <div key={h._id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[var(--color-text)]">
                  {new Date(h.importedAt).toLocaleString(locale)} ·{" "}
                  {TARGETS.includes(h.target as Target) ? t(`target_${h.target}`) : h.target} ·{" "}
                  {t("historyRows", { count: h.summary.created + h.summary.updated })}
                </span>
                {h.undone ? (
                  <span className="text-xs text-[var(--color-text-secondary)]">{t("undone")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => undoImport({ importId: h._id })}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)]"
                  >
                    {t("undo")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
