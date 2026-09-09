"use client";

import { useState, useCallback } from "react";

interface VisualSimulatorProps {
  productType: "finestra1" | "finestra2" | "porta1" | "porta2" | "scorrevole";
  onProductTypeChange: (type: "finestra1" | "finestra2" | "porta1" | "porta2" | "scorrevole") => void;
  width: number;
  height: number;
  onWidthChange: (w: number) => void;
  onHeightChange: (h: number) => void;
  material: string;
  color: string;
  sashes: Array<{
    type: string;
    direction: "left" | "right";
    active: boolean;
    hardware: string;
    hardwareColor: string;
    widthRatio: number;
    heightRatio: number;
    handleHeightMm?: number;
    isMain: boolean;
  }>;
  uwValue: number;
  uwEligible: boolean;
  onSashCountChange: (count: number) => void;
  sashCount: number;
}

const PRODUCT_TYPES = [
  { key: "finestra1", label: "Finestra 1 anta", icon: "🪟" },
  { key: "finestra2", label: "Finestra 2 ante", icon: "🪟" },
  { key: "porta1", label: "Portafinestra 1 anta", icon: "🚪" },
  { key: "porta2", label: "Portafinestra 2 ante", icon: "🚪" },
  { key: "scorrevole", label: "Scorrevole / Alzante", icon: "↔️" },
] as const;

const SLIDER_STEP = 50;
const MIN_DIM = 450;
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 3000;

export function VisualSimulator({
  productType,
  onProductTypeChange,
  width,
  height,
  onWidthChange,
  onHeightChange,
  material,
  color,
  sashes,
  uwValue,
  uwEligible,
  onSashCountChange,
  sashCount,
}: VisualSimulatorProps) {
  const getMaxWidth = (type: string) => {
    if (type === "scorrevole") return 6000;
    if (type.startsWith("porta")) return 3000;
    return 2000;
  };

  const getMaxHeight = (type: string) => {
    if (type === "scorrevole") return 3000;
    return 2800;
  };

  const maxW = getMaxWidth(productType);
  const maxH = getMaxHeight(productType);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TYPES.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onProductTypeChange(key as typeof productType)}
            className={`flex-1 min-w-[80px] py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              productType === key
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200"
            }`}
            aria-pressed={productType === key}
          >
            <span className="block text-lg">{icon}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">Larghezza (mm)</span>
          <input
            type="range"
            min={MIN_DIM}
            max={maxW}
            step={SLIDER_STEP}
            value={width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
            aria-label={`Larghezza ${width}mm`}
          />
          <div className="flex justify-between text-xs text-[var(--color-muted-fg)] mt-1">
            <span>{MIN_DIM}</span>
            <span className="font-mono font-semibold">{width}</span>
            <span>{maxW}</span>
          </div>
        </label>

        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)] block mb-1">Altezza (mm)</span>
          <input
            type="range"
            min={MIN_DIM}
            max={maxH}
            step={SLIDER_STEP}
            value={height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
            aria-label={`Altezza ${height}mm`}
          />
          <div className="flex justify-between text-xs text-[var(--color-muted-fg)] mt-1">
            <span>{MIN_DIM}</span>
            <span className="font-mono font-semibold">{height}</span>
            <span>{maxH}</span>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-muted-fg)]">Uw medio:</span>
          <span className="text-2xl font-bold font-mono text-zinc-900">
            {uwValue.toFixed(2)}
          </span>
          <span className="text-sm text-zinc-500">W/m²K</span>
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
          uwEligible
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
        }`}>
          {uwEligible ? "✓ Idoneo detrazioni" : "✗ Non idoneo"}
        </span>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] p-3 bg-white">
        <h3 className="text-sm font-semibold mb-2">Ante ({sashCount})</h3>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onSashCountChange(Math.max(1, sashCount - 1))}
            disabled={sashCount <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            − Anta
          </button>
          <button
            onClick={() => onSashCountChange(sashCount + 1)}
            disabled={sashCount >= 6}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Anta
          </button>
          <span className="ml-auto text-sm text-[var(--color-muted-fg)]">
            Max 6 ante
          </span>
        </div>

        <div className="space-y-2">
          {sashes.map((sash, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[var(--color-border)] p-3 bg-zinc-50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  Anta {idx + 1} {sash.isMain && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded">PRINCIPALE</span>}
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sash.active}
                    onChange={() => {}}
                    className="rounded border-[var(--color-border)]"
                  />
                  Attiva
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Tipo</span>
                  <select
                    value={sash.type}
                    onChange={(e) => {}}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  >
                    <option value="fissa">Fissa</option>
                    <option value="battente">Battente</option>
                    <option value="anta-ribalta">Anta-ribalta</option>
                    <option value="vasistas">Vasistas</option>
                    <option value="scorrevole">Scorrevole</option>
                    <option value="alzante">Alzante scorrevole</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Direzione</span>
                  <select
                    value={sash.direction}
                    onChange={(e) => {}}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  >
                    <option value="left">Sinistra</option>
                    <option value="right">Destra</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Larghezza %</span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={Math.round(sash.widthRatio * 100)}
                    onChange={(e) => {}}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                  />
                  <span className="text-xs text-[var(--color-muted-fg)] mt-1">
                    {Math.round(sash.widthRatio * 100)}%
                  </span>
                </label>

                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Altezza %</span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(sash.heightRatio * 100)}
                    onChange={(e) => {}}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                  />
                  <span className="text-xs text-[var(--color-muted-fg)] mt-1">
                    {Math.round(sash.heightRatio * 100)}%
                  </span>
                </label>

                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Maniglia (mm)</span>
                  <input
                    type="number"
                    value={sash.handleHeightMm || ""}
                    onChange={(e) => {}}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                    placeholder="H/2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Ferramenta</span>
                  <select
                    value={sash.hardware}
                    onChange={(e) => {}}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  >
                    <option value="standard">Standard</option>
                    <option value="RC2">RC2 Sicurezza</option>
                    <option value="hidden">A scomparsa</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className="text-[var(--color-muted-fg)] block mb-1">Colore ferramenta</span>
                  <div className="flex gap-2">
                    {["white", "silver", "black"].map((c) => (
                      <label key={c} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`hw-color-${idx}`}
                          value={c}
                          checked={sash.hardwareColor === c}
                          onChange={() => {}}
                          className="w-4 h-4 accent-zinc-900"
                        />
                        <span className="text-xs capitalize">{c}</span>
                      </label>
                    ))}
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}