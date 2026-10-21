"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { GROUP_LABEL, RANGE_LABEL, type FinishGroup } from "@/shared/finish-library";
import { availableTabs, filterFinishes, groupsIn, swatchStyle, tabForKey, type PickerFinish, type PickerTab } from "@/shared/finish-picker";
import type { FinishMeta } from "./widget-catalog";

export interface FinishPickerText {
  finish: string;
  base: string;
  all: string;
  search: string;
  none: string;
  warranty: string;
}

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
type Loc = (typeof LOCALES)[number];

const chip = (on: boolean): CSSProperties => ({
  padding: "4px 9px",
  borderRadius: 999,
  border: `1.5px solid ${on ? "var(--color-mint)" : "var(--color-border)"}`,
  background: on ? "color-mix(in srgb, var(--color-mint) 14%, transparent)" : "transparent",
  color: "var(--color-text)",
  fontSize: 11.5,
  cursor: "pointer",
});

/**
 * Finish picker for the widget: a button with the chosen swatch that opens tabs (base / decors / RAL / stone),
 * group chips, a search and a grid of swatch squares showing the colour or texture before choosing it.
 */
export function WidgetFinishPicker({
  id,
  lang,
  value,
  pairs,
  meta,
  text,
  onChange,
  styles,
}: {
  id: string;
  lang: string;
  value: string;
  pairs: [string, string][];
  meta: Record<string, FinishMeta>;
  text: FinishPickerText;
  onChange: (key: string) => void;
  styles: { select: CSSProperties; hint: CSSProperties };
}) {
  const locale: Loc = (LOCALES as readonly string[]).includes(lang) ? (lang as Loc) : "it";
  const finishes: PickerFinish[] = useMemo(
    () =>
      pairs.map(([key, label]) => ({
        key,
        label,
        hex: meta[key]?.hex,
        texture: meta[key]?.texture?.href,
        range: meta[key]?.range,
        group: meta[key]?.group,
      })),
    [pairs, meta],
  );
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
  const tabLabel = (x: PickerTab) => (x === "base" ? text.base : RANGE_LABEL[x][locale]);

  // A plain list (no library rows in the catalogue) keeps the simple select.
  if (tabs.length <= 1 && finishes.length <= 24) {
    return (
      <select id={id} style={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {pairs.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  const move = (from: number, delta: number) => {
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-swatch]");
    buttons?.[Math.min((buttons?.length ?? 1) - 1, Math.max(0, from + delta))]?.focus();
  };

  return (
    <div>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => {
          setTab(tabForKey(finishes, value));
          setOpen((o) => !o);
        }}
        style={{ ...styles.select, display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer" }}
      >
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 6, border: "1.5px solid var(--color-border)", flexShrink: 0, ...swatchStyle(current ?? {}) }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? value}</span>
        <span aria-hidden="true" style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div id={`${uid}-panel`} style={{ marginTop: 8, padding: 10, border: "1.5px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg-alt)", display: "grid", gap: 8 }}>
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={text.finish} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                  style={{ ...chip(activeTab === x), borderRadius: 6, fontWeight: 600 }}
                >
                  {tabLabel(x)}
                </button>
              ))}
            </div>
          ) : null}

          {groups.length > 1 ? (
            <div role="group" aria-label={tabLabel(activeTab)} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["", ...groups].map((g) => (
                <button key={g || "all"} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} style={chip(group === g)}>
                  {g === "" ? text.all : GROUP_LABEL[g as FinishGroup][locale]}
                </button>
              ))}
            </div>
          ) : null}

          {activeTab !== "base" || finishes.length > 24 ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={text.search}
              aria-label={text.search}
              style={{ ...styles.select, padding: "7px 9px", fontSize: 12.5 }}
            />
          ) : null}

          <div ref={gridRef} role="radiogroup" aria-label={tabLabel(activeTab)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 6, maxHeight: 224, overflowY: "auto", padding: 2 }}>
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
                  style={{
                    aspectRatio: "1 / 1",
                    width: "100%",
                    borderRadius: 6,
                    border: selected ? "2px solid var(--color-mint)" : "1.5px solid var(--color-border)",
                    boxShadow: selected ? "0 0 0 2px var(--color-mint)" : undefined,
                    cursor: "pointer",
                    padding: 0,
                    ...swatchStyle(f),
                  }}
                />
              );
            })}
            {shown.length === 0 ? <p style={{ ...styles.hint, gridColumn: "1 / -1", textAlign: "center" }}>{text.none}</p> : null}
          </div>

          <div style={styles.hint} aria-live="polite">
            {current ? (
              <>
                <strong style={{ color: "var(--color-text)" }}>{current.label}</strong>
                {meta[current.key]?.warrantyYears ? ` · ${text.warranty.replace("{years}", String(meta[current.key]!.warrantyYears))}` : ""}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
