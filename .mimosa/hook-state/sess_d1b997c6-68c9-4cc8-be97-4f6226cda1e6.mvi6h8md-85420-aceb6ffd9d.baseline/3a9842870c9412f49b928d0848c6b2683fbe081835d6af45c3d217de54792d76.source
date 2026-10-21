"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GROUP_LABEL, RANGE_LABEL, type FinishGroup } from "@/shared/finish-library";
import { availableTabs, filterFinishes, groupsIn, swatchStyle, tabForKey, type PickerFinish, type PickerTab } from "@/shared/finish-picker";

interface Props {
  idBase: string;
  value: string;
  finishes: PickerFinish[];
  onChange: (key: string) => void;
  labelClass: string;
  /** Replaces the default "Colour / finish" caption (e.g. "Outside finish" for a bicolour piece). */
  label?: string;
}

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
type Loc = (typeof LOCALES)[number];

/**
 * Finish picker with swatch squares: tabs for the base finishes, foil decors, painted RAL colours and stone
 * effects, group chips, a search and a grid of squares showing the colour or the texture before choosing it.
 */
export function FinishPicker({ idBase, value, finishes, onChange, labelClass, label }: Props) {
  const t = useTranslations("finishPicker");
  const rawLocale = useLocale();
  const locale: Loc = (LOCALES as readonly string[]).includes(rawLocale) ? (rawLocale as Loc) : "it";
  const [open, setOpen] = useState(false);
  const tabs = useMemo(() => availableTabs(finishes), [finishes]);
  const [tab, setTab] = useState<PickerTab>(() => tabForKey(finishes, value));
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const current = finishes.find((f) => f.key === value);
  const activeTab = tabs.includes(tab) ? tab : (tabs[0] ?? "base");
  const groups = groupsIn(finishes, activeTab);
  const shown = filterFinishes(finishes, activeTab, group, query);
  const tabLabel = (x: PickerTab) => (x === "base" ? t("base") : RANGE_LABEL[x][locale]);

  const move = (from: number, delta: number) => {
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-swatch]");
    const next = buttons?.[Math.min((buttons?.length ?? 1) - 1, Math.max(0, from + delta))];
    next?.focus();
  };

  return (
    <div>
      <span className={labelClass} id={`${idBase}-finish-label`}>{label ?? t("finish")}</span>
      <button
        type="button"
        id={`${idBase}-finish`}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        aria-labelledby={`${idBase}-finish-label ${idBase}-finish`}
        onClick={() => {
          setTab(tabForKey(finishes, value));
          setOpen((o) => !o);
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left text-sm text-[var(--color-text)]"
      >
        <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-md border border-[var(--color-border)]" style={swatchStyle(current ?? {})} />
        <span className="min-w-0 flex-1 truncate">{current?.label ?? value}</span>
        <span aria-hidden="true" className="text-xs text-[var(--color-text-secondary)]">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div id={`${uid}-panel`} className="mt-2 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-2">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={t("finish")} className="flex flex-wrap gap-1">
              {tabs.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === x}
                  onClick={() => {
                    setTab(x);
                    setGroup("");
                  }}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${activeTab === x ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"}`}
                >
                  {tabLabel(x)}
                </button>
              ))}
            </div>
          ) : null}

          {groups.length > 1 ? (
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("groups")}>
              {["", ...groups].map((g) => (
                <button
                  key={g || "all"}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${group === g ? "border-[var(--color-mint)] bg-[var(--color-mint)]/15 text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}
                >
                  {g === "" ? t("all") : GROUP_LABEL[g as FinishGroup][locale]}
                </button>
              ))}
            </div>
          ) : null}

          {(tabs.length > 1 && activeTab !== "base") || finishes.length > 24 ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-text)]"
            />
          ) : null}

          <div ref={gridRef} role="radiogroup" aria-label={tabLabel(activeTab)} className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5 overflow-y-auto p-0.5">
            {shown.map((f, i) => {
              const selected = f.key === value;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  data-swatch
                  aria-checked={selected}
                  aria-label={f.label}
                  title={f.label}
                  tabIndex={selected || (!shown.some((x) => x.key === value) && i === 0) ? 0 : -1}
                  onClick={() => onChange(f.key)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(i, 1);
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      move(i, -1);
                    }
                  }}
                  className={`aspect-square w-full rounded-md border ${selected ? "border-[var(--color-mint)] ring-2 ring-[var(--color-mint)]" : "border-[var(--color-border)]"}`}
                  style={swatchStyle(f)}
                />
              );
            })}
            {shown.length === 0 ? <p className="col-span-full py-2 text-center text-xs text-[var(--color-text-secondary)]">{t("none")}</p> : null}
          </div>

          <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]" aria-live="polite">
            {current ? <><strong className="text-[var(--color-text)]">{current.label}</strong>{current.warrantyYears ? ` · ${t("warranty", { years: current.warrantyYears })}` : ""}</> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
