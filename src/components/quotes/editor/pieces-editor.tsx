"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CATEGORY_DEFS, PIECE_CATEGORIES, type PieceCategory } from "@/shared/configurator-model";
import { calculatePrice, computeItemThermal, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { frameRules, leafRule, SASH_MIN, type EditorSash } from "@/shared/sash-rules";
import {
  addSash,
  applyFrameToAll,
  duplicateItem,
  MAX_PIECES,
  moveItem,
  patchSash,
  pieceIssues,
  removeSash,
  resizeDivider,
  setCategory,
  setHardwareColor,
  setHeight,
  type PieceIssue,
} from "@/shared/piece-ops";
import { defaultItem } from "@/shared/item-defaults";
import { DIM_ABS_MAX } from "@/shared/widget-types";
import { buildHardwareScene, buildLegendScene, buildPlanScene, buildSectionScene, DRAWING_DIMENSION, DRAWING_FLIP, DRAWING_HANDLE, DRAWING_OPTIONS, DRAWING_TABS, DRAWING_TITLES, DRAWING_VIEW, drawingLocale, SceneSvg, WindowDrawing, type DrawingTab, type DrawingView } from "@/lib/drawing";
import { SashPanel } from "@/components/quotes/sash-panel";
import { catalogChoices, labelOf } from "./catalog-labels";
import { PieceForm } from "./piece-form";
import { HandleColorPopover } from "./handle-color-popover";
import { DrawingTabs } from "./drawing-tabs";

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
  const ts = useTranslations("sash");
  const [selectedSash, setSelectedSash] = useState<number | null>(0);
  const [view, setView] = useState<DrawingView>("inside");
  const [tab, setTab] = useState<DrawingTab>("elevation");
  const [leafDims, setLeafDims] = useState(true);
  const [glassDims, setGlassDims] = useState(false);
  const [colorPicker, setColorPicker] = useState<{ index: number; x: number; y: number } | null>(null);
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
    if (items.length >= MAX_PIECES) return;
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

  // With no live published catalog (payload.materials empty — e.g. the
  // configurator has nothing published yet, or its published snapshot was
  // removed), every key trivially looks "unknown". That's not a real per-item
  // issue; the parent page already blocks submission and shows a clear
  // "no catalog" state, so skip the misleading per-field warnings here.
  const issues = active && payload.materials.length > 0 ? pieceIssues(active, payload) : [];
  // Overall dimensions turn red on the drawing when the size itself is out of bounds.
  const invalidAxes = {
    width: issues.some((i) => (i.code === "size" || i.code === "singleLeafMax") && i.axis === "width"),
    height: issues.some((i) => (i.code === "size" || i.code === "singleLeafMax") && i.axis === "height"),
  };
  const thermal = active ? computeItemThermal(payload, active) : null;
  const sash = active && selectedSash !== null ? active.sashes[selectedSash] : undefined;

  const issueText = (i: PieceIssue) => {
    switch (i.code) {
      case "size": return t("issue.size", { axis: t(i.axis), min: i.min, max: i.max });
      case "singleLeafMax": return t("issue.singleLeafMax", { axis: t(i.axis), max: i.max });
      case "leafWidth": return t("issue.leafWidth", { leaf: i.leaf + 1, got: i.got, min: i.min });
      case "leafHeight": return t("issue.leafHeight", { leaf: i.leaf + 1, got: i.got, min: i.min });
      case "mix": return i.mix ? ts(`mix_${i.mix}`) : i.reason;
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
            <button key={c} type="button" disabled={items.length >= MAX_PIECES} onClick={() => addPiece(c)} className="disabled:opacity-40 min-h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]">
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
        <div className="flex flex-wrap gap-2">
          {items.map((it, idx) => {
            const def = CATEGORY_DEFS[it.category ?? (it.productType === "balconyDoor" ? "porta1" : "finestra1")];
            const price = calculatePrice(payload, [it]).priceCents;
            return (
              <div key={idx} className={`flex max-w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${activeIndex === idx ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"}`}>
                <button type="button" onClick={() => { onActiveChange(idx); setSelectedSash(0); }} className="min-w-0 text-left font-bold">
                  {t("position", { n: idx + 1 })} · {def.labels[locale] ?? def.labels.it} · {it.width}×{it.height}
                  <span className="ml-1 font-mono font-normal">{eur(price, locale)}</span>
                </button>
                <button type="button" title={t("moveUp")} disabled={idx === 0} onClick={() => { onChange(moveItem(items, idx, idx - 1)); onActiveChange(idx - 1); }} className="px-1 disabled:opacity-30">↑</button>
                <button type="button" title={t("moveDown")} disabled={idx === items.length - 1} onClick={() => { onChange(moveItem(items, idx, idx + 1)); onActiveChange(idx + 1); }} className="px-1 disabled:opacity-30">↓</button>
                <button type="button" title={t("duplicate")} disabled={items.length >= MAX_PIECES} onClick={() => { onChange(duplicateItem(items, idx)); onActiveChange(idx + 1); }} className="px-1">⧉</button>
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
              <button type="button" onClick={() => update(activeIndex, setCategory(active, active.category!, keys))} className="text-xs text-[var(--color-mint-text)] hover:underline">{t("resetLeaves")}</button>
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
            <DrawingTabs tabs={["elevation", "plan", "section", "hardware"]} value={tab} onChange={setTab} locale={locale} />
            <div role="tabpanel" id="drawing-panel-elevation" aria-labelledby="drawing-tab-elevation" hidden={tab !== "elevation"}>
            <div className="mb-2 flex justify-center gap-1" role="group" aria-label={DRAWING_VIEW[drawingLocale(locale)].inside + " / " + DRAWING_VIEW[drawingLocale(locale)].outside}>
              {(["inside", "outside"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    view === v
                      ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-mint)]"
                  }`}
                >
                  {DRAWING_VIEW[drawingLocale(locale)][v]}
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={leafDims} onChange={(e) => setLeafDims(e.target.checked)} className="h-3.5 w-3.5" />
                {DRAWING_OPTIONS[drawingLocale(locale)].leafDims}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={glassDims} onChange={(e) => setGlassDims(e.target.checked)} className="h-3.5 w-3.5" />
                {DRAWING_OPTIONS[drawingLocale(locale)].glassDims}
              </label>
            </div>
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
                options={{ selectedSash, handleGuide: "selected", showMainBadge: true, showViolations: true, showLeafDimensions: leafDims, showGlassDimensions: glassDims, invalidAxes, view }}
                onSelectSash={setSelectedSash}
                onFlipSash={(i) => update(activeIndex, patchSash(active, i, { direction: active.sashes[i]?.direction === "left" ? "right" : "left" }))}
                flipLabel={DRAWING_FLIP[drawingLocale(locale)]}
                onHandleHeight={view === "inside" ? (i, mm) => update(activeIndex, patchSash(active, i, { handleHeightMm: mm })) : undefined}
                onHandleClick={view === "inside" ? (i, a) => { setSelectedSash(i); setColorPicker({ index: i, x: a.clientX, y: a.clientY }); } : undefined}
                handleText={DRAWING_HANDLE[drawingLocale(locale)]}
                onEditDimension={(axis, mm) => (axis === "width" ? patchActive({ width: mm }) : update(activeIndex, setHeight(active, mm)))}
                dimensionRange={{ min: 200, max: DIM_ABS_MAX }}
                dimensionText={DRAWING_DIMENSION[drawingLocale(locale)]}
                onResizeSash={view === "inside" ? (d, ratio) => update(activeIndex, resizeDivider(active, d, ratio)) : undefined}
                ariaLabel={t("drawingLabel", { width: active.width, height: active.height })}
                height={340}
              />
            </div>
            {glassDims ? <p className="mt-2 text-center text-[11px] text-[var(--color-text-secondary)]">{DRAWING_OPTIONS[drawingLocale(locale)].glassNote}</p> : null}
            {colorPicker && active.sashes[colorPicker.index] ? (
              <HandleColorPopover
                anchor={colorPicker}
                locale={locale}
                options={choices.hardwareColors}
                current={active.sashes[colorPicker.index].hardwareColor}
                onClose={() => setColorPicker(null)}
                onPick={(key, all) => {
                  update(activeIndex, setHardwareColor(active, colorPicker.index, key, all));
                  setColorPicker(null);
                }}
              />
            ) : null}
            {view === "outside" ? <p className="mt-2 text-center text-[11px] text-[var(--color-text-secondary)]">{DRAWING_VIEW[drawingLocale(locale)].note}</p> : null}
            <details className="mt-2 text-xs text-[var(--color-text-secondary)]">
              <summary className="cursor-pointer select-none font-medium text-[var(--color-text)]">{DRAWING_TITLES[drawingLocale(locale)].legend}</summary>
              <div className="mx-auto mt-2 w-full max-w-[300px] rounded-lg bg-white p-2">
                <SceneSvg scene={buildLegendScene(locale)} ariaLabel={DRAWING_TITLES[drawingLocale(locale)].legend} />
              </div>
            </details>
            </div>
            {tab === "plan" ? (
              <div role="tabpanel" id="drawing-panel-plan" aria-labelledby="drawing-tab-plan" className="mx-auto w-full max-w-[460px] rounded-lg bg-white p-2">
                <SceneSvg
                  scene={buildPlanScene({ widthMm: active.width, heightMm: active.height, category: active.category, sashes: active.sashes, finish: active.color, frameType: active.frameType }, locale)}
                  ariaLabel={DRAWING_TABS[drawingLocale(locale)].plan}
                />
              </div>
            ) : null}
            {tab === "hardware" ? (
              <div role="tabpanel" id="drawing-panel-hardware" aria-labelledby="drawing-tab-hardware" className="mx-auto w-full max-w-[420px] rounded-lg bg-white p-2">
                <SceneSvg
                  scene={buildHardwareScene({ widthMm: active.width, heightMm: active.height, category: active.category, sashes: active.sashes, finish: active.color, frameType: active.frameType }, locale)}
                  ariaLabel={DRAWING_TABS[drawingLocale(locale)].hardware}
                />
              </div>
            ) : null}
            {tab === "section" ? (
              <div role="tabpanel" id="drawing-panel-section" aria-labelledby="drawing-tab-section" className="mx-auto w-full max-w-[520px] rounded-lg bg-white p-2">
                <SceneSvg
                  scene={buildSectionScene({ material: active.material, quality: active.quality[active.material], glazing: active.glazing, frameType: active.frameType, thermal: thermal && thermal.uw > 0 ? { uf: thermal.uf, ug: thermal.ug, psi: thermal.psi } : undefined }, locale)}
                  ariaLabel={DRAWING_TABS[drawingLocale(locale)].section}
                />
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex gap-2">
                <button type="button" disabled={active.sashes.length >= 6} onClick={() => update(activeIndex, addSash(active, keys))} className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">+ {t("addLeaf")}</button>
                <button type="button" disabled={active.sashes.length <= 1 || selectedSash === null} onClick={() => { if (selectedSash !== null) { update(activeIndex, removeSash(active, selectedSash)); setSelectedSash(0); } }} className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">− {t("removeLeaf")}</button>
              </div>
              {thermal && thermal.uw > 0 ? (
                <span className={`rounded-md px-2 py-0.5 font-mono font-bold ${thermal.uw <= 1.3 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`} title={`Uf ${thermal.uf.toFixed(2)} · Ug ${thermal.ug.toFixed(2)} · Ψ ${thermal.psi}`}>
                  Uw {thermal.uw.toFixed(3)} W/m²K
                </span>
              ) : null}
            </div>
          </div>

          {frameRules(active.sashes as unknown as EditorSash[]).map((code) => (
            <p key={code} className="rounded-md bg-[var(--color-bg-alt)] px-2 py-1.5 text-[11px] leading-snug text-[var(--color-text-secondary)]" role="note">{ts(`frame_${code}`)}</p>
          ))}
          {sash && selectedSash !== null ? (
            <SashPanel
              sash={sash as unknown as EditorSash}
              index={selectedSash}
              siblingTypes={active.sashes.filter((_, i) => i !== selectedSash).map((s) => s.type as EditorSash["type"])}
              rule={leafRule(active.sashes as unknown as EditorSash[], selectedSash)}
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
