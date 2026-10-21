import { describe, expect, it } from "vitest";
import {
  COMPOSITIONS,
  PACKAGE_DEPTHS,
  glazingAdvice,
  glazingPackageRows,
  glazingShape,
  packageKey,
  packageUg,
  parseGlazingKey,
} from "@/shared/glazing-packages";
import { buildScene, buildSectionScene, glazingThicknessMm, paneCount } from "@/lib/drawing";
import { defaultItem } from "@/shared/item-defaults";
import type { CatalogPayload } from "@/shared/pricing";

describe("glazing packages", () => {
  const rows = glazingPackageRows();

  it("has the depths of the specification", () => {
    expect(PACKAGE_DEPTHS.double).toEqual([24, 26, 28]);
    expect(PACKAGE_DEPTHS.triple).toEqual([32, 36, 40, 44, 50, 52]);
  });

  it("one row per depth × composition, with unique short keys that parse back", () => {
    const doubles = COMPOSITIONS.filter((c) => c.family === "double").length;
    const triples = COMPOSITIONS.filter((c) => c.family === "triple").length;
    expect(doubles).toBe(7);
    expect(triples).toBe(5);
    expect(rows).toHaveLength(3 * doubles + 6 * triples);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.key.length).toBeLessThanOrEqual(40);
      const p = parseGlazingKey(r.key)!;
      expect(p).not.toBeNull();
      expect(packageKey(p.family, p.depthMm, p.composition.id)).toBe(r.key);
    }
  });

  it("labels exist in six languages and carry the depth", () => {
    for (const r of rows) {
      for (const l of ["it", "en", "fr", "de", "nl", "ro"]) {
        expect(r.labels[l]).toBeTruthy();
        expect(r.labels[l]).toMatch(/ · \d{2} mm$/);
      }
    }
  });

  it("deeper units insulate a little better and cost more; triple costs more than double", () => {
    const c = COMPOSITIONS.find((x) => x.id === "floatFloat331Be")!;
    expect(packageUg(c, 52)).toBeLessThan(packageUg(c, 32));
    const price = (key: string) => rows.find((r) => r.key === key)!.priceCents;
    expect(price("d28_floatBeArgon")).toBeGreaterThan(price("d24_floatBeArgon"));
    expect(price("t32_floatFloat331Be")).toBeGreaterThan(price("d24_floatBeArgon"));
  });

  it("rejects keys that are not packages", () => {
    for (const k of ["double", "triple", "d30_floatBe", "d24_nope", "t24_floatBe", "", undefined]) expect(parseGlazingKey(k as string)).toBeNull();
  });

  it("reads legacy keys as 24 mm double / 36 mm triple", () => {
    expect(glazingShape("double")).toMatchObject({ family: "double", depthMm: 24 });
    expect(glazingShape("tripleLowE")).toMatchObject({ family: "triple", depthMm: 36 });
    expect(glazingShape("t50_floatFloat331Be")).toMatchObject({ family: "triple", depthMm: 50 });
  });

  it("gives the technical advice without ever blocking", () => {
    expect(glazingAdvice("d24_float331Be", 1400, "finestra1")).toEqual(["upTo1700"]);
    expect(glazingAdvice("d24_float331Be", 1900, "finestra1")).toEqual(["tooTall"]);
    expect(glazingAdvice("d24_float331Be", 1400, "porta1")).toEqual(["tooTall"]);
    expect(glazingAdvice("d24_lam331x2Be", 2000, "finestra1")).toEqual(["doorsOrTall"]);
    expect(glazingAdvice("d24_lam331x2Be", 2800, "porta1")).toEqual(["doorsOrTall", "tallBeyond"]);
    expect(glazingAdvice("d24_ornamentalPanel", 2100, "finestra1")).toEqual(["entryDoors"]);
    expect(glazingAdvice("d24_ornamentalPanel", 2100, "porta1")).toEqual([]);
    expect(glazingAdvice("double", 2000)).toEqual([]);
  });
});

describe("glazing in the drawings", () => {
  it("the section takes thickness and panes from the package", () => {
    expect(glazingThicknessMm("d28_floatBeArgon")).toBe(28);
    expect(glazingThicknessMm("t52_floatFloat331Be")).toBe(52);
    expect(paneCount("t40_be331FloatBe331")).toBe(3);
    expect(paneCount("d26_floatBe")).toBe(2);
    const text = (s: ReturnType<typeof buildSectionScene>) => s.primitives.flatMap((p) => (p.type === "text" ? [p.text] : []));
    expect(text(buildSectionScene({ material: "pvc", glazing: "t52_floatFloat331Be" }))).toContain("52 mm");
    expect(text(buildSectionScene({ material: "pvc", glazing: "d28_floatBeArgon" }))).toContain("28 mm");
  });

  it("section: laminated panes show their film, low-E its coating, a panel replaces the glass", () => {
    const part = (s: ReturnType<typeof buildSectionScene>, p: string) => s.primitives.filter((x) => x.part === p).length;
    const lam = buildSectionScene({ material: "pvc", glazing: "d24_lam331x2Be" });
    expect(part(lam, "film")).toBe(2);
    expect(part(lam, "lowE")).toBe(1);
    const triple = buildSectionScene({ material: "pvc", glazing: "t36_be331FloatBe331" });
    expect(part(triple, "lowE")).toBe(2);
    const panel = buildSectionScene({ material: "pvc", glazing: "d24_ornamentalPanel" });
    expect(part(panel, "pane")).toBe(3);
    expect(part(panel, "moulding")).toBeGreaterThan(0);
    expect(panel.primitives.some((p) => p.role === "glass" && p.part === "pane")).toBe(false);
  });

  it("elevation: panel packages draw panels instead of glass, satin glass draws frosted", () => {
    const base = { widthMm: 1000, heightMm: 2100, sashes: [{ type: "classic" as const, direction: "left" as const, active: true }] };
    const glass = buildScene({ ...base, glazing: "d24_floatBeArgon" });
    expect(glass.primitives.some((p) => p.role === "glass")).toBe(true);
    const panel = buildScene({ ...base, glazing: "d24_ornamentalPanel" });
    expect(panel.primitives.some((p) => p.role === "glass")).toBe(false);
    expect(panel.primitives.some((p) => p.role === "panel")).toBe(true);
    expect(panel.primitives.some((p) => p.role === "opening")).toBe(true);
    const satin = buildScene({ ...base, glazing: "d24_satin331Be" });
    expect(satin.primitives.some((p) => p.part === "satin")).toBe(true);
    expect(glass.primitives.some((p) => p.part === "satin")).toBe(false);
  });
});

describe("defaults", () => {
  const payload = (keys: string[]) =>
    ({ materials: [{ key: "pvc", enabled: true, sortOrder: 0 }], qualityTiers: [], profileSystems: [], glazing: keys.map((key, i) => ({ key, enabled: true, sortOrder: i })), finish: [], hardware: [], frameTypes: [] }) as unknown as CatalogPayload;

  it("new pieces start on the 24 mm package (laminated for doors) and fall back to the legacy key", () => {
    const p = payload(["double", "d24_floatBeArgon", "d24_lam331x2Be"]);
    expect(defaultItem(p, "finestra1").glazing).toBe("d24_floatBeArgon");
    expect(defaultItem(p, "porta1").glazing).toBe("d24_lam331x2Be");
    expect(defaultItem(payload(["double", "triple"]), "finestra1").glazing).toBe("double");
  });
});
