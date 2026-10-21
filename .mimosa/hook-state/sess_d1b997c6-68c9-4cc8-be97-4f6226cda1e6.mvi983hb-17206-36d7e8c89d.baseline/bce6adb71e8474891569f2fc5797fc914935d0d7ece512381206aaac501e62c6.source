/**
 * RFC-4180 CSV serialisation with spreadsheet formula-injection defence.
 *
 * A cell whose text begins with = + - @ or a control char is a formula target
 * in Excel / Sheets / LibreOffice. We prefix such cells with a single quote so
 * the spreadsheet treats them as text. Every cell is also quoted and its quotes
 * doubled.
 */

const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  // Neutralise formula triggers (also strip leading control chars first).
  s = s.replace(/^[\t\r]+/, "");
  if (FORMULA_LEAD.test(s)) s = `'${s}`;

  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Build a full CSV document (UTF-8 BOM so Excel detects the encoding). */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
