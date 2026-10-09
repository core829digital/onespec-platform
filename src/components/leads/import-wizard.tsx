"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { LEAD_FIELDS, normalizeLeadRow, type LeadField } from "@/shared/leads";
import { isCountryCode, type CountryCode } from "@/shared/validation";
import { buildRows, detectColumns, looksLikeHeader, type ColumnGuess, type ColumnTarget } from "@/lib/lead-import/columns";
import { IMPORT_LIMITS, ImportError, type ImportErrorCode } from "@/lib/lead-import/limits";
import { readLeadFile, type ParsedFile } from "@/lib/lead-import/read-file";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "check" | "run" | "done";
const STEPS: Array<"upload" | "map" | "check" | "run"> = ["upload", "map", "check", "run"];
const IDENTITY: ColumnTarget[] = ["name", "firstName", "lastName", "company", "email", "phone", "phone2"];

/** A cell that would run as a formula when the file is opened in a spreadsheet gets a leading apostrophe. */
const csvSafe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (v: string) => `"${csvSafe(v).replace(/"/g, '""')}"`;

interface Outcome {
  inserted: number;
  duplicates: number;
  invalid: number;
}

export function LeadImportWizard({ tenantId, country, onClose, onDone }: { tenantId: Id<"tenants">; country: string | undefined; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("leadsImport");
  const tl = useTranslations("leads");
  const toMessage = useFriendlyError();
  const startImport = useMutation(api.leads.startImport);
  const importBatch = useMutation(api.leads.importLeadBatch);
  const finishImport = useMutation(api.leads.finishImport);
  const defaultCountry: CountryCode = isCountryCode(country) ? country : "IT";

  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnGuess[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const running = useRef(false);

  const rows = parsed?.sheets[sheetIdx]?.rows ?? [];

  function fileError(e: unknown): string {
    if (e instanceof ImportError) return t(`err.${e.code}` as `err.${ImportErrorCode}`);
    return t("err.CORRUPT_FILE");
  }

  async function load(file: File) {
    setError("");
    setReading(true);
    try {
      const result = await readLeadFile(file);
      setParsed(result);
      applySheet(result, 0);
      setStep("map");
    } catch (e) {
      setError(fileError(e));
    } finally {
      setReading(false);
    }
  }

  function applySheet(file: ParsedFile, idx: number, header?: boolean) {
    const r = file.sheets[idx]?.rows ?? [];
    const h = header ?? (r[0] ? looksLikeHeader(r[0]) : false);
    setSheetIdx(idx);
    setHasHeader(h);
    setMapping(detectColumns(r, h));
  }

  const data = useMemo(() => (step === "check" || step === "run" || step === "done" ? buildRows(rows, hasHeader, mapping) : []), [step, rows, hasHeader, mapping]);
  const check = useMemo(() => {
    const checked = data.map((r) => normalizeLeadRow(r, defaultCountry));
    const bad = checked.flatMap((c, i) => (c.ok ? [] : [{ row: i + (hasHeader ? 2 : 1), code: c.code }]));
    const warn = checked.filter((c) => c.ok && c.warnings.length > 0).length;
    const ok = checked.filter((c) => c.ok);
    const tally = new Map<string, number>();
    for (const c of checked) if (c.ok) for (const w of c.warnings) { const k = w.code.startsWith("VAT_") ? "VAT" : w.code; tally.set(k, (tally.get(k) ?? 0) + 1); }
    return { checked, bad, warn, okCount: ok.length, tally: [...tally.entries()] };
  }, [data, defaultCountry, hasHeader]);

  const hasIdentity = mapping.some((m) => IDENTITY.includes(m.target));
  const targetOptions: Array<{ value: ColumnTarget; label: string }> = [
    ...LEAD_FIELDS.map((f) => ({ value: f as ColumnTarget, label: tl(`field.${f}`) })),
    { value: "extra", label: t("extra") },
    { value: "ignore", label: t("ignore") },
  ];

  async function runImport() {
    if (!parsed || running.current || data.length === 0) return;
    running.current = true;
    setError("");
    setStep("run");
    setProgress(0);
    try {
      const kind = parsed.kind;
      const importId = await startImport({ tenantId, fileName: parsed.fileName, fileKind: kind, totalRows: data.length });
      let done = 0;
      for (let i = 0; i < data.length; i += IMPORT_LIMITS.batchRows) {
        const batch = data.slice(i, i + IMPORT_LIMITS.batchRows);
        await importBatch({ tenantId, importId, startRow: i + (hasHeader ? 2 : 1), rows: batch });
        done += batch.length;
        setProgress(done);
      }
      const result = await finishImport({ importId });
      setOutcome({ inserted: result.inserted, duplicates: result.duplicates, invalid: result.invalid });
      setStep("done");
      onDone();
    } catch (e) {
      setError(`${t("failed")} ${toMessage(e)}`);
      setStep("check");
    } finally {
      running.current = false;
    }
  }

  function downloadRejected() {
    const header = ["Row", "Reason", ...(hasHeader ? (rows[0] ?? []) : [])];
    const lines = [header.map(csvCell).join(",")];
    for (const b of check.bad) {
      const original = rows[b.row - 1] ?? [];
      lines.push([String(b.row), t(`reason.${b.code}` as `reason.${string}`), ...original].map(csvCell).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-rejected.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const stepIndex = STEPS.indexOf(step === "done" ? "run" : step);
  const busy = reading || step === "run";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 pt-[env(safe-area-inset-top,0px)] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-import-title"
        data-no-swipe
        data-testid="lead-import-wizard"
        className="flex max-h-[100dvh] w-full max-w-4xl flex-col rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 pb-3 pt-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="lead-import-title" className="text-lg font-semibold text-[var(--color-text)]">{t("title")}</h2>
            <ol className="mt-2 flex flex-wrap gap-2 text-xs" aria-label={t("title")}>
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === stepIndex ? "step" : undefined} className={cn("rounded-full border px-2.5 py-1", i === stepIndex ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] font-semibold text-[var(--color-mint-text)]" : i < stepIndex ? "border-[var(--color-border)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]")}>
                  {i + 1}. {t(`steps.${s === "run" ? "import" : s}`)}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={onClose} disabled={step === "run"} aria-label={t("close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? <p role="alert" className="mb-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">{error}</p> : null}

          {step === "upload" && (
            <div>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void load(f); }}
                className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors", dragging ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)] bg-[var(--color-bg)]")}
              >
                {reading ? <Loader2 className="animate-spin text-[var(--color-mint-text)]" size={32} /> : <FileSpreadsheet className="text-[var(--color-mint-text)]" size={32} aria-hidden="true" />}
                <span className="text-base font-semibold text-[var(--color-text)]">{reading ? t("reading") : t("dropTitle")}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">{t("dropHint")}</span>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mint)] px-4 text-sm font-bold text-[var(--color-mint-dark)]"><Upload size={16} aria-hidden="true" />{t("choose")}</span>
                <input
                  type="file"
                  data-testid="lead-file-input"
                  className="sr-only"
                  accept=".xlsx,.csv,.docx,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void load(f); }}
                />
              </label>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{t("formats")}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("privacy")}</p>
            </div>
          )}

          {step === "map" && parsed && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {parsed.sheets.length > 1 ? (
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                    {t("sheet")}
                    <select value={sheetIdx} onChange={(e) => applySheet(parsed, Number(e.target.value))} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2">
                      {parsed.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="flex min-h-10 items-center gap-2 text-sm text-[var(--color-text)]">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => applySheet(parsed, sheetIdx, e.target.checked)} className="h-4 w-4 accent-[var(--color-mint)]" />
                  {t("firstRowHeader")}
                </label>
                <span className="text-sm text-[var(--color-text-secondary)]">{t("rowsFound", { count: Math.max(0, rows.length - (hasHeader ? 1 : 0)) })}</span>
              </div>
              {parsed.sheets[sheetIdx]?.truncated ? <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{t("truncated")}</p> : null}
              <p className="text-sm text-[var(--color-text-secondary)]">{t("mapHint")}</p>
              <ul className="space-y-2" aria-label={t("steps.map")}>
                {mapping.map((m, i) => (
                  <li key={m.index} className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 sm:grid-cols-[1fr_16rem] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]" title={m.header}>{m.header}</p>
                      <p className="truncate text-xs text-[var(--color-text-secondary)]">{m.samples.join(" · ") || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`${t("colBecomes")}: ${m.header}`}
                        value={m.target}
                        onChange={(e) => setMapping((cur) => cur.map((c, j) => (j === i ? { ...c, target: e.target.value as ColumnTarget, confidence: "high" } : c)))}
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2 text-sm text-[var(--color-text)] sm:min-h-10"
                      >
                        {targetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {m.confidence !== "none" && m.target !== "extra" && m.target !== "ignore" ? (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.confidence === "high" ? "bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                          {m.confidence === "high" ? t("sure") : m.confidence === "medium" ? t("probable") : t("check")}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {!hasIdentity ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t("needIdentity")}</p> : null}
            </div>
          )}

          {step === "check" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--color-text)]">{t("previewTitle")}</h3>
              <p data-testid="lead-check-summary" className="text-sm font-medium text-[var(--color-text)]">{t("summary", { ok: check.okCount - check.warn, warn: check.warn, bad: check.bad.length })}</p>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("previewSample")}</p>
                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead className="bg-[var(--color-bg)] text-xs text-[var(--color-text-secondary)]"><tr>
                      {(["name", "email", "phone", "city"] as LeadField[]).map((f) => <th key={f} className="px-3 py-2 text-left">{tl(`field.${f}`)}</th>)}
                    </tr></thead>
                    <tbody>
                      {check.checked.filter((c) => c.ok).slice(0, 6).map((c, i) => c.ok ? (
                        <tr key={i} className="border-t border-[var(--color-border)]">
                          <td className="px-3 py-2">{c.lead.name}</td><td className="px-3 py-2">{c.lead.email ?? "—"}</td><td className="px-3 py-2">{c.lead.phone ?? "—"}</td><td className="px-3 py-2">{c.lead.city ?? "—"}</td>
                        </tr>
                      ) : null)}
                    </tbody>
                  </table>
                </div>
              </div>
              {check.tally.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("warningsTitle")}</p>
                  <ul className="space-y-1 text-sm text-[var(--color-text)]">
                    {check.tally.map(([code, n]) => <li key={code}>{t(`warn.${code}` as `warn.${string}`)} — <span className="tabular-nums font-semibold">{n}</span></li>)}
                  </ul>
                </div>
              ) : null}
              {check.bad.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("problemsTitle")}</p>
                  <ul className="space-y-1 text-sm text-[var(--color-text)]">
                    {check.bad.slice(0, 10).map((b) => <li key={b.row}><span className="font-semibold">{t("rowN", { n: b.row })}</span> — {t(`reason.${b.code}` as `reason.${string}`)}</li>)}
                  </ul>
                </div>
              ) : null}
              {check.okCount === 0 ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t("nothingToImport")}</p> : null}
            </div>
          )}

          {step === "run" && (
            <div className="py-10 text-center" data-testid="lead-import-progress">
              <Loader2 className="mx-auto animate-spin text-[var(--color-mint-text)]" size={36} aria-hidden="true" />
              <p className="mt-4 text-base font-semibold text-[var(--color-text)]">{t("progress", { done: progress, total: data.length })}</p>
              <div className="mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-[var(--color-bg)]" role="progressbar" aria-valuemin={0} aria-valuemax={data.length} aria-valuenow={progress}>
                <div className="h-full rounded-full bg-[var(--color-mint)] transition-all" style={{ width: `${data.length ? Math.round((progress / data.length) * 100) : 0}%` }} />
              </div>
              <p className="mt-4 text-xs text-[var(--color-text-secondary)]">{t("doNotClose")}</p>
            </div>
          )}

          {step === "done" && outcome && (
            <div className="py-6 text-center" data-testid="lead-import-done">
              <CheckCircle2 className="mx-auto text-[var(--color-mint-text)]" size={40} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-[var(--color-text)]">{t("doneTitle")}</h3>
              <ul className="mt-3 space-y-1 text-sm text-[var(--color-text)]">
                <li className="font-semibold">{t("doneInserted", { count: outcome.inserted })}</li>
                {outcome.duplicates > 0 ? <li>{t("doneDuplicates", { count: outcome.duplicates })}</li> : null}
                {outcome.invalid > 0 ? <li>{t("doneInvalid", { count: outcome.invalid })}</li> : null}
              </ul>
              {check.bad.length > 0 ? <button type="button" onClick={downloadRejected} className="mt-4 min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]">{t("downloadRejected")}</button> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          {step === "done" ? (
            <>
              <button type="button" onClick={() => { setParsed(null); setOutcome(null); setStep("upload"); }} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]">{t("again")}</button>
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)]">{t("viewLeads")}</button>
            </>
          ) : step === "run" ? (
            <span className="text-xs text-[var(--color-text-secondary)]">{t("doNotClose")}</span>
          ) : (
            <>
              <button type="button" disabled={step === "upload"} onClick={() => setStep(step === "check" ? "map" : "upload")} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:invisible">{t("back")}</button>
              {step === "map" ? (
                <button type="button" disabled={!hasIdentity} onClick={() => setStep("check")} className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50">{t("next")}</button>
              ) : step === "check" ? (
                <button type="button" data-testid="lead-import-go" disabled={check.okCount === 0} onClick={() => void runImport()} className="min-h-11 rounded-xl bg-[var(--color-mint)] px-5 text-sm font-bold text-[var(--color-mint-dark)] disabled:opacity-50">{t("importButton", { count: data.length })}</button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
