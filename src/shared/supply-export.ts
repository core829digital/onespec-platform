// CSV of the supplies delivered in a period, for the accountant. Opens in Excel / LibreOffice / Numbers as is:
// UTF-8 with BOM, ";" as the delimiter and "," as the decimal mark (the "." / "," of English), dates as YYYY-MM-DD,
// no thousands separators, amounts WITHOUT VAT unless the column says otherwise.

export interface SupplyExportRow {
  reference: string;
  customerName: string;
  orderedAt?: number;
  deliveredAt: number;
  producer?: string;
  deliverer?: string;
  revenueExVatCents: number;
  vatPercent: number;
  vatReason?: "domestic" | "intraEu" | "export" | "manualZero";
  factoryCostCents: number;
  factoryPaidAt?: number;
  transportCostCents: number;
  otherCostsCents: number;
}

type Lang = "it" | "en" | "fr" | "de" | "nl" | "ro";
const COLS = ["reference", "customer", "ordered", "delivered", "producer", "deliverer", "revenue", "vatRate", "vat", "gross", "vatRegime", "factory", "factoryPaid", "transport", "other", "profit"] as const;
type Col = (typeof COLS)[number];

export const EXPORT_HEADERS: Record<Lang, Record<Col, string>> = {
  it: { reference: "Riferimento", customer: "Cliente", ordered: "Data ordine", delivered: "Data consegna", producer: "Fabbrica", deliverer: "Trasportatore", revenue: "Ricavo (senza IVA)", vatRate: "Aliquota IVA %", vat: "IVA", gross: "Totale con IVA", vatRegime: "Regime IVA", factory: "Costo fabbrica (senza IVA)", factoryPaid: "Fabbrica pagata il", transport: "Costo trasporto (senza IVA)", other: "Altri costi (senza IVA)", profit: "Profitto netto (senza IVA, prima delle imposte)" },
  en: { reference: "Reference", customer: "Customer", ordered: "Order date", delivered: "Delivery date", producer: "Factory", deliverer: "Deliverer", revenue: "Revenue (excl. VAT)", vatRate: "VAT rate %", vat: "VAT", gross: "Total incl. VAT", vatRegime: "VAT treatment", factory: "Factory cost (excl. VAT)", factoryPaid: "Factory paid on", transport: "Transport cost (excl. VAT)", other: "Other costs (excl. VAT)", profit: "Net profit (excl. VAT, before income tax)" },
  fr: { reference: "Référence", customer: "Client", ordered: "Date de commande", delivered: "Date de livraison", producer: "Usine", deliverer: "Transporteur", revenue: "Chiffre d'affaires (HT)", vatRate: "Taux de TVA %", vat: "TVA", gross: "Total TTC", vatRegime: "Régime de TVA", factory: "Coût usine (HT)", factoryPaid: "Usine payée le", transport: "Coût transport (HT)", other: "Autres coûts (HT)", profit: "Bénéfice net (HT, avant impôt)" },
  de: { reference: "Referenz", customer: "Kunde", ordered: "Bestelldatum", delivered: "Lieferdatum", producer: "Fabrik", deliverer: "Spediteur", revenue: "Erlös (netto)", vatRate: "MwSt.-Satz %", vat: "MwSt.", gross: "Summe brutto", vatRegime: "MwSt.-Behandlung", factory: "Fabrikkosten (netto)", factoryPaid: "Fabrik bezahlt am", transport: "Transportkosten (netto)", other: "Sonstige Kosten (netto)", profit: "Nettogewinn (netto, vor Ertragsteuern)" },
  nl: { reference: "Referentie", customer: "Klant", ordered: "Besteldatum", delivered: "Leverdatum", producer: "Fabriek", deliverer: "Vervoerder", revenue: "Opbrengst (excl. btw)", vatRate: "Btw-tarief %", vat: "Btw", gross: "Totaal incl. btw", vatRegime: "Btw-behandeling", factory: "Fabriekskosten (excl. btw)", factoryPaid: "Fabriek betaald op", transport: "Transportkosten (excl. btw)", other: "Overige kosten (excl. btw)", profit: "Nettowinst (excl. btw, vóór inkomstenbelasting)" },
  ro: { reference: "Referință", customer: "Client", ordered: "Data comenzii", delivered: "Data livrării", producer: "Fabrică", deliverer: "Transportator", revenue: "Venit (fără TVA)", vatRate: "Cota TVA %", vat: "TVA", gross: "Total cu TVA", vatRegime: "Regim TVA", factory: "Cost fabrică (fără TVA)", factoryPaid: "Fabrică plătită la", transport: "Cost transport (fără TVA)", other: "Alte costuri (fără TVA)", profit: "Profit net (fără TVA, înainte de impozit)" },
};

