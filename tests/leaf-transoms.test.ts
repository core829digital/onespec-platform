// @vitest-environment node
import { describe, expect, it } from "vitest";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { leafFieldOpenings, leafTransoms } from "@/shared/transoms";
import { addLeafTransom, barsOfLeaf, removeLeafTransom, setHeight, setLeafFieldOpening, setLeafTransomHeight } from "@/shared/piece-ops";
import { buildScene } from "@/lib/drawing/build-scene";
import { parseQuoteItems } from "../convex/lib/quoteItems";

const row = <T extends object>(r: T) => ({ sortOrder: 0, enabled: true, labels: { it: "x" }, ...r });
const payload = (): CatalogPayload =>
  ({
    configurator: { publicId: "p", name: "t", defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1, showPricesToEndUser: true, currency: "EUR" },
    branding: null,
    materials: [row({ key: "pvc", basePerM2Cents: 20000, profilePerMlCents: 5000 })],
    qualityTiers: [row({ materialKey: "pvc", key: "c5", multiplier: 1 })],
    profileSystems: [],
    sizeConstraints: [],
    glazing: [row({ key: "double", priceCents: 0 })],
    finish: [row({ key: "white", priceCents: 0 })],
    hardware: [
      row({ kind: "sashType", key: "fix", priceCents: 0, appliesToOperableOnly: false }),
      row({ kind: "sashType", key: "tilt", priceCents: 1000, appliesToOperableOnly: false }),
      row({ kind: "hardware", key: "std", priceCents: 2000, appliesToOperableOnly: true }),
    ],
  }) as unknown as CatalogPayload;

const leaf = (over: Record<string, unknown> = {}) => ({ type: "classic" as const, direction: "left" as const, active: true, hardware: "std", hardwareColor: "", ...over });
const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window", material: "pvc", quality: { pvc: "c5" }, width: 2000, height: 2400, quantity: 1,
  sashes: [leaf(), leaf({ type: "fix", direction: "right" })], glazing: "double", color: "white", insectScreen: false, ...over,
});

describe("a bar on one leaf", () => {
  it("is added to that leaf only; the other leaf stays whole", () => {
    const it = addLeafTransom(item(), 0);
    expect(barsOfLeaf(it, 0)).toHaveLength(1);
    expect(barsOfLeaf(it, 1)).toHaveLength(0);
    expect(it.sashes[0].fields).toEqual([{ type: "fix", direction: "left" }]); // the field above starts as a fixed fanlight
    expect(it.transoms).toBeUndefined();
  });

  it("the piece's own bars are the default for leaves without a list; an empty list means none", () => {
    expect(leafTransoms(2400, undefined, [1200])).toEqual([1200]);
    expect(leafTransoms(2400, { transoms: [] }, [1200])).toEqual([]);
    expect(leafTransoms(2400, { transoms: [900] }, [1200])).toEqual([900]);
  });

  it("choosing the opening of the field above changes only that field", () => {
    let it = addLeafTransom(item(), 0);
    it = setLeafFieldOpening(it, 0, 0, { type: "tilt", direction: "right" });
    expect(it.sashes[0].fields).toEqual([{ type: "tilt", direction: "right" }]);
    expect(it.sashes[0].type).toBe("classic"); // the lower field keeps the leaf's opening
    expect(setLeafFieldOpening(it, 0, 0, { type: "sliding" as never, direction: "left" })).toBe(it); // sliding is refused
    expect(leafFieldOpenings(2, [{ type: "tilt", direction: "left" }])[1]).toEqual({ type: "fix", direction: "left" });
  });

  it("moving, removing and resizing keep bars and field openings in step", () => {
    let it = setLeafFieldOpening(addLeafTransom(item(), 0), 0, 0, { type: "tilt", direction: "left" });
    const at = barsOfLeaf(it, 0)[0];
    expect(setLeafTransomHeight(it, 0, 0, 5)).toBe(it); // does not fit: unchanged
    expect(barsOfLeaf(setLeafTransomHeight(it, 0, 0, at + 100), 0)).toEqual([at + 100]);
    expect(barsOfLeaf(setHeight(it, 600), 0)).toEqual([]); // too low for a bar now
    expect(removeLeafTransom(it, 0, 0).sashes[0].fields).toBeUndefined();
    it = addLeafTransom(it, 0);
    expect(it.sashes[0].fields).toHaveLength(2);
  });

  it("the server keeps only valid bars and fields per leaf", () => {
    const raw = item({ sashes: [leaf({ transoms: [1200, 5], fields: [{ type: "tilt", direction: "left" }, { type: "classic", direction: "right" }] }), leaf({ type: "fix" })] });
    const [parsed] = parseQuoteItems([raw]);
    expect(parsed.sashes[0].transoms).toEqual([1200]);
    expect(parsed.sashes[0].fields).toEqual([{ type: "tilt", direction: "left" }]);
    expect(parsed.sashes[1].transoms).toBeUndefined();
  });
});

