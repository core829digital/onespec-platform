import { describe, expect, it } from "vitest";
import { buildSupplyCsv, csvText, EXPORT_HEADERS, supplyCsvName, type SupplyExportRow } from "../src/shared/supply-export";

const row = (over: Partial<SupplyExportRow> = {}): SupplyExportRow => ({
  reference: "Q-2026-0001", customerName: "Giuseppe Verdi", orderedAt: Date.UTC(2026, 0, 10), deliveredAt: Date.UTC(2026, 1, 3),
  producer: "Winarhi Srl", deliverer: "Trasporti Rossi", revenueExVatCents: 100000, vatPercent: 22, vatReason: "domestic",
  factoryCostCents: 60000, factoryPaidAt: Date.UTC(2026, 0, 20), transportCostCents: 2050, otherCostsCents: 1000, ...over,
});
const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("supply CSV for the accountant", () => {
  it("Italian: BOM, ';' delimiter, decimal comma, ISO dates, localized header, totals row", () => {
    const { csv, rows, totals } = buildSupplyCsv([row()], "it");
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, data, total] = lines(csv);
    expect(head.split(";")).toHaveLength(16);
    expect(head.startsWith("Riferimento;Cliente;Data ordine;Data consegna")).toBe(true);
    expect(data).toBe("Q-2026-0001;Giuseppe Verdi;2026-01-10;2026-02-03;Winarhi Srl;Trasporti Rossi;1000,00;22;220,00;1220,00;IVA ordinaria;600,00;2026-01-20;20,50;10,00;369,50");
    expect(total.split(";")[0]).toBe("TOTALE");
    expect(rows).toBe(1);
    expect(totals).toEqual({ revenueExVatCents: 100000, vatCents: 22000, grossCents: 122000, costCents: 63050, profitCents: 36950 });
  });

  it("English uses ',' and '.'", () => {
    const [, data] = lines(buildSupplyCsv([row()], "en").csv);
    expect(data).toBe("Q-2026-0001,Giuseppe Verdi,2026-01-10,2026-02-03,Winarhi Srl,Trasporti Rossi,1000.00,22,220.00,1220.00,Standard VAT,600.00,2026-01-20,20.50,10.00,369.50");
  });

  it("totals add up across rows, sorted by delivery date; negative profit keeps its sign", () => {
    const a = row({ reference: "B", deliveredAt: Date.UTC(2026, 5, 1) });
    const b = row({ reference: "A", deliveredAt: Date.UTC(2026, 2, 1), revenueExVatCents: 10000, factoryCostCents: 12000, transportCostCents: 0, otherCostsCents: 0 });
    const out = lines(buildSupplyCsv([a, b], "it").csv);
    expect(out[1].startsWith("A;")).toBe(true);
    expect(out[1].endsWith(";-20,00")).toBe(true);
    expect(out[3].split(";").at(-1)).toBe("349,50"); // 369,50 - 20,00
  });

  it("zero VAT without a stated reason is a manual exemption; export and intra-EU get their legal wording", () => {
    expect(lines(buildSupplyCsv([row({ vatPercent: 0, vatReason: undefined })], "it").csv)[1]).toContain("IVA 0% (esenzione manuale)");
    expect(lines(buildSupplyCsv([row({ vatPercent: 0, vatReason: "intraEu" })], "it").csv)[1]).toContain("art. 138");
    expect(lines(buildSupplyCsv([row({ vatPercent: 0, vatReason: "export" })], "de").csv)[1]).toContain("Art. 146");
  });

  it("empty period: only the header, no totals line", () => {
    const { csv, rows } = buildSupplyCsv([], "it");
    expect(rows).toBe(0);
    expect(lines(csv)).toHaveLength(1);
  });

  it("every language has all sixteen headers", () => {
    for (const l of Object.keys(EXPORT_HEADERS) as (keyof typeof EXPORT_HEADERS)[]) {
      expect(Object.values(EXPORT_HEADERS[l]).every((h) => h.length > 1)).toBe(true);
      expect(lines(buildSupplyCsv([row()], l).csv)[0].split(l === "en" ? "," : ";").length).toBeGreaterThanOrEqual(16);
    }
  });

  it("text cells cannot run as formulas, and delimiters / quotes / newlines cannot break the columns", () => {
    expect(csvText("=HYPERLINK(\"http://x\")", ";")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvText("+39 340", ";")).toBe("'+39 340");
    expect(csvText("-1", ";")).toBe("'-1");
    expect(csvText("@SUM(A1)", ";")).toBe("'@SUM(A1)");
    expect(csvText("Rossi; Bianchi", ";")).toBe('"Rossi; Bianchi"');
    expect(csvText('Casa "Bella"', ";")).toBe('"Casa ""Bella"""');
    expect(csvText("riga1\nriga2", ";")).toBe("riga1 riga2");
    expect(csvText("a\u0000b", ";")).toBe("ab");
    const evil = lines(buildSupplyCsv([row({ customerName: "=cmd|' /C calc'!A0" })], "it").csv)[1].split(";");
    expect(evil[1].startsWith("'=")).toBe(true);
    expect(evil).toHaveLength(16);
  });

  it("file name carries the period", () => {
    expect(supplyCsvName(Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 31))).toBe("supplies-2026-01-01_2026-12-31.csv");
  });
});