const REGIMES: Record<Lang, Record<"domestic" | "intraEu" | "export" | "manualZero", string>> = {
  it: { domestic: "IVA ordinaria", intraEu: "Non imponibile: cessione intracomunitaria (art. 138)", export: "Non imponibile: esportazione (art. 146)", manualZero: "IVA 0% (esenzione manuale)" },
  en: { domestic: "Standard VAT", intraEu: "Exempt: intra-Community supply (Art. 138)", export: "Exempt: export (Art. 146)", manualZero: "0% VAT (manual exemption)" },
  fr: { domestic: "TVA normale", intraEu: "Exonéré : livraison intracommunautaire (art. 138)", export: "Exonéré : exportation (art. 146)", manualZero: "TVA 0 % (exonération manuelle)" },
  de: { domestic: "Reguläre MwSt.", intraEu: "Steuerfrei: innergemeinschaftliche Lieferung (Art. 138)", export: "Steuerfrei: Ausfuhr (Art. 146)", manualZero: "MwSt. 0 % (manuelle Befreiung)" },
  nl: { domestic: "Normale btw", intraEu: "Vrijgesteld: intracommunautaire levering (art. 138)", export: "Vrijgesteld: uitvoer (art. 146)", manualZero: "Btw 0% (handmatige vrijstelling)" },
  ro: { domestic: "TVA standard", intraEu: "Scutit: livrare intracomunitară (art. 138)", export: "Scutit: export (art. 146)", manualZero: "TVA 0% (scutire manuală)" },
};

const langOf = (locale: string): Lang => (["it", "en", "fr", "de", "nl", "ro"] as const).find((l) => l === locale) ?? "en";

/** Text cell: a spreadsheet would run a value starting with = + - @ as a formula, so it gets a leading apostrophe; quoted when needed. */
export function csvText(raw: string, delimiter: string): string {
  let v = raw.replace(/\r\n?|\n/g, " ").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";,\n]/.test(v) || v.includes(delimiter) ? `"${v.replace(/"/g, '""')}"` : v;
}

const day = (ms: number | undefined) => (ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10));
const amount = (cents: number, decimal: string) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}${decimal}${String(abs % 100).padStart(2, "0")}`;
};

export interface SupplyCsv {
  csv: string;
  rows: number;
  totals: { revenueExVatCents: number; vatCents: number; grossCents: number; costCents: number; profitCents: number };
}

/** The file content (with BOM) and the totals it carries; the last line is the total of every amount column. */
export function buildSupplyCsv(rows: SupplyExportRow[], locale: string): SupplyCsv {
  const lang = langOf(locale);
  const english = lang === "en";
  const delimiter = english ? "," : ";";
  const decimal = english ? "." : ",";
  const head = COLS.map((c) => csvText(EXPORT_HEADERS[lang][c], delimiter)).join(delimiter);
  const totals = { revenueExVatCents: 0, vatCents: 0, grossCents: 0, factory: 0, transport: 0, other: 0, profitCents: 0 };
  const lines = [...rows].sort((a, b) => a.deliveredAt - b.deliveredAt).map((r) => {
    const vat = Math.round((r.revenueExVatCents * r.vatPercent) / 100);
    const profit = r.revenueExVatCents - r.factoryCostCents - r.transportCostCents - r.otherCostsCents;
    totals.revenueExVatCents += r.revenueExVatCents;
    totals.vatCents += vat;
    totals.grossCents += r.revenueExVatCents + vat;
    totals.factory += r.factoryCostCents;
    totals.transport += r.transportCostCents;
    totals.other += r.otherCostsCents;
    totals.profitCents += profit;
    const cells: Record<Col, string> = {
      reference: csvText(r.reference, delimiter),
      customer: csvText(r.customerName, delimiter),
      ordered: day(r.orderedAt),
      delivered: day(r.deliveredAt),
      producer: csvText(r.producer ?? "", delimiter),
      deliverer: csvText(r.deliverer ?? "", delimiter),
      revenue: amount(r.revenueExVatCents, decimal),
      vatRate: String(r.vatPercent).replace(".", decimal),
      vat: amount(vat, decimal),
      gross: amount(r.revenueExVatCents + vat, decimal),
      vatRegime: csvText(REGIMES[lang][r.vatReason ?? (r.vatPercent === 0 ? "manualZero" : "domestic")], delimiter),
      factory: amount(r.factoryCostCents, decimal),
      factoryPaid: day(r.factoryPaidAt),
      transport: amount(r.transportCostCents, decimal),
      other: amount(r.otherCostsCents, decimal),
      profit: amount(profit, decimal),
    };
    return COLS.map((c) => cells[c]).join(delimiter);
  });
  const totalCells: Record<Col, string> = {
    reference: csvText({ it: "TOTALE", en: "TOTAL", fr: "TOTAL", de: "SUMME", nl: "TOTAAL", ro: "TOTAL" }[lang], delimiter),
    customer: "", ordered: "", delivered: "", producer: "", deliverer: "", vatRate: "", vatRegime: "", factoryPaid: "",
    revenue: amount(totals.revenueExVatCents, decimal),
    vat: amount(totals.vatCents, decimal),
    gross: amount(totals.grossCents, decimal),
    factory: amount(totals.factory, decimal),
    transport: amount(totals.transport, decimal),
    other: amount(totals.other, decimal),
    profit: amount(totals.profitCents, decimal),
  };
  const body = lines.length > 0 ? [...lines, COLS.map((c) => totalCells[c]).join(delimiter)] : [];
  return {
    csv: `﻿${[head, ...body].join("\r\n")}\r\n`,
    rows: lines.length,
    totals: { revenueExVatCents: totals.revenueExVatCents, vatCents: totals.vatCents, grossCents: totals.grossCents, costCents: totals.factory + totals.transport + totals.other, profitCents: totals.profitCents },
  };
}

/** The file name: supplies-2026-01-01_2026-12-31.csv */
export const supplyCsvName = (from: number, to: number) => `supplies-${day(from)}_${day(to)}.csv`;
