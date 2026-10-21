// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { ProjectItemSchema } from "@/shared/widget-types";
import { assemblyGroups, assemblyIssues, assemblyJoins, assemblyLayout } from "@/shared/composition";
import { MAX_TRANSOMS, normalizeTransoms, suggestTransom, transomZonesMm } from "@/shared/transoms";
import { addTransom, duplicateItem, removeTransom, setHeight, setTransomHeight } from "@/shared/piece-ops";
import { buildScene } from "@/lib/drawing/build-scene";
import { buildAssemblyScene } from "@/lib/drawing/build-assembly";
import { parseQuoteItems } from "../convex/lib/quoteItems";

const row = <T extends object>(r: T) => ({ sortOrder: 0, enabled: true, labels: { it: "x" }, ...r });
const payload = (): CatalogPayload =>
  ({
    configurator: { publicId: "p", name: "t", defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR" },
    branding: null,
    // 1 m² = 200 €, profile 50 € per metre.
    materials: [row({ key: "pvc", basePerM2Cents: 20000, profilePerMlCents: 5000 })],
    qualityTiers: [row({ materialKey: "pvc", key: "c5", multiplier: 1 })],
    profileSystems: [],
    sizeConstraints: [],
    glazing: [row({ key: "double", priceCents: 0 })],
    finish: [row({ key: "white", priceCents: 0 })],
    hardware: [row({ kind: "sashType", key: "fix", priceCents: 0, appliesToOperableOnly: false })],
  }) as unknown as CatalogPayload;

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 1000, height: 1000, quantity: 1,
  sashes: [{ type: "fix", direction: "left", active: true, hardware: "", hardwareColor: "" }], glazing: "double", color: "white", insectScreen: false, ...over,
});

describe("transoms (traversi)", () => {
  it("keeps only the bars that fit: inside the piece, far from the frame and from each other, sorted, at most three", () => {
    expect(normalizeTransoms(1400, [700])).toEqual([700]);
    expect(normalizeTransoms(1400, [100, 700, 1390])).toEqual([700]);
    expect(normalizeTransoms(2400, [1500, 600, 1000, 1800])).toEqual([600, 1000, 1500].slice(0, MAX_TRANSOMS));
    expect(normalizeTransoms(1400, [700, 710])).toEqual([700]);
    expect(normalizeTransoms(1400, undefined)).toEqual([]);
    expect(normalizeTransoms(1400, [Number.NaN, 700.4])).toEqual([700]);
  });

  it("suggests the middle of the tallest field, and nothing when no bar fits", () => {
    expect(suggestTransom(1400, [])).toBe(700);
    expect(suggestTransom(2400, [600])).toBe(1500);
    expect(suggestTransom(500, [])).toBeNull();
    expect(suggestTransom(3000, [500, 1000, 2000])).toBeNull();
  });

  it("fields between the bars add up to the height", () => {
    const zones = transomZonesMm(1400, [700]);
    expect(zones).toHaveLength(2);
    expect(zones[0] + zones[1] + 60).toBe(1400);
  });

  it("the price adds the bar's profile (full width x profile price), nothing for a piece without bars", () => {
    const base = calculatePrice(payload(), [item()]).priceExVatCents;
    const withBar = calculatePrice(payload(), [item({ transoms: [500] })]).priceExVatCents;
    expect(withBar - base).toBe(5000); // 1 m of profile
    // A bar that does not fit is never charged.
    expect(calculatePrice(payload(), [item({ transoms: [20] })]).priceExVatCents).toBe(base);
  });

  it("editing: add, move, remove; a lower piece drops the bars that no longer fit", () => {
    let it = item({ height: 1400 });
    it = addTransom(it);
    expect(it.transoms).toEqual([700]);
    it = setTransomHeight(it, 0, 500);
    expect(it.transoms).toEqual([500]);
    expect(setTransomHeight(it, 0, 10).transoms).toEqual([500]); // refused, unchanged
    expect(setHeight(it, 1000).transoms).toEqual([357]);
    expect(setHeight(it, 700).transoms).toBeUndefined();
    expect(removeTransom(it, 0).transoms).toBeUndefined();
  });

  it("the drawing shows one bar per transom, across the opening, and none that do not fit", () => {
    const base = { widthMm: 1000, heightMm: 2400, sashes: [{ type: "fix" as const, direction: "left" as const, active: true }] };
    const bars = (s: ReturnType<typeof buildScene>) => s.primitives.filter((p) => p.role === "frame" && p.part === "transom");
    expect(bars(buildScene({ ...base, transomsMm: [700] }))).toHaveLength(1);
    expect(bars(buildScene({ ...base, transomsMm: [700, 1300] }))).toHaveLength(2);
    expect(bars(buildScene({ ...base, transomsMm: [10] }))).toHaveLength(0);
    expect(bars(buildScene(base))).toHaveLength(0);
  });

  it("the server keeps only valid bars of what a client sends", () => {
    const raw = { ...item({ height: 1400 }), transoms: [700, 5] };
    expect(parseQuoteItems([raw])[0].transoms).toEqual([700]);
    expect(ProjectItemSchema.safeParse({ ...raw, transoms: [1, 2, 3, 4] }).success).toBe(false);
  });
});

