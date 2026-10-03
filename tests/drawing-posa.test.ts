import { describe, expect, it } from "vitest";
import { buildPosaNodeScene, DRAWING_POSA, posaJobFor, posaKindFor } from "@/lib/drawing";

const texts = (s: ReturnType<typeof buildPosaNodeScene>) => s.primitives.flatMap((p) => (p.type === "text" ? [p.text] : []));
const has = (s: ReturnType<typeof buildPosaNodeScene>, part: string) => s.primitives.some((p) => p.part === part);

describe("installation node drawing", () => {
  it("maps the node keys of every market to a jamb or a sill", () => {
    for (const k of ["primario", "secondario", "cassonetto"]) expect(posaKindFor(k)).toBe("jamb");
    for (const k of ["appui", "onderdorpel", "bodenanschluss"]) expect(posaKindFor(k)).toBe("sill");
  });

  it("maps the job keys of every market to standard / insulated / renovation", () => {
    for (const k of ["sostituzione", "nuova", "neuf", "nieuwbouw", "neubau", "austausch", "depose_totale"]) expect(posaJobFor(k)).toBe("standard");
    for (const k of ["cappotto", "ite", "na_isolatie", "wdvs", "renovation_lourde", "isolation"]) expect(posaJobFor(k)).toBe("insulated");
    for (const k of ["ristrutturazione", "renovation", "renovatie"]) expect(posaJobFor(k)).toBe("renovation");
  });

  it("draws insulation only on insulated jobs and the sub-frame on non-standard ones", () => {
    const std = buildPosaNodeScene({ nodeType: "primario", jobType: "sostituzione" });
    const ins = buildPosaNodeScene({ nodeType: "primario", jobType: "cappotto" });
    const ren = buildPosaNodeScene({ nodeType: "primario", jobType: "ristrutturazione" });
    expect(has(std, "insulation")).toBe(false);
    expect(has(ins, "insulation")).toBe(true);
    expect(has(std, "band")).toBe(false);
    expect(has(ren, "band")).toBe(true);
    expect(has(ren, "insulation")).toBe(false);
  });

  it("always draws foam, both tapes, sealant and fixing; sills add the two sill boards", () => {
    for (const nodeType of ["primario", "appui"]) {
      const s = buildPosaNodeScene({ nodeType, jobType: "nuova" });
      for (const part of ["foam", "tapeIn", "tapeOut", "sealant", "fixing"]) expect(has(s, part)).toBe(true);
    }
    const sill = buildPosaNodeScene({ nodeType: "appui", jobType: "nuova" });
    expect(has(sill, "sillOut") && has(sill, "sillIn")).toBe(true);
  });

  it("reads in six languages with finite geometry", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"] as const) {
      for (const nodeType of ["primario", "appui"]) {
        const s = buildPosaNodeScene({ nodeType, jobType: "cappotto" }, l);
        expect(texts(s)).toContain(DRAWING_POSA[l].note);
        expect(texts(s).some((t) => t.includes(DRAWING_POSA[l].tapeIn))).toBe(true);
        expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/);
        expect(s.viewBox.w).toBeGreaterThan(100);
      }
    }
  });
});
