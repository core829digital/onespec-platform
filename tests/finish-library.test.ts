import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FINISH_LIBRARY, FAMILY_WORD, GROUP_LABEL, RANGE_LABEL, finishLabel, finishLibraryRows, finishPriceCents, libraryFinishById } from "@/shared/finish-library";

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];

describe("finish library", () => {
  it("has the three ranges with the expected sizes", () => {
    const count = (r: string) => FINISH_LIBRARY.filter((f) => f.range === r).length;
    expect(count("skin")).toBe(79);
    expect(count("nuance")).toBeGreaterThanOrEqual(116);
    expect(count("rock")).toBe(2);
  });

  it("ids are unique, short and safe to use as catalogue keys", () => {
    const ids = FINISH_LIBRARY.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it("every colour is a hex and no painted RAL colour is pure black", () => {
    for (const f of FINISH_LIBRARY) expect(f.hex).toMatch(/^#[0-9A-F]{6}$/);
    for (const f of FINISH_LIBRARY.filter((x) => x.range === "nuance")) expect(f.hex.toUpperCase()).not.toBe("#000000");
  });

  it("textures exist on disk, with their size, for decors and stone only", () => {
    for (const f of FINISH_LIBRARY) {
      if (f.range === "nuance") {
        expect(f.texture).toBeUndefined();
        continue;
      }
      expect(f.texture).toMatch(/^\/finishes\/[a-z0-9]+\.jpg$/);
      expect(existsSync(`public${f.texture}`)).toBe(true);
      expect(f.tw).toBeGreaterThan(50);
      expect(f.th).toBeGreaterThan(50);
    }
  });

  it("does not name the supplier anywhere in the data", () => {
    const text = JSON.stringify(FINISH_LIBRARY).toLowerCase();
    for (const word of ["renolit", "ondex", "deceuninck", "skito"]) expect(text).not.toContain(word);
  });

  it("labels exist in six languages; painted colours read '<family> RAL <code>'", () => {
    for (const f of FINISH_LIBRARY) for (const l of LOCALES) expect(finishLabel(f, l)).toBeTruthy();
    expect(finishLabel(libraryFinishById("ral-1000")!, "it")).toBe("Beige RAL 1000");
    expect(finishLabel(libraryFinishById("ral-7016")!, "fr")).toBe("Gris RAL 7016");
    expect(finishLabel(libraryFinishById("ral-5007")!, "de")).toBe("Blau RAL 5007");
    for (const w of Object.values(FAMILY_WORD)) for (const l of LOCALES) expect((w as Record<string, string>)[l]).toBeTruthy();
    for (const r of Object.values(RANGE_LABEL)) for (const l of LOCALES) expect((r as Record<string, string>)[l]).toBeTruthy();
    for (const g of Object.values(GROUP_LABEL)) for (const l of LOCALES) expect((g as Record<string, string>)[l]).toBeTruthy();
  });

  it("RAL 7035 is a light grey (the chart printed it like 7034)", () => {
    const f = libraryFinishById("ral-7035")!;
    const lum = parseInt(f.hex.slice(1, 3), 16);
    expect(lum).toBeGreaterThan(180);
  });

  it("rows carry price, range, group and warranty; whites are free, stone costs most", () => {
    const rows = finishLibraryRows();
    expect(rows).toHaveLength(FINISH_LIBRARY.length);
    expect(new Set(rows.map((r) => r.sortOrder)).size).toBe(rows.length);
    expect(finishPriceCents(libraryFinishById("ral-9016")!)).toBe(0);
    expect(finishPriceCents(libraryFinishById("rock01")!)).toBeGreaterThan(finishPriceCents(libraryFinishById("s01")!));
    expect(rows.filter((r) => r.warrantyYears === 5).length).toBeGreaterThan(0);
    expect(rows.find((r) => r.key === "s01")).toMatchObject({ range: "skin", texture: "/finishes/s01.jpg" });
  });
});
