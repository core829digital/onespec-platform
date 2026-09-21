// @vitest-environment node
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { PeakHoursChart, TrendChart } from "../src/components/analytics/charts";

const fmt = (n: number) => `${n} req`;

test("TrendChart renders axis, labels and the empty state", () => {
  const data = Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}/9`, value: i % 5 }));
  const html = renderToString(
    h(TrendChart, { data, title: "Trend", formatValue: fmt, stats: [{ label: "Totale", value: "60" }], emptyLabel: "vuoto" }),
  );
  expect(html).toContain("Trend");
  expect(html).toContain("30/9"); // latest label is always shown
  expect(html).not.toContain("vuoto");

  const empty = renderToString(h(TrendChart, { data: data.map((d) => ({ ...d, value: 0 })), formatValue: fmt, emptyLabel: "vuoto" }));
  expect(empty).toContain("vuoto");
  expect(renderToString(h(TrendChart, { data: [], formatValue: fmt, emptyLabel: "vuoto" }))).toContain("vuoto");
});

test("PeakHoursChart shows the peak hour and day, localised weekday names", () => {
  const html = renderToString(
    h(PeakHoursChart, {
      data: [
        { hour: 15, day: 2, value: 5 },
        { hour: 9, day: 4, value: 2 },
      ],
      title: "Ore",
      locale: "it",
      formatValue: fmt,
      labels: { byHour: "Per ora", byDay: "Per giorno", peakHour: "Ora di punta", peakDay: "Giorno di punta", empty: "vuoto" },
    }),
  );
  expect(html).toContain("15:00–16:00");
  expect(html).toContain("martedì");
  expect(html).toContain("Per giorno");

  const empty = renderToString(
    h(PeakHoursChart, { data: [], locale: "en", formatValue: fmt, labels: { byHour: "a", byDay: "b", peakHour: "c", peakDay: "d", empty: "nothing" } }),
  );
  expect(empty).toContain("nothing");
});
