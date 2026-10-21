import type { ExportDict } from "./dictionary";

type Row = { key: string; labels?: Record<string, string> };

/** "Anthracite" for one colour, "Anthracite (outside) / White (inside)" for a bicolour piece. */
export function finishText(
  rows: Row[] | undefined,
  item: { color: string; colorInside?: string },
  locale: string,
  dict: Pick<ExportDict, "colorOutside" | "colorInside">,
  fallback: (key: string) => string = (k) => k,
): string {
  const label = (key: string) => {
    const row = rows?.find((r) => r.key === key);
    return row ? row.labels?.[locale] || row.labels?.it || row.labels?.en || row.key : fallback(key);
  };
  if (!item.colorInside || item.colorInside === item.color) return label(item.color);
  return `${label(item.color)} (${dict.colorOutside}) / ${label(item.colorInside)} (${dict.colorInside})`;
}
