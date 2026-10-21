import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { toPdfText } from "../src/lib/pdfs/pdf-text";

// Built-in Helvetica covers Windows-1252 only; anything else prints as garbage.
const WIN1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));

test("PDF documents only use characters Helvetica can render", () => {
  const dir = join(__dirname, "..", "src", "lib", "pdfs");
  const bad: string[] = [];
  for (const f of readdirSync(dir).filter((n) => /PDF\.tsx$/.test(n))) {
    readFileSync(join(dir, f), "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        const chars = [...line].filter((c) => c.codePointAt(0)! > 255 && !WIN1252_EXTRA.has(c));
        if (chars.length) bad.push(`${f}:${i + 1} ${[...new Set(chars)].join(" ")}`);
      });
  }
  expect(bad).toEqual([]);
});

test("PDF documents render text through the sanitizing Text, not react-pdf's own", () => {
  const dir = join(__dirname, "..", "src", "lib", "pdfs");
  const direct = readdirSync(dir)
    .filter((n) => /\.tsx$/.test(n) && n !== "Text.tsx")
    .filter((f) => /import \{[^}]*\bText\b[^}]*\} from "@react-pdf\/renderer"/.test(readFileSync(join(dir, f), "utf8")));
  expect(direct).toEqual([]);
});

describe("toPdfText (issue #29)", () => {
  const drawable = (s: string) => [...s].every((c) => c.codePointAt(0)! <= 255 || WIN1252_EXTRA.has(c));

  test("keeps everything Windows-1252 already covers", () => {
    const s = "Müller & Cie — Rue de l'Église 12, 1 234,50 € « déjà » Œuvre";
    expect(toPdfText(s)).toBe(s);
  });

  test("drops the mark from accents outside the range and maps a few letters", () => {
    expect(toPdfText("Ștefan Țăran, Strada Mărășești")).toBe("Stefan Taran, Strada Marasesti");
    expect(toPdfText("Łukasz Wałęsa, Kraków")).toBe("Lukasz Walesa, Kraków");
    expect(toPdfText("Ćirić Đorđe")).toBe("Ciric Dorde");
    expect(toPdfText("Dvořák")).toBe("Dvorák");
  });

  test("fr-FR number spacing and typographic symbols become plain equivalents", () => {
    expect(toPdfText("1 234,50 €")).toBe("1 234,50 €");
    expect(toPdfText("A → B, h ≤ 2−x")).toBe("A -> B, h <= 2-x");
  });

  test("emoji and pictographs are left out, unknown letters become ?", () => {
    expect(toPdfText("Finestra ✅ ok 🇮🇹 👍🏽")).toBe("Finestra  ok  ");
    expect(toPdfText("Иван")).toBe("????");
  });

  test("decomposed input keeps its Windows-1252 accents", () => {
    expect(toPdfText("Café")).toBe("Café");
  });

  test("the output is always drawable", () => {
    for (const s of ["Ștefan 🚪 Σ ∑ ✓ ☐ ⚠ 中文 Łódź İstanbul ğ ı", "​‍️"]) expect(drawable(toPdfText(s))).toBe(true);
  });
});
