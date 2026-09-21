"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CATEGORY_DEFS, PIECE_CATEGORIES, type PieceCategory } from "@/shared/configurator-model";
import { calculatePrice, computeItemThermal, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { SASH_MIN, type EditorSash } from "@/shared/sash-rules";
import {
  addSash,
  applyFrameToAll,
  duplicateItem,
  moveItem,
  patchSash,
  pieceIssues,
  removeSash,
  resizeDivider,
  setCategory,
  setHeight,
  type PieceIssue,
} from "@/shared/piece-ops";
import { defaultItem } from "@/shared/item-defaults";
import { WindowDrawing } from "@/lib/drawing";
import { SashPanel } from "@/components/quotes/sash-panel";
import { catalogChoices, labelOf } from "./catalog-labels";
import { PieceForm } from "./piece-form";

interface Props {
  payload: CatalogPayload;
  locale: string;
  items: ProjectItem[];
  onChange: (items: ProjectItem[]) => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
}

const eur = (cents: number, locale: string) => (cents / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

export function PiecesEditor({ payload, locale, items, onChange, activeIndex, onActiveChange }: Props) {
  const t = useTranslations("pieces");
  const [selectedSash, setSelectedSash] = useState<number | null>(0);
  const active = items[activeIndex] ?? items[0];
  const choices = useMemo(() => catalogChoices(payload, active?.material ?? "pvc", locale), [payload, active?.material, locale]);
  const lotFrame = items[0]?.frameType;
  const keys = useMemo(
    () => ({ hardware: choices.hardware[0]?.[0], hardwareColor: choices.hardwareColors.find(([k]) => k === "silver")?.[0] ?? choices.hardwareColors[0]?.[0] }),
    [choices],
  );

  const update = (index: number, next: ProjectItem) => onChange(items.map((it, i) => (i === index ? next : it)));
  const patchActive = (patch: Partial<ProjectItem>) => active && update(activeIndex, { ...active, ...patch });

  function addPiece(category: PieceCategory) {
    const fresh = defaultItem(payload, category);
    fresh.frameType = lotFrame ?? fresh.frameType;
    onChange([...items, fresh]);
    onActiveChange(items.length);
    setSelectedSash(0);
  }

  function changeMaterial(key: string) {
    if (!active) return;
    const next = catalogChoices(payload, key, locale);
    patchActive({
      material: key,
      quality: { ...active.quality, [key]: next.qualities[0]?.key ?? "" },
      profileSystem: next.profiles[0]?.key,
    });
  }

  function removePiece(index: number) {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
    onActiveChange(Math.max(0, Math.min(index, items.length - 2)));
  }

  const issues = active ? pieceIssues(active, payload) : [];
  const thermal = active ? computeItemThermal(payload, active) : null;
  const sash = active && selectedSash !== null ? active.sashes[selectedSash] : undefined;

  const issueText = (i: PieceIssue) => {
    switch (i.code) {
      case "size": return t("issue.size", { axis: t(i.axis), min: i.min, max: i.max });
      case "singleLeafMax": return t("issue.singleLeafMax", { axis: t(i.axis), max: i.max });
      case "leafWidth": return t("issue.leafWidth", { leaf: i.leaf + 1, got: i.got, min: i.min });
      case "leafHeight": return t("issue.leafHeight", { leaf: i.leaf + 1, got: i.got, min: i.min });
      case "mix": return i.reason;
      case "unknownKey": return t("issue.unknownKey", { field: i.field, key: i.key });
    }
  };

  return (
    <div className="space-y-5">
      {/* categories */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("addPiece")}</p>
        <div className="flex flex-wrap gap-2">
          {PIECE_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => addPiece(c)} className="min-h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">
              + {CATEGORY_DEFS[c].labels[locale] ?? CATEGORY_DEFS[c].labels.it}
            </button>
          ))}
        </div>
      </div>

      {/* telaio for the whole lot */}
      {choices.frames.length > 0 && items.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {t("lotFrame")} <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] normal-case text-amber-600">{t("lotFrameHint")}</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {choices.frames.map((f) => (
              <button key={f.key} type="button" aria-pressed={lotFrame === f.key} onClick={() => onChange(applyFrameToAll(items, f.key))} className={`rounded-lg border p-3 text-left transition-colors ${lotFrame === f.key ? "border-[var(--color-mint)] bg-[var(--color-mint)]/10" : "border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)]"}`}>
                <span className="block text-sm font-semibold text-[var(--color-text)]">{f.label}</span>
                {f.description ? <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">{f.description}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* piece list */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">{t("empty")}</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((it, idx) => {
            const def = CATEGORY_DEFS[it.category ?? (it.productType === "balconyDoor" ? "porta1" : "finestra1")];
            const price = calculatePrice(payload, [it]).priceCents;
            return (
              <div key={idx} className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${activeIndex === idx ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"}`}>
                <button type="button" onClick={() => { onActiveChange(idx); setSelectedSash(0); }} className="text-left font-bold">
                  {t("position", { n: idx + 1 })} · {def.labels[locale] ?? def.labels.it} · {it.width}×{it.height}
                  <span className="ml-1 font-mono font-normal">{eur(price, locale)}</span>
                </button>
                <button type="button" title={t("moveUp")} disabled={idx === 0} onClick={() => { onChange(moveItem(items, idx, idx - 1)); onActiveChange(idx - 1); }} className="px-1 disabled:opacity-30">↑</button>
                <button type="button" title={t("moveDown")} disabled={idx === items.length - 1} onClick={() => { onChange(moveItem(items, idx, idx + 1)); onActiveChange(idx + 1); }} className="px-1 disabled:opacity-30">↓</button>
                <button type="button" title={t("duplicate")} onClick={() => { onChange(duplicateItem(items, idx)); onActiveChange(idx + 1); }} className="px-1">⧉</button>
                {items.length > 1 ? <button type="button" title={t("remove")} onClick={() => removePiece(idx)} className="px-1 hover:text-[var(--color-danger)]">×</button> : null}
              </div>
            );
          })}
        </div>
      )}

      {active ? (
        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]" htmlFor="piece-category">{t("category")}</label>
            <select
              id="piece-category"
              value={active.category ?? ""}
              onChange={(e) => { update(activeIndex, setCategory(active, e.target.value as PieceCategory, keys)); setSelectedSash(0); }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)]"
            >
              {!active.category ? <option value="">—</option> : null}
              {PIECE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_DEFS[c].labels[locale] ?? CATEGORY_DEFS[c].labels.it}</option>
              ))}
            </select>
            {active.category ? (
              <button type="button" onClick={() => update(activeIndex, setCategory(active, active.category!, keys))} className="text-xs text-[var(--color-mint)] hover:underline">{t("resetLeaves")}</button>
            ) : null}
          </div>

          {issues.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-[var(--color-text)]">
              {issues.map((i, k) => (
                <li key={k}>⚠ {issueText(i)}</li>
              ))}
            </ul>
          ) : null}

          <PieceForm
            item={active}
            choices={choices}
            locale={locale}
            onPatch={patchActive}
            onWidth={(w) => patchActive({ width: w })}
            onHeight={(h) => update(activeIndex, setHeight(active, h))}
            onMaterial={changeMaterial}
          />

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="mx-auto w-full max-w-[420px]">
              <WindowDrawing
                input={{
                  widthMm: active.width,
                  heightMm: active.height,
                  category: active.category,
                  sashes: active.sashes,
                  finish: active.color,
                  frameType: active.frameType,
                  accessories: active.accessories,
                }}
                options={{ selectedSash, handleGuide: "selected", showMainBadge: true, showViolations: true, showLeafDimensions: true }}
                onSelectSash={setSelectedSash}
                onResizeSash={(d, ratio) => update(activeIndex, resizeDivider(active, d, ratio))}
                ariaLabel={t("drawingLabel", { width: active.width, height: active.height })}
                height={340}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex gap-2">
                <button type="button" disabled={active.sashes.length >= 6} onClick={() => update(activeIndex, addSash(active, keys))} className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">+ {t("addLeaf")}</button>
                <button type="button" disabled={active.sashes.length <= 1 || selectedSash === null} onClick={() => { if (selectedSash !== null) { update(activeIndex, removeSash(active, selectedSash)); setSelectedSash(0); } }} className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">− {t("removeLeaf")}</button>
              </div>
              {thermal && thermal.uw > 0 ? (
                <span className={`rounded-md px-2 py-0.5 font-mono font-bold ${thermal.uw <= 1.3 ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`} title={`Uf ${thermal.uf.toFixed(2)} · Ug ${thermal.ug.toFixed(2)} · Ψ ${thermal.psi}`}>
                  Uw {thermal.uw.toFixed(3)} W/m²K
                </span>
              ) : null}
            </div>
          </div>

          {sash && selectedSash !== null ? (
            <SashPanel
              sash={sash as unknown as EditorSash}
              index={selectedSash}
              siblingTypes={active.sashes.filter((_, i) => i !== selectedSash).map((s) => s.type as EditorSash["type"])}
              itemHeightMm={active.height}
              hardwareOptions={choices.hardware}
              hardwareColorOptions={choices.hardwareColors}
              onPatch={(patch) => update(activeIndex, patchSash(active, selectedSash, patch as Partial<ProjectItem["sashes"][number]>))}
              onClose={() => setSelectedSash(null)}
            />
          ) : null}
          <p className="text-[11px] text-[var(--color-text-secondary)]">{t("minHint", { w: SASH_MIN.tiltturn.w, h: SASH_MIN.tiltturn.h })} · {labelOf(payload.frameTypes?.find((f) => f.key === active.frameType), locale)}</p>
        </div>
      ) : null}
    </div>
  );
}
