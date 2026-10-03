// Pure logic of the finish swatch picker, shared by the platform editor and the widget: which tabs and groups a
// catalogue offers, the search, and the CSS of a swatch square.

import type { FinishGroup, FinishRange } from "./finish-library";

export interface PickerFinish {
  key: string;
  label: string;
  /** Swatch colour of the catalogue row. */
  hex?: string;
  /** Texture image (decors and stone): shown in the swatch square instead of the flat colour. */
  texture?: string;
  range?: FinishRange;
  group?: string;
  warrantyYears?: number;
}

/** "base" = the finishes that are not part of the library (white, anthracite, custom ones of the tenant). */
export type PickerTab = "base" | FinishRange;

export const TAB_ORDER: readonly PickerTab[] = ["base", "skin", "nuance", "rock"];

export const tabOf = (f: PickerFinish): PickerTab => f.range ?? "base";

/** Tabs that have at least one finish, in display order. */
export function availableTabs(finishes: PickerFinish[]): PickerTab[] {
  return TAB_ORDER.filter((t) => finishes.some((f) => tabOf(f) === t));
}

/** Groups present in a tab, in the order they first appear. */
export function groupsIn(finishes: PickerFinish[], tab: PickerTab): FinishGroup[] {
  const out: FinishGroup[] = [];
  for (const f of finishes) {
    if (tabOf(f) !== tab || !f.group) continue;
    if (!out.includes(f.group as FinishGroup)) out.push(f.group as FinishGroup);
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Finishes of a tab, narrowed by group ("" = all) and by a search text (matches the label and, for RAL, the code). */
export function filterFinishes(finishes: PickerFinish[], tab: PickerTab, group: string, query: string): PickerFinish[] {
  const q = norm(query.trim());
  return finishes.filter((f) => {
    if (tabOf(f) !== tab) return false;
    if (group && f.group !== group) return false;
    return !q || norm(f.label).includes(q) || norm(f.key).includes(q);
  });
}

/** Inline style of a swatch square: the texture image when there is one, else the flat colour. */
export function swatchStyle(f: Pick<PickerFinish, "hex" | "texture">): { background: string } {
  if (f.texture) return { background: `${f.hex ?? "#CCCCCC"} url(${f.texture}) center / cover no-repeat` };
  return { background: f.hex ?? "#CCCCCC" };
}

/** The tab a finish key lives in (to open the picker on the selected finish). */
export function tabForKey(finishes: PickerFinish[], key: string): PickerTab {
  const f = finishes.find((x) => x.key === key);
  return f ? tabOf(f) : "base";
}
