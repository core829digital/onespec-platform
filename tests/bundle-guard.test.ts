// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Performance guard: the PDF engine is ~1.2 MB of JavaScript. It may only be pulled in by the files that really make PDFs; anything
 * else (a list page, the editor, the drawing barrel) must not import it, or every visit pays for it. See docs in lib/drawing/pdf.ts.
 */
const ALLOWED = [
  /^src\/lib\/pdfs\//,
  /^src\/lib\/drawing\/(render-pdf|WindowDrawingPdf|pdf)\.tsx?$/,
  /^src\/components\/ui\/pdf-frame\.tsx$/,
  /^src\/components\/ui\/PDFViewer\.tsx$/, // type-only + dynamic import
  /^src\/hooks\/usePDFDownload\.tsx$/, // dynamic import on click
  /^src\/app\/\[locale\]\/app\/.*\/print\/page\.tsx$/,
  /^src\/app\/\[locale\]\/app\/quotes\/\[id\]\/print\/page\.tsx$/,
  /^src\/app\/\[locale\]\/app\/passports\/\[id\]\/labels\/page\.tsx$/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("bundle guard", () => {
  test("only PDF files import the PDF engine statically", () => {
    const offenders = walk("src")
      .map((f) => relative(".", f).replaceAll("\\", "/"))
      .filter((f) => /^\s*import\s+(?!type\b)[^;]*from\s+["']@react-pdf\/renderer["']/m.test(readFileSync(f, "utf8")))
      .filter((f) => !ALLOWED.some((re) => re.test(f)));
    expect(offenders).toEqual([]);
  });

  test("the drawing barrel does not re-export the PDF renderers", () => {
    const barrel = readFileSync("src/lib/drawing/index.ts", "utf8");
    expect(barrel).not.toMatch(/render-pdf|WindowDrawingPdf|ScenePdf/);
  });
});
