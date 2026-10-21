import { describe, expect, it } from "vitest";
import {
  PROFIT_WINDOWS_MONTHS, checkAmountCents, expectedProfit, nextStage, parseEuroInput, previousStage, summarizeProfit, supplyProfitCents, windowStart,
} from "../src/shared/supply";

const D = (iso: string) => Date.parse(iso);

describe("supply stages", () => {
  it("quote → order → production → delivery → delivered", () => {
    expect(nextStage("quote")).toBe("order");
    expect(nextStage("order")).toBe("production");
    expect(nextStage("production")).toBe("delivery");
    expect(nextStage("delivery")).toBe("delivered");
    expect(nextStage("delivered")).toBeNull();
    expect(previousStage("quote")).toBeNull();
    expect(previousStage("delivered")).toBe("delivery");
  });
});

describe("amounts", () => {
  it("accepts integer cents in range only", () => {
    expect(checkAmountCents(0)).toEqual({ ok: true, cents: 0 });
    expect(checkAmountCents(12345)).toEqual({ ok: true, cents: 12345 });
    for (const bad of [-1, 1.5, NaN, Infinity, "10", 1_000_000_001]) expect(checkAmountCents(bad).ok).toBe(false);
    expect(checkAmountCents(undefined)).toEqual({ ok: false, code: "REQUIRED" });
  });
  it("parses typed euros", () => {
    expect(parseEuroInput("1234,5")).toEqual({ ok: true, cents: 123450 });
    expect(parseEuroInput("99.99")).toEqual({ ok: true, cents: 9999 });
    expect(parseEuroInput("0")).toEqual({ ok: true, cents: 0 });
    expect(parseEuroInput("1,234.50").ok).toBe(false);
    expect(parseEuroInput("12.345")).toEqual({ ok: false, code: "TOO_MANY_DECIMALS" });
    expect(parseEuroInput("-5")).toEqual({ ok: false, code: "NEGATIVE" });
    expect(parseEuroInput("")).toEqual({ ok: false, code: "REQUIRED" });
    expect(parseEuroInput("abc").ok).toBe(false);
    expect(parseEuroInput("99999999999").ok).toBe(false);
  });
});

describe("net profit", () => {
  it("revenue without VAT minus the three costs", () => {
    expect(supplyProfitCents({ revenueExVatCents: 100000, factoryCostCents: 60000, transportCostCents: 5000, otherCostsCents: 10000 })).toBe(25000);
    expect(supplyProfitCents({ revenueExVatCents: 100000 })).toBe(100000);
    expect(supplyProfitCents({ revenueExVatCents: 10000, factoryCostCents: 12000 })).toBe(-2000);
  });

  it("windows are month / quarter / semester / year / 2 / 3 / 5 / 10 years", () => {
    expect([...PROFIT_WINDOWS_MONTHS]).toEqual([1, 3, 6, 12, 24, 36, 60, 120]);
  });

  it("month arithmetic clamps the day", () => {
    expect(new Date(windowStart(D("2026-03-31T12:00:00Z"), 1)).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(new Date(windowStart(D("2024-03-31T12:00:00Z"), 1)).toISOString()).toBe("2024-02-29T12:00:00.000Z");
    expect(new Date(windowStart(D("2026-01-15T00:00:00Z"), 3)).toISOString()).toBe("2025-10-15T00:00:00.000Z");
    expect(new Date(windowStart(D("2026-10-05T00:00:00Z"), 120)).toISOString()).toBe("2016-10-05T00:00:00.000Z");
  });

  it("each supply counts in every window that contains its delivery date, and not in the others", () => {
    const now = D("2026-10-05T10:00:00Z");
    const s = (deliveredAt: string, revenue: number, factory: number) => ({ deliveredAt: D(deliveredAt), revenueExVatCents: revenue, factoryCostCents: factory });
    const w = summarizeProfit(
      [s("2026-09-20T00:00:00Z", 100000, 70000), s("2026-06-01T00:00:00Z", 200000, 150000), s("2024-01-01T00:00:00Z", 50000, 60000), s("2026-10-06T00:00:00Z", 999, 1)],
      now,
    );
    const by = Object.fromEntries(w.map((x) => [x.months, x]));
    expect(by[1].netProfitCents).toBe(30000);
    expect(by[1].count).toBe(1);
    expect(by[3].count).toBe(1); // 1 Jun is before 5 Jul
    expect(by[6].netProfitCents).toBe(30000 + 50000);
    expect(by[12].count).toBe(2);
    expect(by[36].count).toBe(3);
    expect(by[36].netProfitCents).toBe(30000 + 50000 - 10000);
    expect(by[120].count).toBe(3); // the supply "delivered" in the future is never counted
  });

  it("a delivery exactly on the window boundary is outside (from, to]", () => {
    const now = D("2026-10-05T00:00:00Z");
    const w = summarizeProfit([{ deliveredAt: D("2026-09-05T00:00:00Z"), revenueExVatCents: 1000 }], now);
    expect(w[0].count).toBe(0);
    expect(w[1].count).toBe(1);
  });

  it("empty history gives zeros", () => {
    for (const w of summarizeProfit([], Date.now())) expect(w).toMatchObject({ count: 0, netProfitCents: 0 });
  });

  it("expected profit of open supplies", () => {
    expect(expectedProfit([{ revenueExVatCents: 1000, factoryCostCents: 600 }, { revenueExVatCents: 500 }])).toEqual({ count: 2, revenueExVatCents: 1500, costCents: 600, netProfitCents: 900 });
  });
});
