/** Pure helpers for the analytics charts (kept out of the components so they can be tested). */

const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** Integer y-axis: a "nice" ceiling and at most ~4 gridline steps above zero. */
export function niceAxis(max: number): { max: number; ticks: number[] } {
  const safe = Math.max(1, Math.ceil(max));
  const step = STEPS.find((s) => safe / s <= 4) ?? Math.ceil(safe / 4);
  const top = Math.ceil(safe / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { max: top, ticks };
}

/** Indexes of the x labels to print so they never overlap, anchored on the latest point. */
export function visibleLabelIndexes(count: number, maxLabels: number): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const step = Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
  for (let i = count - 1; i >= 0; i -= step) out.add(i);
  return out;
}

export interface PeakCell {
  hour: number;
  day: number;
  value: number;
}

export interface PeakSummary {
  byHour: number[];
  byDay: number[];
  total: number;
  peakHour: { hour: number; value: number } | null;
  peakDay: { day: number; value: number } | null;
}

/** Collapse the hour×weekday cells into the two views the chart shows. */
export function summarisePeak(cells: PeakCell[]): PeakSummary {
  const byHour = Array.from({ length: 24 }, () => 0);
  const byDay = Array.from({ length: 7 }, () => 0);
  for (const c of cells) {
    if (c.hour >= 0 && c.hour < 24) byHour[c.hour] += c.value;
    if (c.day >= 0 && c.day < 7) byDay[c.day] += c.value;
  }
  const total = byHour.reduce((a, b) => a + b, 0);
  const best = (arr: number[]) => {
    let idx = -1;
    let val = 0;
    arr.forEach((v, i) => {
      if (v > val) {
        val = v;
        idx = i;
      }
    });
    return idx < 0 ? null : { index: idx, value: val };
  };
  const h = best(byHour);
  const d = best(byDay);
  return {
    byHour,
    byDay,
    total,
    peakHour: h ? { hour: h.index, value: h.value } : null,
    peakDay: d ? { day: d.index, value: d.value } : null,
  };
}
