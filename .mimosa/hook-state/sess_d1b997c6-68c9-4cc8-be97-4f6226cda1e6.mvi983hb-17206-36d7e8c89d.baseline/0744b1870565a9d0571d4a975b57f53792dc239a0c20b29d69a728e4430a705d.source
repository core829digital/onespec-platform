import { describe, expect, it } from "vitest";
import { parseEuroAmountToCents } from "../src/shared/money-input";

describe("parseEuroAmountToCents (catalog import and price cells, issue #30)", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12.50", 1250],
    ["1.234", 123400], // it-IT grouping, not €1.23
    ["12.500", 1250000],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1 234,56", 123456],
    ["1'234.56", 123456],
    ["€ 980", 98000],
    ["1.234.567", 123456700],
    ["0", 0],
    [" 7 ", 700],
  ])("%s -> %i cents", (raw, cents) => expect(parseEuroAmountToCents(raw)).toBe(cents));

  it.each(["", "   ", "abc", "-5", "1,2,3", "12.345,6789", "1.23.4", "12,345,6", "1e3", "12.5.6"])("rejects %j", (raw) =>
    expect(parseEuroAmountToCents(raw)).toBeNull(),
  );

  it("numbers are euros; non-finite, negative and absurd values are rejected", () => {
    expect(parseEuroAmountToCents(12.5)).toBe(1250);
    expect(parseEuroAmountToCents(Number.NaN)).toBeNull();
    expect(parseEuroAmountToCents(-1)).toBeNull();
    expect(parseEuroAmountToCents(20_000_000)).toBeNull();
    expect(parseEuroAmountToCents(undefined)).toBeNull();
  });
});
