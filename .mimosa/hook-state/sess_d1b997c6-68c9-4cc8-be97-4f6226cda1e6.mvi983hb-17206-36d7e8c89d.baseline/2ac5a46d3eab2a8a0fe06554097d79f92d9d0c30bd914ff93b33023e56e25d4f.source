import { describe, expect, it } from "vitest";
import { leafWidthLimits, leafWidthsMm, setLeafWidth } from "../src/shared/leaf-widths";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("leaf widths in whole millimetres", () => {
  it("always add up to the frame width", () => {
    expect(leafWidthsMm(1000, [1 / 3, 1 / 3, 1 / 3])).toEqual([334, 333, 333]);
    expect(leafWidthsMm(1200, [0.5, 0.5])).toEqual([600, 600]);
    expect(leafWidthsMm(1431, [0.5, 0.5])).toEqual([716, 715]);
    expect(leafWidthsMm(1000, [1])).toEqual([1000]);
    for (const [w, r] of [[1999, [0.2, 0.3, 0.5]], [2501, [0.1, 0.1, 0.1, 0.35, 0.35]], [777, [0.333, 0.334, 0.333]]] as const) {
      const out = leafWidthsMm(w, [...r]);
      expect(sum(out)).toBe(w);
      out.forEach((x, i) => expect(Math.abs(x - w * r[i])).toBeLessThan(1));
    }
  });
  it("copes with empty or broken ratios", () => {
    expect(leafWidthsMm(900, [])).toEqual([]);
    expect(sum(leafWidthsMm(900, [0, 0, 0]))).toBe(900);
    expect(sum(leafWidthsMm(900, [Number.NaN, 1, -2]))).toBe(900);
  });
});

describe("limits of a leaf", () => {
  it("minimum of its own, maximum = frame minus the minimum of every other leaf", () => {
    expect(leafWidthLimits(1500, [415, 300, 415], 1)).toEqual({ min: 300, max: 1500 - 830 });
    expect(leafWidthLimits(1000, [500, 600], 0)).toEqual({ min: 250, max: 750 }); // frame narrower than the minimums: sane floor (see below)
  });
});

describe("a frame too narrow for the structural minimums", () => {
  it("still lets the proportions be corrected, with every leaf kept at a sane size and the sum exact", () => {
    const mins = [300, 415, 415]; // 1130 > 1000
    expect(leafWidthLimits(1000, mins, 0)).toEqual({ min: 166, max: 1000 - 332 });
    const r = setLeafWidth(1000, [0.2, 0.4, 0.4], mins, 0, 300);
    if (!r.ok) throw new Error("should be ok");
    expect(r.widthsMm[0]).toBe(300);
    expect(sum(r.widthsMm)).toBe(1000);
    expect(r.widthsMm.every((w) => w >= 166)).toBe(true);
    expect(sum(r.ratios)).toBeCloseTo(1, 12);
    expect(setLeafWidth(1000, [0.2, 0.4, 0.4], mins, 0, 100)).toMatchObject({ ok: false, reason: "range", min: 166 });
  });
  it("a frame that holds the minimums is untouched by this rule", () => {
    expect(leafWidthLimits(1500, [300, 415, 415], 0)).toEqual({ min: 300, max: 1500 - 830 });
  });
});

