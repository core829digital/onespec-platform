"use client";

import { useState } from "react";
import type { GroupId } from "@/lib/render3d/render3d-ui-text";

export interface StudioSwatch {
  key: string;
  label: string;
  hex: string;
  textureUrl?: string;
}

export interface StudioOption {
  key: string;
  label: string;
}

/**
 * One control of the floating menu. The adapters of the configurators (widget, quote editor, Showroom, wizard) describe their options
 * with these, and the studio draws them the same way everywhere: the menu does not know where the options come from.
 */
export type FieldDef =
  | { kind: "swatches"; id: string; label: string; value: string; options: StudioSwatch[]; onChange: (key: string) => void }
  | { kind: "select"; id: string; label: string; value: string; options: StudioOption[]; onChange: (key: string) => void; disabled?: boolean; hint?: string }
  | { kind: "chips"; id: string; label: string; value: string; options: StudioOption[]; onChange: (key: string) => void }
  | { kind: "toggle"; id: string; label: string; value: boolean; onChange: (v: boolean) => void }
  | { kind: "stepper"; id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }
  | { kind: "number"; id: string; label: string; value: number; min: number; max: number; unit?: string; onCommit: (n: number) => void }
  | { kind: "note"; id: string; text: string };

export interface GroupDef {
  id: GroupId;
  fields: FieldDef[];
}

function NumberField({ f }: { f: Extract<FieldDef, { kind: "number" }> }) {
  const [edit, setEdit] = useState<string | null>(null);
  const text = edit ?? String(f.value);
  const n = Number(text.replace(",", "."));
  const bad = !(n >= f.min && n <= f.max);
  const commit = () => {
    if (!bad) {
      f.onCommit(Math.round(n));
      setEdit(null);
    }
  };
  return (
    <label style={{ display: "block" }}>
      <span className="r3d-label" style={{ display: "block" }}>
        {f.label}
        {f.unit ? ` (${f.unit})` : ""}
      </span>
      <input
        className="r3d-input"
        inputMode="numeric"
        value={text}
        aria-invalid={bad}
        data-testid={`r3d-field-${f.id}`}
        style={bad ? { borderColor: "#f87171" } : undefined}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="r3d-note">
        {f.min}–{f.max}
        {f.unit ? ` ${f.unit}` : ""}
      </span>
    </label>
  );
}

/** Draws the fields of a group. */
export function Fields({ fields }: { fields: FieldDef[] }) {
  return (
    <>
      {fields.map((f) => {
        switch (f.kind) {
          case "swatches":
            return (
              <div key={f.id}>
                <p className="r3d-label">{f.label}</p>
                <div className="r3d-swatches">
                  {f.options.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      className="r3d-swatch"
                      aria-label={o.label}
                      title={o.label}
                      aria-pressed={f.value === o.key}
                      data-testid={`r3d-${f.id}-${o.key}`}
                      onClick={() => f.onChange(o.key)}
                      style={{ background: o.hex, backgroundImage: o.textureUrl ? `url(${o.textureUrl})` : undefined }}
                    />
                  ))}
                </div>
              </div>
            );
          case "select":
            return (
              <label key={f.id} style={{ display: "block" }}>
                <span className="r3d-label" style={{ display: "block" }}>{f.label}</span>
                <select className="r3d-select" value={f.value} disabled={f.disabled} data-testid={`r3d-select-${f.id}`} onChange={(e) => f.onChange(e.target.value)}>
                  {(f.options.some((o) => o.key === f.value) ? f.options : [...f.options, { key: f.value, label: f.value }]).map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {f.hint ? <span className="r3d-note">{f.hint}</span> : null}
              </label>
            );
          case "chips":
            return (
              <div key={f.id}>
                <p className="r3d-label">{f.label}</p>
                <div className="r3d-chips" role="group" aria-label={f.label}>
                  {f.options.map((o) => (
                    <button key={o.key} type="button" className="r3d-chip" aria-pressed={f.value === o.key} data-testid={`r3d-${f.id}-${o.key}`} onClick={() => f.onChange(o.key)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          case "toggle":
            return (
              <button key={f.id} type="button" className="r3d-chip" aria-pressed={f.value} data-testid={`r3d-toggle-${f.id}`} onClick={() => f.onChange(!f.value)} style={{ justifyContent: "flex-start", textAlign: "left" }}>
                {f.label}
              </button>
            );
          case "stepper":
            return (
              <div key={f.id}>
                <p className="r3d-label">{f.label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" className="r3d-chip" aria-label="−" data-testid={`r3d-${f.id}-dec`} disabled={f.value <= f.min} onClick={() => f.onChange(f.value - 1)} style={{ minWidth: 48 }}>−</button>
                  <strong data-testid={`r3d-${f.id}-value`} style={{ minWidth: 28, textAlign: "center", fontSize: 18 }}>{f.value}</strong>
                  <button type="button" className="r3d-chip" aria-label="+" data-testid={`r3d-${f.id}-inc`} disabled={f.value >= f.max} onClick={() => f.onChange(f.value + 1)} style={{ minWidth: 48 }}>+</button>
                </div>
              </div>
            );
          case "number":
            return <NumberField key={f.id} f={f} />;
          case "note":
            return <p key={f.id} className="r3d-note">{f.text}</p>;
        }
      })}
    </>
  );
}
