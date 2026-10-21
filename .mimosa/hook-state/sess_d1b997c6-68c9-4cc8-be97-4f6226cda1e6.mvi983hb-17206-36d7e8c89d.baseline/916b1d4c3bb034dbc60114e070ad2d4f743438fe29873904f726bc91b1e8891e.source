import { describe, expect, it } from "vitest";
import {
  catalogGaps,
  chamberTierDefaults,
  comboIssues,
  depthFromThickness,
  glazingFitsProfile,
  normalizeCatalog,
  profileQualityKey,
  profileSpec,
  profilesForQuality,
  reconcileItem,
} from "@/shared/catalog-rules";
import { STANDARD_PROFILES } from "@/shared/standard-pricing";
import { glazingPackageRows } from "@/shared/glazing-packages";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";

const profileRows = (): NonNullable<CatalogPayload["profileSystems"]> =>
  STANDARD_PROFILES.map((sp, i) => ({ materialKey: "pvc", key: sp.key, labels: { it: sp.name }, multiplier: 1, standardKey: sp.key, sortOrder: i, enabled: true }));

const glazing = (): CatalogPayload["glazing"] =>
  glazingPackageRows().map((r, i) => ({ key: r.key, labels: r.labels, priceCents: 0, sortOrder: i, enabled: true }));

const tier = (key: string, sortOrder: number) => ({ materialKey: "pvc", key, labels: { it: key }, multiplier: 1, sortOrder, enabled: true });

const payload = (tiers = [tier("chamber5", 0), tier("chamber7", 1)]) => ({
  materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 1, profilePerMlCents: 1, sortOrder: 0, enabled: true }],
  qualityTiers: tiers,
  profileSystems: profileRows(),
  glazing: glazing(),
});

const item = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  productType: "window", material: "pvc", quality: { pvc: "chamber5" }, profileSystem: "std_aluplast_ideal_4000", width: 1200, height: 1400, quantity: 1,
  sashes: [], glazing: "d24_floatBeArgon", color: "white", insectScreen: false, ...over,
});

describe("profile classification", () => {
  it("every standard profile is classified by its number of chambers", () => {
    for (const sp of STANDARD_PROFILES) expect(profileQualityKey({ standardKey: sp.key })).toBe(`chamber${sp.chambers}`);
  });
  it("reads thickness ranges conservatively and knows the gasket", () => {
    expect(depthFromThickness("70-82")).toBe(70);
    expect(depthFromThickness("82-85")).toBe(82);
    expect(profileSpec({ standardKey: "std_salamander_bluevolution_82" }).gasket).toBe("triple");
    expect(profileSpec({ standardKey: "std_aluplast_ideal_4000" }).gasket).toBe("standard");
    expect(profileSpec({ standardKey: "std_aluplast_ideal_4000" }).maxGlassMm).toBe(40);
  });
});

describe("only the profiles of the chosen quality are offered", () => {
  it("5 chambers shows no 6- or 7-chamber profile, and vice versa", () => {
    const rows = profileRows();
    const five = profilesForQuality(rows, "pvc", "chamber5");
    expect(five.length).toBe(STANDARD_PROFILES.filter((p) => p.chambers === 5).length);
    expect(five.every((p) => profileQualityKey(p) === "chamber5")).toBe(true);
    const six = profilesForQuality(rows, "pvc", "chamber6");
    expect(six.every((p) => profileQualityKey(p) === "chamber6")).toBe(true);
    expect(six.map((p) => p.key)).toContain("std_veka_softline_82");
    expect(profilesForQuality(rows, "pvc", "chamber7").map((p) => p.key)).toEqual(["std_gealan_s9000_plus_83"]);
  });
  it("an unclassified (hand-made) profile is offered everywhere unless strict", () => {
    const rows = [...profileRows(), { materialKey: "pvc", key: "mine", labels: {}, multiplier: 1, sortOrder: 99, enabled: true }];
    expect(profilesForQuality(rows, "pvc", "chamber7").map((p) => p.key)).toContain("mine");
    expect(profilesForQuality(rows, "pvc", "chamber7", { strict: true }).map((p) => p.key)).not.toContain("mine");
  });
  it("disabled profiles and other materials never appear", () => {
    const rows = profileRows();
    rows[0].enabled = false;
    rows.push({ materialKey: "aluminum", key: "x", labels: {}, multiplier: 1, sortOrder: 0, enabled: true });
    const five = profilesForQuality(rows, "pvc", "chamber5");
    expect(five.map((p) => p.key)).not.toContain(rows[0].key);
    expect(five.map((p) => p.key)).not.toContain("x");
  });
});