describe("typing the width of one leaf", () => {
  const mins = [300, 300, 300];
  it("two leaves: the other one takes the rest", () => {
    const r = setLeafWidth(1400, [0.5, 0.5], [300, 300], 0, 500);
    expect(r).toEqual({ ok: true, widthsMm: [500, 900], ratios: [500 / 1400, 900 / 1400] });
  });
  it("three leaves: the others share what is left in proportion to their width", () => {
    const r = setLeafWidth(1500, [0.2, 0.3, 0.5], mins, 0, 600);
    if (!r.ok) throw new Error("should be ok");
    expect(r.widthsMm[0]).toBe(600);
    expect(sum(r.widthsMm)).toBe(1500);
    // others were 450 : 750 -> 900 shared 3:5 -> 337.5 : 562.5
    expect(r.widthsMm[1]).toBeGreaterThanOrEqual(337);
    expect(r.widthsMm[1]).toBeLessThanOrEqual(338);
    expect(sum(r.ratios)).toBeCloseTo(1, 12);
  });
  it("no leaf of the others goes under its minimum: it is pinned there and the rest is shared again", () => {
    const r = setLeafWidth(1500, [0.2, 0.3, 0.5], [300, 300, 300], 2, 850);
    if (!r.ok) throw new Error("should be ok");
    // others share 650: 300 : 450 -> 260 : 390 -> the first would drop below 300, it stays at 300, the second gets 350
    expect(r.widthsMm).toEqual([300, 350, 850]);
  });
  it("the whole range is reachable and exact; outside it is refused with the limits", () => {
    const { min, max } = leafWidthLimits(1500, mins, 1);
    for (const mm of [min, max, 777]) {
      const r = setLeafWidth(1500, [0.2, 0.3, 0.5], mins, 1, mm);
      if (!r.ok) throw new Error(`should be ok for ${mm}`);
      expect(r.widthsMm[1]).toBe(mm);
      expect(sum(r.widthsMm)).toBe(1500);
      r.widthsMm.forEach((w, i) => expect(w).toBeGreaterThanOrEqual(mins[i]));
    }
    expect(setLeafWidth(1500, [0.2, 0.3, 0.5], mins, 1, min - 1)).toEqual({ ok: false, reason: "range", min, max });
    expect(setLeafWidth(1500, [0.2, 0.3, 0.5], mins, 1, max + 1)).toEqual({ ok: false, reason: "range", min, max });
  });
  it("refuses fractions, NaN, a wrong index or a mismatched minimum list", () => {
    expect(setLeafWidth(1500, [0.5, 0.5], [300, 300], 0, 500.5).ok).toBe(false);
    expect(setLeafWidth(1500, [0.5, 0.5], [300, 300], 0, Number.NaN).ok).toBe(false);
    expect(setLeafWidth(1500, [0.5, 0.5], [300, 300], 2, 500)).toEqual({ ok: false, reason: "index" });
    expect(setLeafWidth(1500, [0.5, 0.5], [300, 300], -1, 500)).toEqual({ ok: false, reason: "index" });
    expect(setLeafWidth(1500, [0.5, 0.5], [300], 0, 500)).toEqual({ ok: false, reason: "index" });
  });
  it("a single leaf can only be the whole frame", () => {
    expect(setLeafWidth(1000, [1], [300], 0, 1000)).toMatchObject({ ok: true, widthsMm: [1000] });
    expect(setLeafWidth(1000, [1], [300], 0, 900)).toMatchObject({ ok: false, reason: "range" });
  });
  it("many leaves, odd widths: always exact", () => {
    for (let mm = 300; mm <= 1000; mm += 37) {
      const r = setLeafWidth(2501, [0.1, 0.2, 0.3, 0.1, 0.3], [300, 300, 300, 300, 300].map(() => 200), 2, mm);
      if (r.ok) expect(sum(r.widthsMm)).toBe(2501);
    }
  });
});

import { ProjectItemSchema } from "../src/shared/widget-types";

describe("the server schema and the stored shares", () => {
  const base = { productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 1500, height: 1400, quantity: 1, glazing: "double", color: "white", insectScreen: false };
  const sash = (widthRatio?: number) => ({ type: "classic", direction: "left", active: true, hardware: "", hardwareColor: "", ...(widthRatio === undefined ? {} : { widthRatio }) });
  it("accepts shares that add up to the frame, as the editors store them", () => {
    const r = setLeafWidth(1500, [0.2, 0.3, 0.5], [300, 300, 300], 1, 777);
    if (!r.ok) throw new Error("ok");
    expect(ProjectItemSchema.safeParse({ ...base, sashes: r.ratios.map(sash) }).success).toBe(true);
    expect(ProjectItemSchema.safeParse({ ...base, sashes: [sash(1 / 3), sash(1 / 3), sash(1 / 3)] }).success).toBe(true);
  });
  it("accepts leaves that state no share at all, or only some", () => {
    expect(ProjectItemSchema.safeParse({ ...base, sashes: [sash(), sash()] }).success).toBe(true);
    expect(ProjectItemSchema.safeParse({ ...base, sashes: [sash(0.4), sash()] }).success).toBe(true);
  });
  it("shares that do not add up are scaled to exactly the frame, the quote is kept", () => {
    const r = ProjectItemSchema.safeParse({ ...base, sashes: [sash(0.5), sash(0.7)] });
    expect(r.success).toBe(true);
    if (r.success) {
      const shares = r.data.sashes.map((x) => x.widthRatio ?? 0);
      expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(shares[0]).toBeCloseTo(0.5 / 1.2, 12);
    }
    const half = ProjectItemSchema.safeParse({ ...base, sashes: [sash(0.2), sash(0.2)] });
    expect(half.success && half.data.sashes.map((x) => x.widthRatio)).toEqual([0.5, 0.5]);
  });
});
