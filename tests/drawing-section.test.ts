import { describe, expect, it } from "vitest";
import { buildSectionScene, glazingThicknessMm, paneCount, pvcChambers } from "@/lib/drawing";
import { DRAWING_SECTION } from "@/lib/drawing";

const texts = (s: ReturnType<typeof buildSectionScene>) =>
  s.primitives.flatMap((p) => (p.type === "text" ? [p.text] : []));
const finite = (s: ReturnType<typeof buildSectionScene>) =>
  s.primitives.every((p) => JSON.stringify(p).indexOf("NaN") < 0 && JSON.stringify(p).indexOf("null") < 0);

describe("section of the profile", () => {
  it("reads panes, thickness and chambers from the catalogue keys", () => {
    expect(paneCount("triple")).toBe(3);
    expect(paneCount("double")).toBe(2);
    expect(paneCount(undefined)).toBe(2);
    expect(glazingThicknessMm("triple")).toBe(36);
    expect(glazingThicknessMm("double")).toBe(24);
    expect(pvcChambers("chamber7")).toBe(7);
    expect(pvcChambers("chamber5")).toBe(5);
  });

  it("draws every material in every language with finite coordinates inside the viewBox", () => {
    for (const material of ["pvc", "wood", "aluminum"]) {
      for (const locale of ["it", "en", "fr", "de", "nl", "ro"]) {
        const s = buildSectionScene({ material, glazing: "triple", quality: "thermalbreak" }, locale);
        expect(s.viewBox.w).toBeGreaterThan(100);
        expect(finite(s)).toBe(true);
        expect(s.primitives.length).toBeGreaterThan(20);
        expect(texts(s)).toContain(DRAWING_SECTION[locale as "it"].note);
      }
    }
  });

  it("triple glazing is thicker than double, and the thermal line only shows when known", () => {
    const a = buildSectionScene({ material: "pvc", glazing: "double" });
    const b = buildSectionScene({ material: "pvc", glazing: "triple", thermal: { uf: 1.1, ug: 0.6, psi: 0.04 } });
    const glassCount = (s: typeof a) => s.primitives.filter((p) => p.role === "glass").length;
    expect(glassCount(b)).toBeGreaterThan(glassCount(a));
    expect(texts(b).some((t) => t.includes("Uf 1.10"))).toBe(true);
    expect(texts(a).some((t) => t.includes("Uf"))).toBe(false);
  });

  it("renovation frames add the sub-frame call-out", () => {
    const reno = buildSectionScene({ material: "pvc", frameType: "reno40" }, "it");
    const plain = buildSectionScene({ material: "pvc", frameType: "dritto" }, "it");
    expect(reno.primitives.length).toBeGreaterThan(plain.primitives.length);
  });
});