describe("glazing the profile can hold", () => {
  it("a 70 mm profile takes doubles and thin triples only", () => {
    const p = { standardKey: "std_aluplast_ideal_4000" };
    expect(glazingFitsProfile("d28_floatBeArgon", p)).toBe(true);
    expect(glazingFitsProfile("t40_floatFloat331Be", p)).toBe(true);
    expect(glazingFitsProfile("t44_floatFloat331Be", p)).toBe(false);
    expect(glazingFitsProfile("t52_floatFloat331Be", p)).toBe(false);
  });
  it("an 82 mm profile takes the 52 mm triple; a custom profile takes anything", () => {
    expect(glazingFitsProfile("t52_floatFloat331Be", { standardKey: "std_veka_softline_82" })).toBe(true);
    expect(glazingFitsProfile("t52_floatFloat331Be", {})).toBe(true);
  });
});

describe("reconcileItem", () => {
  it("is a no-op for a coherent piece (same object)", () => {
    const p = payload();
    const it_ = item();
    expect(reconcileItem(p, it_)).toBe(it_);
  });
  it("switching to 7 chambers swaps the profile for one of that quality", () => {
    const p = payload();
    const out = reconcileItem(p, item({ quality: { pvc: "chamber7" } }));
    expect(out.profileSystem).toBe("std_gealan_s9000_plus_83");
  });
  it("a glazing unit too thick for the new profile falls back to the deepest that fits, same composition", () => {
    const p = payload();
    const out = reconcileItem(p, item({ glazing: "t52_floatFloat331Be" }));
    expect(out.glazing).toBe("t40_floatFloat331Be");
    expect(out.profileSystem).toBe("std_aluplast_ideal_4000");
  });
  it("an unknown quality becomes the first tier", () => {
    const out = reconcileItem(payload(), item({ quality: { pvc: "ghost" } }));
    expect(out.quality.pvc).toBe("chamber5");
  });
});

describe("comboIssues", () => {
  it("flags a profile of another quality, an unknown profile and a glazing too thick", () => {
    const p = payload();
    expect(comboIssues(p, item())).toEqual([]);
    expect(comboIssues(p, item({ profileSystem: "std_gealan_s9000_plus_83" }))).toEqual([{ code: "profileQuality", profile: "std_gealan_s9000_plus_83", quality: "chamber5" }]);
    expect(comboIssues(p, item({ profileSystem: "ghost" }))).toEqual([{ code: "profileUnknown", key: "ghost" }]);
    expect(comboIssues(p, item({ glazing: "t52_floatFloat331Be" }))[0]).toMatchObject({ code: "glazingDepth", maxMm: 40, depthMm: 52 });
  });
  it("no profile list or no chosen profile = nothing to check", () => {
    expect(comboIssues({ qualityTiers: payload().qualityTiers, profileSystems: [] }, item())).toEqual([]);
    expect(comboIssues(payload(), item({ profileSystem: undefined }))).toEqual([]);
  });
});

describe("normalizeCatalog and catalogGaps", () => {
  it("adds the 6-chamber tier the profiles need, in order, without touching the others", () => {
    const n = normalizeCatalog(payload());
    expect(n.qualityTiers.map((t) => t.key)).toEqual(["chamber5", "chamber6", "chamber7"]);
    const six = n.qualityTiers.find((t) => t.key === "chamber6")!;
    expect(six.labels.it).toBe("6 camere");
    expect((six.labels as Record<string, string>).ro).toBe("6 camere");
    expect({ multiplier: six.multiplier, uAdjust: (six as { uAdjust?: number }).uAdjust }).toEqual(chamberTierDefaults(6));
    expect(n.profileSystems!.every((p) => p.qualityKey?.startsWith("chamber"))).toBe(true);
    expect(normalizeCatalog(n).qualityTiers).toHaveLength(3);
  });
  it("a normalised catalogue has no gaps; a switched-off tier and hand-made profiles are reported", () => {
    expect(catalogGaps(normalizeCatalog(payload()))).toEqual([]);
    const off = normalizeCatalog(payload());
    off.qualityTiers.find((t) => t.key === "chamber6")!.enabled = false;
    expect(catalogGaps(off).filter((g) => g.code === "profileQualityOff").length).toBeGreaterThan(0);
    const mine = normalizeCatalog(payload());
    mine.profileSystems!.push({ materialKey: "pvc", key: "mine", labels: {}, multiplier: 1, sortOrder: 99, enabled: true });
    expect(catalogGaps(mine)).toContainEqual({ code: "profileUnclassified", material: "pvc", profile: "mine" });
    expect(catalogGaps({ ...payload(), qualityTiers: [] })).toContainEqual({ code: "noQuality", material: "pvc" });
  });
});