describe("price of a bar on one leaf", () => {
  const price = (it: ProjectItem) => calculatePrice(payload(), [it]).priceExVatCents;
  it("charges the bar for the width of its leaf only (profile 50 €/m, leaf 1 m)", () => {
    const plain = price(item());
    const oneLeaf = price(addLeafTransom(item(), 1)); // fixed leaf: a fixed fanlight, no extra hardware
    expect(oneLeaf - plain).toBe(5000);
    const whole = price(item({ transoms: [1200] })); // bar on both leaves = 2 m
    expect(whole - plain).toBe(10000);
  });
  it("charges an opening fanlight like one more operable leaf", () => {
    const fixedField = price(addLeafTransom(item(), 0));
    const tiltField = price(setLeafFieldOpening(addLeafTransom(item(), 0), 0, 0, { type: "tilt", direction: "left" }));
    expect(tiltField - fixedField).toBe(1000 + 2000); // tilt type + its hardware
  });
});

describe("drawing: opening and glass stop at the bar, per leaf", () => {
  const input = (sashes: object[]) => ({ widthMm: 2000, heightMm: 2400, sashes: sashes as never });
  const count = (s: ReturnType<typeof buildScene>, role: string, i?: number) => s.primitives.filter((p) => p.role === role && (i === undefined || p.sashIndex === i)).length;

  it("a leaf with a bar has two glass fields and a bar only as wide as that leaf", () => {
    const whole = buildScene(input([leaf(), leaf({ type: "fix", direction: "right" })]));
    const withBar = buildScene(input([leaf({ transoms: [1800] }), leaf({ type: "fix", direction: "right" })]));
    expect(count(withBar, "glass", 0)).toBeGreaterThan(count(whole, "glass", 0)); // two panes on leaf 0
    expect(count(withBar, "glass", 1)).toBe(count(whole, "glass", 1)); // leaf 1 untouched
    const bars = withBar.primitives.filter((p) => p.role === "frame" && p.part === "transom");
    expect(bars).toHaveLength(1);
    const cell0 = withBar.meta.cells[0];
    expect((bars[0] as { w: number }).w).toBeCloseTo(cell0.w, 1);
  });

  it("the opening symbol of a tilting fanlight sits above the bar, the casement symbol below it", () => {
    const s = buildScene(input([leaf({ transoms: [1800], fields: [{ type: "tilt", direction: "left" }] })]));
    const bar = s.primitives.find((p) => p.part === "transom") as { y: number; h: number };
    const lines = (part: string) => s.primitives.filter((p) => p.role === "opening" && p.part === part) as unknown as Array<{ y1: number; y2: number }>;
    const casement = lines("casement");
    const tilt = lines("tilt");
    expect(casement.length).toBeGreaterThan(0);
    expect(tilt.length).toBeGreaterThan(0);
    expect(Math.min(...casement.flatMap((l) => [l.y1, l.y2]))).toBeGreaterThanOrEqual(bar.y + bar.h - 0.01); // casement: below the bar
    expect(Math.max(...tilt.flatMap((l) => [l.y1, l.y2]))).toBeLessThanOrEqual(bar.y + 0.01); // tilt: above the bar
  });

  it("a fixed fanlight draws no opening symbol", () => {
    const s = buildScene(input([leaf({ type: "fix", transoms: [1800] })]));
    expect(s.primitives.filter((p) => p.role === "opening")).toHaveLength(0);
  });
});
