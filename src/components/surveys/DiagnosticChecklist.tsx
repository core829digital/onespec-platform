"use client";

import { useMemo } from "react";

export interface DiagnosticData {
  wallType: string;
  mould: boolean;
  floorAccess: string;
  counterFrame: string;
  existingShutter: boolean;
  notes: string;
}

/** Deterministic install recommendation from the checklist — shared with the page. */
export function computeRecommendation(data: DiagnosticData): string {
  const parts: string[] = [];
  if (data.mould) parts.push("Presenza muffe: trattamento antimuffa obbligatorio prima della posa");
  if (data.wallType.includes("Porotherm") || data.wallType.includes("cappotto"))
    parts.push("Parete termica: banda barriera vapore interna + nastro BG1 precomprimato min 15mm");
  else if (data.wallType.includes("Calcestruzzo"))
    parts.push("Parete in calcestruzzo: primer consolidante + banda BG1");
  else if (data.wallType.includes("Pietra"))
    parts.push("Muratura storica: malta traspirante + nastro BG1 morbido");
  if (data.floorAccess.includes("2 senza ascensore") || data.floorAccess.includes("3+"))
    parts.push("Accesso difficile: pianificare autogrù / montacarichi");
  if (data.counterFrame.includes("legno vecchio"))
    parts.push("Controtelaio legno: verificare stato conservativo, eventuale secondo telaio");
  else if (data.counterFrame.includes("Monoblocco"))
    parts.push("Monoblocco termico: sigillatura perimetro con MS Polimero");
  if (data.existingShutter)
    parts.push("Tapparella esistente: predisporre cassonetto coibentato o esterno");
  return parts.join(" · ") || "Nessuna criticità rilevata";
}

interface DiagnosticChecklistProps {
  data: DiagnosticData;
  onChange: (data: DiagnosticData) => void;
  readOnly?: boolean;
}

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

export function DiagnosticChecklist({ data, onChange, readOnly = false }: DiagnosticChecklistProps) {
  const recommendation = useMemo(() => computeRecommendation(data), [data]);

  const handleChange = (field: keyof DiagnosticData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Checklist diagnostica cantiere</h3>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">Tipo parete *</span>
          <select
            value={data.wallType}
            onChange={(e) => handleChange("wallType", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {WALL_TYPES.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">Controtelaio *</span>
          <select
            value={data.counterFrame}
            onChange={(e) => handleChange("counterFrame", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {COUNTER_FRAMES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">Accesso / piano *</span>
          <select
            value={data.floorAccess}
            onChange={(e) => handleChange("floorAccess", e.target.value)}
            disabled={readOnly}
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          >
            {FLOOR_ACCESS.map((f) => (
              <option key={f} value={f}>{f}</option>
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
            Muffe / infiltrazioni
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.existingShutter}
              onChange={(e) => handleChange("existingShutter", e.target.checked)}
              disabled={readOnly}
              className="rounded border-[var(--color-border)]"
            />
            Tapparella / rulou esistente
          </label>
        </div>
      </div>

      <label className="text-sm block">
        <span className="text-[var(--color-muted-fg)] block mb-1">Note diagnostiche</span>
        <textarea
          value={data.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={readOnly}
          placeholder="Osservazioni aggiuntive..."
          className="min-h-[70px] w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      {recommendation && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">💡</span>
            <div className="text-sm text-zinc-800">
              <span className="font-semibold">Raccomandazione: </span>
              {recommendation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}