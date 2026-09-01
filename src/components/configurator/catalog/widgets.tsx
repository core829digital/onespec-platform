"use client";

import { useState } from "react";
import { NumberInput, TextInput } from "../editor-primitives";

const mintBtn =
  "rounded-md bg-[var(--color-mint)] px-2.5 py-1 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-50";
const ghostBtn =
  "rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]";

export function SaveButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className={mintBtn}>
      {busy ? "..." : "Salva"}
    </button>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={ghostBtn}>
      Elimina
    </button>
  );
}

export function AddRow({
  fields,
  onAdd,
}: {
  fields: Array<{ name: string; label: string; type: "text" | "number" }>;
  onAdd: (vals: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--color-mint)] hover:underline"
      >
        + Aggiungi
      </button>
    );
  }

  const complete = fields.every((f) => (vals[f.name] ?? "").trim() !== "");
  return (
    <div className="flex flex-wrap items-end gap-2 border border-[var(--color-border)] rounded-lg p-3">
      {fields.map((f) => {
        const Comp = f.type === "number" ? NumberInput : TextInput;
        return (
          <label key={f.name} className="text-xs text-[var(--color-text-secondary)]">
            {f.label}
            <Comp
              value={vals[f.name] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
              className={`h-8 py-1 mt-1 ${f.type === "number" ? "w-28" : "w-36"}`}
              step={f.type === "number" ? "0.01" : undefined}
            />
          </label>
        );
      })}
      <button
        type="button"
        disabled={!complete}
        onClick={() => {
          onAdd(vals);
          setVals({});
          setOpen(false);
        }}
        className="rounded-md bg-[var(--color-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-40"
      >
        Aggiungi
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
      >
        Annulla
      </button>
    </div>
  );
}

export function ScrollTable({ children, minWidth = 520 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
