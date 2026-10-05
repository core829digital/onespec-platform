// @vitest-environment node
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test, vi } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import { PiecesEditor } from "../src/components/quotes/editor/pieces-editor";
import { catalogChoices } from "../src/components/quotes/editor/catalog-labels";
import { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } from "../src/shared/configurator-model";
import { defaultItem } from "../src/shared/item-defaults";
import { blockingIssues, pieceIssues } from "../src/shared/piece-ops";
import { glazingPackageRows } from "../src/shared/glazing-packages";
import { STANDARD_PROFILES, standardProfileLabels } from "../src/shared/standard-pricing";
import type { CatalogPayload, ProjectItem } from "../src/shared/pricing";

vi.mock("@/components/quotes/sash-panel", () => ({ SashPanel: () => null }));

// A catalogue as it exists today in production: the 12 standard profiles, quality tiers 5 and 7 only (no 6-chamber tier, no qualityKey).
const payload = {
  configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR", pricingMode: "standard", marginPercent: 0 },
  branding: null,
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true }],
  qualityTiers: [
    { materialKey: "pvc", key: "chamber5", labels: { it: "5 camere" }, multiplier: 1, uAdjust: 0, sortOrder: 0, enabled: true },
    { materialKey: "pvc", key: "chamber7", labels: { it: "7 camere" }, multiplier: 1.15, uAdjust: -0.15, sortOrder: 1, enabled: true },
  ],
  profileSystems: STANDARD_PROFILES.map((sp, i) => ({
    materialKey: "pvc", key: sp.key, labels: standardProfileLabels(sp), multiplier: 1, group: sp.klass, standardKey: sp.key, sortOrder: i, enabled: true,
    standard: { completePerM2Cents: 30000, framePerM2Cents: 18000, glassPerM2Cents: 9000, barPerMlCents: 1200 },
  })),
  sizeConstraints: [],
  glazing: glazingPackageRows().map((r, i) => ({ key: r.key, labels: r.labels, priceCents: 0, uGlass: 1.0, sortOrder: i, enabled: true })),
  finish: [{ key: "white", labels: { it: "Bianco" }, swatchHex: "#fff", priceCents: 0, sortOrder: 0, enabled: true }],
  hardware: [
    { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
    { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
    { kind: "sashType", key: "classic", labels: { it: "Battente" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
    { kind: "hardware", key: "standard", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    { kind: "hardwareColor", key: "silver", labels: { it: "Argento" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  ],
  frameTypes: DEFAULT_FRAME_TYPES,
  accessories: DEFAULT_ACCESSORIES,
  productBase: [],
} as unknown as CatalogPayload;

const chambersOf = (key: string) => STANDARD_PROFILES.find((p) => p.key === key)!.chambers;

describe("choices follow the selection from the top down", () => {
  test("the qualities list gains the 6-chamber tier even in an old catalogue, in numeric order", () => {
    const c = catalogChoices(payload, "pvc", "it");
    expect(c.qualities.map((q) => q.key)).toEqual(["chamber5", "chamber6", "chamber7"]);
  });

  test.each([5, 6, 7])("with %i chambers only profiles with %i chambers are offered", (n) => {
    const c = catalogChoices(payload, "pvc", "it", { quality: `chamber${n}` });
    expect(c.profiles.length).toBeGreaterThan(0);
    expect(c.profiles.every((p) => chambersOf(p.key) === n)).toBe(true);
    expect(c.profiles.length).toBe(STANDARD_PROFILES.filter((p) => p.chambers === n).length);
  });

  test("glazing is limited by the profile's depth", () => {
    const thin = catalogChoices(payload, "pvc", "it", { quality: "chamber5", profile: "std_aluplast_ideal_4000" });
    const deep = catalogChoices(payload, "pvc", "it", { quality: "chamber6", profile: "std_veka_softline_82" });
    expect(thin.glazing.some((g) => g.key.startsWith("t52_"))).toBe(false);
    expect(thin.glazing.some((g) => g.key.startsWith("t40_"))).toBe(true);
    expect(deep.glazing.some((g) => g.key.startsWith("t52_"))).toBe(true);
    expect(thin.glazing.length).toBeLessThan(thin.glazingTotal);
  });
});

describe("a new piece is coherent from the start", () => {
  test("default profile belongs to the first quality, glazing fits it, no issue is raised", () => {
    const item = defaultItem(payload, "finestra1");
    expect(item.quality.pvc).toBe("chamber5");
    expect(chambersOf(item.profileSystem!)).toBe(5);
    expect(pieceIssues(item, payload)).toEqual([]);
  });
});

describe("the editor blocks and explains incoherent pieces", () => {
  const base = (): ProjectItem => defaultItem(payload, "finestra1");

  test("a 6-chamber profile under 5 chambers is a blocking issue", () => {
    const item = { ...base(), profileSystem: "std_veka_softline_82" };
    const issues = pieceIssues(item, payload);
    expect(issues).toContainEqual({ code: "profileQuality", profile: "std_veka_softline_82", quality: "chamber5" });
    expect(blockingIssues(issues).length).toBeGreaterThan(0);
  });

  test("a glazing unit too thick is a blocking issue", () => {
    const item = { ...base(), glazing: "t52_floatFloat331Be" };
    expect(blockingIssues(pieceIssues(item, payload)).some((i) => i.code === "glazingDepth")).toBe(true);
  });

  test("the 6-chamber quality of an old catalogue is not reported as unknown", () => {
    const item = { ...base(), quality: { pvc: "chamber6" }, profileSystem: "std_veka_softline_82", glazing: "d24_floatBeArgon" };
    expect(pieceIssues(item, payload)).toEqual([]);
  });
});

function render(items: ProjectItem[], locale: "it" | "en" = "it") {
  return renderToString(
    h(NextIntlClientProvider, {
      locale,
      messages: locale === "it" ? it : en,
      onError: () => undefined,
      children: h(PiecesEditor, { payload, locale, items, onChange: () => undefined, activeIndex: 0, onActiveChange: () => undefined }),
    } as unknown as Parameters<typeof NextIntlClientProvider>[0]),
  ).replace(/<!-- -->/g, "");
}

describe("the piece form (server render)", () => {
  const profileSelect = (html: string) => /<select id="[^"]*-profile"[\s\S]*?<\/select>/.exec(html)?.[0] ?? "";

  test("5 chambers: the profile list has no 6- or 7-chamber profile; 6 chambers: only 6-chamber ones", () => {
    const five = profileSelect(render([defaultItem(payload, "finestra1")]));
    expect(five).toContain("Aluplast Ideal 4000");
    expect(five).not.toContain("Veka Softline 82");
    expect(five).not.toContain("Gealan S9000 IQ Plus 83");
    const item6: ProjectItem = { ...defaultItem(payload, "finestra1"), quality: { pvc: "chamber6" }, profileSystem: "std_veka_softline_82" };
    const six = profileSelect(render([item6]));
    expect(six).toContain("Veka Softline 82");
    expect(six).toContain("Schüco Corona CT70");
    expect(six).not.toContain("Aluplast Ideal 4000");
    expect(six).not.toContain("Gealan S9000 IQ Plus 83");
  });

  test("the class groups are named (not raw keys) and the profile details line is shown", () => {
    const html = render([defaultItem(payload, "finestra1")]);
    expect(profileSelect(html)).toContain('label="Economica"');
    expect(html).toContain("5 camere");
    expect(html).toContain("profondità 70 mm");
    expect(html).toContain("guarnizione standard");
    expect(html).toContain("vetro fino a 40 mm");
    expect(render([defaultItem(payload, "finestra1")], "en")).toContain('label="Economy"');
  });

  test("the quality select lists 5, 6 and 7 chambers", () => {
    const html = render([defaultItem(payload, "finestra1")]);
    const quality = /<select id="[^"]*-quality"[\s\S]*?<\/select>/.exec(html)?.[0] ?? "";
    expect([...quality.matchAll(/<option value="(chamber\d)"/g)].map((m) => m[1])).toEqual(["chamber5", "chamber6", "chamber7"]);
  });
});
