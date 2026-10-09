"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { assemblyGroups, assemblyIssues, MAX_ASSEMBLY_COLS, MAX_ASSEMBLY_GROUPS, MAX_ASSEMBLY_ROWS, placementOf, type AssemblyIssue } from "@/shared/composition";
import { FIELD_OPENING_TYPES, leafFieldOpenings, MAX_TRANSOMS, suggestTransom, transomZonesMm, type FieldOpeningType } from "@/shared/transoms";
import { addLeafTransom, applyLeafBarsToAll, barsOfLeaf, removeLeafTransom, setComposition, setLeafFieldOpening, setLeafTransomHeight } from "@/shared/piece-ops";
import type { ProjectItem } from "@/shared/pricing";
import { buildAssemblyScene, finishFillFor, insideFinishFor, SceneSvg } from "@/lib/drawing";
import type { CatalogPayload } from "@/shared/pricing";

const FIELD = "min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]";

/** Horizontal bars and joined pieces of the active piece: what makes a window more than one rectangle of leaves. */
export function StructurePanel({
  payload,
  items,
  activeIndex,
  onChange,
}: {
  payload: CatalogPayload;
  items: ProjectItem[];
  activeIndex: number;
  onChange: (items: ProjectItem[]) => void;
}) {
  const t = useTranslations("structure");
  const active = items[activeIndex];
  const update = (next: ProjectItem) => onChange(items.map((it, i) => (i === activeIndex ? next : it)));

  // The leaf the bars are being edited on (a bar belongs to ONE leaf; the part above and below it open independently).
  const [leafPick, setLeafPick] = useState(0);
  const leaf = Math.min(leafPick, Math.max(0, (active?.sashes.length ?? 1) - 1));
  const transoms = useMemo(() => (active ? barsOfLeaf(active, leaf) : []), [active, leaf]);
  const fieldOpenings = useMemo(() => leafFieldOpenings(transoms.length, active?.sashes[leaf]?.fields), [transoms.length, active?.sashes, leaf]);
  const issues = useMemo(() => assemblyIssues(items), [items]);
  const place = active ? placementOf(active) : undefined;
  const groups = useMemo(() => assemblyGroups(items), [items]);
  const myGroup = place ? groups.find((g) => g.group === place.group) : undefined;
  const groupIssues = place ? issues.filter((i) => i.group === place.group) : [];

  const preview = useMemo(() => {
    if (!myGroup || groupIssues.length > 0) return null;
    return buildAssemblyScene(
      items.map((it) => ({
        width: it.width,
        height: it.height,
        composition: it.composition,
        input: {
          widthMm: it.width,
          heightMm: it.height,
          category: it.category,
          sashes: it.sashes,
          finish: it.color,
          frameType: it.frameType,
          transomsMm: it.transoms,
          glazing: it.glazing,
          finishFill: finishFillFor(payload.finish, it.color),
          ...insideFinishFor(payload.finish, it),
        },
      })),
      myGroup.members,
    );
  }, [myGroup, groupIssues.length, items, payload.finish]);

  if (!active) return null;
  const zones = transomZonesMm(active.height, transoms);
  const canAdd = suggestTransom(active.height, transoms) !== null;
  const typeLabel = (type: FieldOpeningType) => t(`field${type === "fix" ? "Fix" : type === "tilt" ? "Tilt" : type === "classic" ? "Classic" : "Tiltturn"}`);

  const issueText = (i: AssemblyIssue) => {
    switch (i.code) {
      case "cellTaken": return t("issue.cellTaken", { col: i.col + 1, row: i.row + 1 });
      case "notConnected": return t("issue.notConnected");
      case "rowHeight": return t("issue.rowHeight", { row: i.row + 1 });
      case "colWidth": return t("issue.colWidth", { col: i.col + 1 });
      case "tooMany": return t("issue.tooMany");
      case "outOfGrid": return t("issue.outOfGrid");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3" data-testid="structure-panel">
      {/* horizontal bars, per leaf */}
      <section aria-labelledby="transoms-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="transoms-title" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("transomsTitle")}</h4>
          <button type="button" data-testid="add-transom" disabled={!canAdd} onClick={() => update(addLeafTransom(active, leaf))} className="min-h-11 sm:min-h-9 rounded-lg border border-[var(--color-mint)] px-3 py-1 text-xs font-semibold text-[var(--color-mint-text)] hover:bg-[var(--color-mint)]/10 disabled:cursor-not-allowed disabled:opacity-40">
            + {t("addTransom")}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{t("transomsHint", { max: MAX_TRANSOMS })}</p>
        {active.sashes.length > 1 ? (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-secondary)]">{t("leafPick")}</span>
            <select data-testid="transom-leaf" className={`${FIELD} w-32`} value={leaf} onChange={(e) => setLeafPick(Number(e.target.value))}>
              {active.sashes.map((_, i) => <option key={i} value={i}>{t("leafN", { n: i + 1 })}</option>)}
            </select>
          </label>
        ) : null}
        {transoms.length === 0 ? <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{t("noBarOnLeaf")}</p> : (
          <ul className="mt-2 space-y-3">
            {transoms.map((mm, i) => (
              <li key={i} className="space-y-2 rounded-lg border border-[var(--color-border)] p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2">
                    <span className="text-[var(--color-text-secondary)]">{t("transomN", { n: i + 1 })}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={`${FIELD} w-28`}
                      defaultValue={mm}
                      key={`${leaf}-${i}-${mm}`}
                      aria-label={t("transomHeight", { n: i + 1 })}
                      onBlur={(e) => {
                        const v = Number(e.currentTarget.value);
                        if (Number.isFinite(v)) update(setLeafTransomHeight(active, leaf, i, v));
                        e.currentTarget.value = String(transoms[i]);
                      }}
                    />
                    <span className="text-[var(--color-text-secondary)]">{t("mmFromSill")}</span>
                  </label>
                  <button type="button" onClick={() => update(removeLeafTransom(active, leaf, i))} className="min-h-9 rounded-lg px-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">{t("removeTransom")}</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--color-text-secondary)]">{t("fieldAbove", { n: i + 1 })}</span>
                  <select
                    data-testid={`field-type-${i}`}
                    className={`${FIELD} w-40`}
                    value={fieldOpenings[i].type}
                    onChange={(e) => update(setLeafFieldOpening(active, leaf, i, { type: e.target.value as FieldOpeningType, direction: fieldOpenings[i].direction }))}
                  >
                    {FIELD_OPENING_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
                  </select>
                  {fieldOpenings[i].type === "classic" || fieldOpenings[i].type === "tiltturn" ? (
                    <label className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                      {t("hinge")}
                      <select
                        data-testid={`field-hinge-${i}`}
                        className={`${FIELD} w-32`}
                        value={fieldOpenings[i].direction}
                        onChange={(e) => update(setLeafFieldOpening(active, leaf, i, { type: fieldOpenings[i].type, direction: e.target.value as "left" | "right" }))}
                      >
                        <option value="left">{t("hingeLeft")}</option>
                        <option value="right">{t("hingeRight")}</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {transoms.length > 0 ? <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{t("fields", { heights: [...zones].reverse().join(" · ") })}</p> : null}
        {transoms.length > 0 && active.sashes.length > 1 ? (
          <button type="button" data-testid="transom-apply-all" onClick={() => update(applyLeafBarsToAll(active, leaf))} className="mt-2 min-h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]">
            {t("applyAll")}
          </button>
        ) : null}
      </section>

      {/* joined pieces */}
      <section aria-labelledby="join-title">
        <h4 id="join-title" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("joinTitle")}</h4>
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{t("joinHint")}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="text-xs text-[var(--color-text-secondary)]">
            {t("group")}
            <select
              data-testid="join-group"
              className={`${FIELD} mt-1 w-full`}
              value={place?.group ?? 0}
              onChange={(e) => {
                const g = Number(e.target.value);
                update(setComposition(active, g === 0 ? undefined : { group: g, col: place?.col ?? 0, row: place?.row ?? 0 }));
              }}
            >
              <option value={0}>{t("notJoined")}</option>
              {Array.from({ length: MAX_ASSEMBLY_GROUPS }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>{t("groupN", { n: g })}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--color-text-secondary)]">
            {t("column")}
            <select data-testid="join-col" disabled={!place} className={`${FIELD} mt-1 w-full`} value={place?.col ?? 0} onChange={(e) => place && update(setComposition(active, { ...place, col: Number(e.target.value) }))}>
              {Array.from({ length: MAX_ASSEMBLY_COLS }, (_, i) => i).map((c) => <option key={c} value={c}>{c + 1}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--color-text-secondary)]">
            {t("row")}
            <select data-testid="join-row" disabled={!place} className={`${FIELD} mt-1 w-full`} value={place?.row ?? 0} onChange={(e) => place && update(setComposition(active, { ...place, row: Number(e.target.value) }))}>
              {Array.from({ length: MAX_ASSEMBLY_ROWS }, (_, i) => i).map((r) => <option key={r} value={r}>{r + 1}</option>)}
            </select>
          </label>
        </div>
        {place && !myGroup && groupIssues.length === 0 ? <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{t("alone")}</p> : null}
        {groupIssues.length > 0 ? (
          <ul role="alert" className="mt-2 space-y-1 text-xs text-[var(--color-danger)]">
            {groupIssues.map((i, k) => <li key={k}>{issueText(i)}</li>)}
          </ul>
        ) : null}
        {preview ? (
          <div className="mx-auto mt-3 w-full max-w-[420px] rounded-lg bg-white p-2" data-testid="assembly-preview">
            <SceneSvg scene={preview} ariaLabel={t("previewLabel", { n: place?.group ?? 0 })} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