const L = [
  item({ width: 1000, height: 1400, composition: { group: 1, col: 0, row: 0 } }),
  item({ width: 800, height: 1400, composition: { group: 1, col: 1, row: 0 } }),
  item({ width: 1000, height: 600, composition: { group: 1, col: 0, row: 1 } }),
];

describe("assemblies (pannelli collegati)", () => {
  it("an L-shaped group that touches and lines up is valid", () => {
    expect(assemblyIssues(L)).toEqual([]);
    const [g] = assemblyGroups(L);
    expect(g.members).toHaveLength(3);
    const layout = assemblyLayout(L, g.members);
    expect(layout.totalWidthMm).toBe(1800);
    expect(layout.totalHeightMm).toBe(2000);
  });

  it("refuses pieces that do not touch, share a cell, or do not line up", () => {
    expect(assemblyIssues([L[0], { ...L[1], composition: { group: 1, col: 3, row: 3 } }]).map((i) => i.code)).toContain("notConnected");
    expect(assemblyIssues([L[0], { ...L[1], composition: L[0].composition }]).map((i) => i.code)).toContain("cellTaken");
    expect(assemblyIssues([L[0], { ...L[1], height: 1300 }]).map((i) => i.code)).toContain("rowHeight");
    expect(assemblyIssues([L[0], { ...L[2], width: 900 }]).map((i) => i.code)).toContain("colWidth");
    expect(assemblyIssues([item({ composition: { group: 9, col: 0, row: 0 } })]).map((i) => i.code)).toContain("outOfGrid");
  });

  it("a lone piece is not an assembly and pieces outside any group are ignored", () => {
    expect(assemblyGroups([item(), L[0]])).toEqual([]);
    expect(assemblyIssues([item(), item()])).toEqual([]);
  });

  it("the upper / left piece of each shared edge pays for the coupling profile", () => {
    const [g] = assemblyGroups(L);
    const joins = assemblyJoins(L, g.members);
    expect(joins).toHaveLength(2);
    expect(joins.find((j) => j.axis === "vertical")).toMatchObject({ payer: 0, other: 1, lengthMm: 1400 });
    expect(joins.find((j) => j.axis === "horizontal")).toMatchObject({ payer: 0, other: 2, lengthMm: 1000 });
    const alone = calculatePrice(payload(), L.map((p) => ({ ...p, composition: undefined }))).priceExVatCents;
    const joined = calculatePrice(payload(), L).priceExVatCents;
    expect(joined - alone).toBe(Math.round(5000 * 2.4)); // 1.4 m + 1.0 m of coupling profile
  });

  it("the assembly is drawn as one shape with the overall size, and a coupling over each shared edge", () => {
    const [g] = assemblyGroups(L);
    const scene = buildAssemblyScene(
      L.map((p) => ({ width: p.width, height: p.height, composition: p.composition, input: { widthMm: p.width, heightMm: p.height, sashes: p.sashes } })),
      g.members,
    );
    const couplings = scene.primitives.filter((p) => p.role === "frame" && p.part === "coupling");
    expect(couplings).toHaveLength(2);
    const labels = scene.primitives.filter((p) => p.type === "text").map((p) => (p.type === "text" ? p.text : ""));
    expect(labels).toContain("1800 mm");
    expect(labels).toContain("2000 mm");
    for (const p of scene.primitives) {
      if (p.type === "rect") {
        expect(p.x).toBeGreaterThanOrEqual(-1);
        expect(p.x + p.w).toBeLessThanOrEqual(scene.viewBox.w + 1);
        expect(p.y + p.h).toBeLessThanOrEqual(scene.viewBox.h + 1);
      }
    }
  });

  it("the server refuses a lot whose joined pieces do not close a shape", async () => {
    const { assertCoherentItems } = await import("../convex/lib/quoteItems");
    const p = payload();
    expect(() => assertCoherentItems(p, L)).not.toThrow();
    expect(() => assertCoherentItems(p, [L[0], { ...L[1], height: 1300 }])).toThrow(/INVALID_ASSEMBLY/);
  });

  it("a duplicated piece does not take over the cell of the original", () => {
    const copy = duplicateItem(L, 0)[1];
    expect(copy.composition).toBeUndefined();
  });
});
