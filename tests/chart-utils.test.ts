import { expect, test } from "vitest";
import { niceAxis, summarisePeak, visibleLabelIndexes } from "../src/lib/chart-utils";

test("niceAxis gives integer ticks with a round ceiling", () => {
  expect(niceAxis(0)).toEqual({ max: 1, ticks: [0, 1] });
  expect(niceAxis(3)).toEqual({ max: 3, ticks: [0, 1, 2, 3] });
  expect(niceAxis(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
  expect(niceAxis(23)).toEqual({ max: 30, ticks: [0, 10, 20, 30] });
  expect(niceAxis(101)).toEqual({ max: 150, ticks: [0, 50, 100, 150] });
});

test("visibleLabelIndexes never exceeds the budget and always keeps the latest point", () => {
  const idx = visibleLabelIndexes(30, 6);
  expect(idx.size).toBeLessThanOrEqual(6);
  expect(idx.has(29)).toBe(true);
  expect(visibleLabelIndexes(5, 10).size).toBe(5);
  expect(visibleLabelIndexes(0, 5).size).toBe(0);
});

test("summarisePeak aggregates cells per hour and weekday and finds the peaks", () => {
  const s = summarisePeak([
    { hour: 15, day: 2, value: 4 },
    { hour: 15, day: 3, value: 2 },
    { hour: 9, day: 2, value: 3 },
  ]);
  expect(s.total).toBe(9);
  expect(s.byHour[15]).toBe(6);
  expect(s.byDay[2]).toBe(7);
  expect(s.peakHour).toEqual({ hour: 15, value: 6 });
  expect(s.peakDay).toEqual({ day: 2, value: 7 });
  expect(summarisePeak([]).peakHour).toBeNull();
});
