import { describe, expect, test } from "vitest";
import { glazingPackageRows } from "../src/shared/glazing-packages";
import { STANDARD_PROFILES, standardProfileLabels } from "../src/shared/standard-pricing";
import { dictFor } from "../src/lib/quote-export/dictionary";
import { pieceSpecs } from "../src/lib/quote-export/specs";
import { buildExportModel } from "../src/lib/quote-export/model";
import { buildHtml, buildTxt } from "../src/lib/quote-export/generators";
import { defaultItem } from "../src/shared/item-defaults";
import { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } from "../src/shared/configurator-model";
import type { CatalogPayload, ProjectItem } from "../src/shared/pricing";

const payload = {
  configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR", pricingMode: "standard" },
  branding: null,
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 0, enabled: true }],
  // Snapshot of today: tiers 5 and 7 only.
  qualityTiers: [
    { materialKey: "pvc", key: "chamber5", labels: { it: "5 camere" }, multiplier: 1, sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "chamber7", labels: { it: "7 camere" }, multiplier: 1.15, sortOrder: 1, enabled: true },
  ],
  profileSystems: STANDARD_PROFILES.map((sp, i) => ({ materialKey: "pvc", key: sp.key, labels: standardProfileLabels(sp), multiplier: 1, standardKey: sp.key, sortOrder: i, enabled: true, standard: { completePerM2Cents: 30000, framePerM2Cents: 18000, glassPerM2Cents: 9000, barPerMlCents: 1200 } })),
  sizeConstraints: [],
  glazing: glazingPackageRows().map((r, i) => ({ key: r.key, labels: r.labels, priceCents: 0, uGlass: 0.7, sortOrder: i, enabled: true })),
  finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "classic", labels: { it: "B" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "hardware", key: "standard", labels: { it: "S" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardwareColor", key: "silver", labels: { it: "A" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  ],
  frameTypes: DEFAULT_FRAME_TYPES,
  accessories: DEFAULT_ACCESSORIES,
} as unknown as CatalogPayload;

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  ...defaultItem(payload, "finestra1"), quality: { pvc: "chamber6" }, profileSystem: "std_salamander_bluevolution_82", glazing: "t44_floatFloat331Be", ...over,
});

describe("technical lines of a piece in every document language", () => {
  test.each(["it", "en", "fr", "de", "nl", "ro"])("%s: quality, profile details and glazing unit are filled", (locale) => {
    const d = dictFor(locale);
    const s = pieceSpecs(payload, item(), locale, d);
    expect(s.quality).toMatch(/6/);
    expect(s.profileSpec).toContain(`6 ${d.chambers}`);
    expect(s.profileSpec).toContain(`${d.depth} 82 mm`);
    expect(s.profileSpec).toContain(d.gasketTriple);
    expect(s.glassUnit).toBe(`${d.glassTriple} · 44 mm`);
  });

  test("standard gasket and double unit are described as such; a legacy glazing key has no unit line", () => {
    const d = dictFor("it");
    const s = pieceSpecs(payload, item({ quality: { pvc: "chamber5" }, profileSystem: "std_aluplast_ideal_4000", glazing: "d24_floatBeArgon" }), "it", d);
    expect(s.profileSpec).toContain("guarnizione standard");
    expect(s.glassUnit).toBe("Doppio vetro · 24 mm");
    expect(pieceSpecs(payload, item({ glazing: "double" }), "it", d).glassUnit).toBe("");
  });

  test("no catalogue (an old quote): the quality still reads from its key", () => {
    expect(pieceSpecs(undefined, item(), "it", dictFor("it")).quality).toBe("6 camere");
  });

  test("the text and HTML offers carry the lines", () => {
    const m = buildExportModel({
      locale: "it", offerNumber: "Q-1", dateMs: Date.UTC(2026, 8, 21), company: { name: "Acme" }, client: { name: "Mario" }, items: [item()], payload,
      money: { supplyExVatCents: 1, installCents: 0, demolitionCents: 0, regionalCents: 0, discountPercent: 0, vatPercent: 22, grossCents: 1 },
    });
    const txt = buildTxt(m);
    expect(txt).toContain("Qualità: 6 camere");
    expect(txt).toContain("guarnizione tripla");
    expect(txt).toContain("Pacchetto vetro: Triplo vetro · 44 mm");
    const html = buildHtml(m);
    expect(html).toContain("6 camere · profondità 82 mm");
    expect(html).toContain("Triplo vetro · 44 mm");
  });
});
