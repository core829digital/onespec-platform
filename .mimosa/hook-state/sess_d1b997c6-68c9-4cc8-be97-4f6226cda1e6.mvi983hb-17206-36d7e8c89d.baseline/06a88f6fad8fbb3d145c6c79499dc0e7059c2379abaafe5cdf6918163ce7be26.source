import { describe, expect, it } from "vitest";
import { buildSurveySheetScene, DRAWING_SURVEY, theoreticalDiagonalMm } from "@/lib/drawing";

const texts = (s: ReturnType<typeof buildSurveySheetScene>) => s.primitives.flatMap((p) => (p.type === "text" ? [p.text] : []));

describe("survey sheet", () => {
  it("computes the theoretical diagonal", () => {
    expect(theoreticalDiagonalMm(1200, 1400)).toBe(1844);
    expect(theoreticalDiagonalMm(3000, 4000)).toBe(5000);
    expect(theoreticalDiagonalMm(-5, 0)).toBe(0);
  });

  it("shows sizes, diagonal, three points per axis and the opening's details", () => {
    const s = buildSurveySheetScene({ label: "F1", widthMm: 1200, heightMm: 1400, room: "Cucina", floor: "1" }, "it");
    const t = texts(s);
    expect(t).toContain("1200 mm");
    expect(t).toContain("1400 mm");
    expect(t).toContain("1844");
    for (const l of ["L1", "L2", "L3", "H1", "H2", "H3"]) expect(t).toContain(l);
    expect(t.some((x) => x.includes("F1") && x.includes("Cucina"))).toBe(true);
    expect(s.primitives.filter((p) => p.part === "diagonal" && p.type === "line")).toHaveLength(2);
  });

  it("works in every language, tolerates odd sizes and keeps the geometry finite", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"] as const) {
      for (const [w, h] of [[1200, 1400], [0, 0], [6000, 300], [300, 6000]]) {
        const s = buildSurveySheetScene({ label: "", widthMm: w, heightMm: h }, l);
        expect(texts(s)).toContain(DRAWING_SURVEY[l].note);
        expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/);
        expect(s.viewBox.w).toBeGreaterThan(50);
      }
    }
  });
});
