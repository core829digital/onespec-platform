"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCsv } from "@/lib/csv-parse";
import { Section, SelectInput } from "./editor-primitives";

type Target = "materials" | "glazing" | "finish" | "hardware";

const TARGETS: Array<{ v: Target; l: string }> = [
  { v: "materials", l: "Materiali" },
  { v: "glazing", l: "Vetri" },
  { v: "finish", l: "Finiture" },
  { v: "hardware", l: "Ferramenta" },
];

const FIELDS: Record<Target, Array<{ k: string; l: string; price?: boolean }>> = {
  materials: [
    { k: "key", l: "Chiave" },
    { k: "label", l: "Etichetta" },
    { k: "basePerM2Cents", l: "Prezzo €/m²", price: true },
    { k: "profilePerMlCents", l: "Prezzo €/ml profilo", price: true },
  ],
  glazing: [
    { k: "key", l: "Chiave" },
    { k: "label", l: "Etichetta" },
    { k: "priceCents", l: "Prezzo €", price: true },
  ],
  finish: [
    { k: "key", l: "Chiave" },
    { k: "label", l: "Etichetta" },
    { k: "priceCents", l: "Prezzo €", price: true },
  ],
  hardware: [
    { k: "key", l: "Chiave" },
    { k: "label", l: "Etichetta" },
    { k: "priceCents", l: "Prezzo €", price: true },
    { k: "kind", l: "Tipo (hardware/hardwareColor/sashType/screen/threshold/misc)" },
  ],
};

const toCents = (s: string) => Math.round(parseFloat(String(s).replace(",", ".")) * 100);

export function ImportTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
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
        setErr("Il file non contiene righe di dati.");
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
      setErr("Mappa tutte le colonne richieste prima di importare.");
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
      setErr(e instanceof Error ? e.message : "Errore nell'importazione");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Importa un listino da file CSV. Le colonne dei prezzi sono in euro. Chiavi già presenti vengono
        aggiornate, le nuove vengono aggiunte. Ogni import può essere annullato.
      </p>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <Section title="1 · Cosa importi">
        <SelectInput
          value={target}
          onChange={(e) => {
            setTarget(e.target.value as Target);
            setGrid(null);
            setMap({});
            setResult(null);
          }}
        >
          {TARGETS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </SelectInput>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-mint)] cursor-pointer">
          Scegli file CSV
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
        <Section title="2 · Mappa le colonne" description={`${dataRows.length} righe rilevate.`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS[target].map((f) => (
              <label key={f.k} className="text-sm">
                <span className="block text-[var(--color-text)] mb-1">{f.l}</span>
                <SelectInput
                  value={map[f.k] ?? ""}
                  onChange={(e) => setMap((m) => ({ ...m, [f.k]: Number(e.target.value) }))}
                >
                  <option value="">— colonna —</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Colonna ${i + 1}`}
                    </option>
                  ))}
                </SelectInput>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs min-w-[480px]">
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
                … e altre {dataRows.length - 5} righe
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={runImport}
            disabled={busy}
            className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {busy ? "Importazione..." : `Importa ${dataRows.length} righe`}
          </button>
        </Section>
      ) : null}

      {result ? (
        <Section title="Esito importazione">
          <p className="text-sm text-[var(--color-text)]">
            {result.summary.created} aggiunte · {result.summary.updated} aggiornate ·{" "}
            {result.summary.rejected} scartate
          </p>
          {result.rejected.length > 0 ? (
            <div className="mt-2 rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
              {result.rejected.map((r) => (
                <p key={r.row} className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                  Riga {r.row}: {r.reason}
                </p>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {history && history.length > 0 ? (
        <Section title="Cronologia import">
          <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
            {history.map((h) => (
              <div key={h._id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[var(--color-text)]">
                  {new Date(h.importedAt).toLocaleString("it-IT")} · {h.target} ·{" "}
                  {h.summary.created + h.summary.updated} righe
                </span>
                {h.undone ? (
                  <span className="text-xs text-[var(--color-text-secondary)]">annullato</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => undoImport({ importId: h._id })}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)]"
                  >
                    Annulla
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
