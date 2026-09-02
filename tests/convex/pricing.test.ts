import { describe, expect, test } from "vitest";
import { calculatePrice, type CatalogPayload } from "../../src/shared/pricing";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import { sampleItem } from "./_helpers";

const catalog: CatalogPayload = {
  configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
  branding: null,
  materials: [
    { key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 0, enabled: true },
  ],
  qualityTiers: [
    { materialKey: "pvc", key: "chamber5", labels: { it: "5" }, multiplier: 1, sortOrder: 0, enabled: true },
  ],
  profileSystems: [
    { materialKey: "pvc", key: "standard", labels: { it: "Standard" }, multiplier: 1, sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "premium", labels: { it: "Premium" }, multiplier: 1.5, sortOrder: 1, enabled: true },
  ],
  sizeConstraints: [],
  glazing: [{ key: "double", labels: { it: "Doppio" }, priceCents: 0, sortOrder: 0, enabled: true }],
  finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "hardware", key: "maco", labels: { it: "Maco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardwareColor", key: "white", labels: { it: "Bianco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "screen", key: "molla", labels: { it: "Molla" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "screenColor", key: "brown", labels: { it: "Marrone" }, priceCents: 1000, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "installation", key: "posaClima", labels: { it: "Posa clima" }, priceCents: 15000, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
  ],
} as unknown as CatalogPayload;

describe("calculatePrice (server-authoritative)", () => {
  test("deterministic total for a known 1200x1400 pvc window", () => {
    // area 1.68 m2 * 18000 = 30240 ; profile 5.2 m * 2800 = 14560 ; sash tiltturn 6500
    // unit = 51300 ; +22% VAT rounding step 1
    const r = calculatePrice(catalog, [ProjectItemSchema.parse(sampleItem)]);
    expect(r.priceCents).toBe(51300);
    expect(r.priceExVatCents).toBe(Math.round(51300 / 1.22));
    expect(r.vatRatePercent).toBe(22);
    expect(r.totalPrice).toBe(r.priceCents);
  });

  test("profile system multiplier scales only the material cost", () => {
    // base material cost = 1.68 * 18000 = 30240 ; * 1.5 = 45360 (+15120)
    const std = calculatePrice(catalog, [ProjectItemSchema.parse(sampleItem)]);
    const premium = calculatePrice(catalog, [
      ProjectItemSchema.parse({ ...sampleItem, profileSystem: "premium" }),
    ]);
    expect(premium.priceCents).toBe(std.priceCents + 15120);
  });

  test("screen type + colour + installation add to the options cost", () => {
    const base = calculatePrice(catalog, [ProjectItemSchema.parse(sampleItem)]);
    const withOpts = calculatePrice(catalog, [
      ProjectItemSchema.parse({
        ...sampleItem,
        insectScreen: true,
        insectScreenType: "molla",
        insectScreenColor: "brown",
        installation: "posaClima",
      }),
    ]);
    // 6500 (molla) + 1000 (brown) + 15000 (posaClima) = 22500
    expect(withOpts.priceCents).toBe(base.priceCents + 22500);
  });

  test("quantity multiplies the unit price", () => {
    const one = calculatePrice(catalog, [ProjectItemSchema.parse(sampleItem)]);
    const three = calculatePrice(catalog, [ProjectItemSchema.parse({ ...sampleItem, quantity: 3 })]);
    expect(three.priceCents).toBe(one.priceCents * 3);
  });

  test("an unknown material yields a zeroed item, never a crash", () => {
    const r = calculatePrice(catalog, [
      ProjectItemSchema.parse({ ...sampleItem, material: "adamantium", quality: { adamantium: "x" } }),
    ]);
    expect(r.priceCents).toBe(0);
  });
});

describe("ProjectItemSchema validation boundaries", () => {
  test("single-sash over 1200x2800 is a validation ERROR (no silent clamp)", () => {
    const bad = ProjectItemSchema.safeParse({
      ...sampleItem,
      sashes: [sampleItem.sashes[0]],
      width: 1500,
      height: 3000,
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const paths = bad.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("width");
      expect(paths).toContain("height");
    }
  });

  test("two-sash 1500mm wide is allowed", () => {
    const ok = ProjectItemSchema.safeParse({ ...sampleItem, width: 1500 });
    expect(ok.success).toBe(true);
  });

  test("absolute ceiling 6000mm is enforced", () => {
    expect(ProjectItemSchema.safeParse({ ...sampleItem, width: 6001 }).success).toBe(false);
  });

  test("quantity is capped at 50", () => {
    expect(ProjectItemSchema.safeParse({ ...sampleItem, quantity: 51 }).success).toBe(false);
  });
});
