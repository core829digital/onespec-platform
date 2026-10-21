import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateVAT } from "../../convex/lib/regions";
import { complianceForRegion } from "../../convex/lib/compliance";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("regions: calculateVAT - IT with Beni Significativi split", () => {
  const result = calculateVAT({
    regionCode: "IT",
    subtotalExVatCents: 10000,
    itSplit: { manoperaCents: 3000, beniCents: 5000, altriCents: 2000 },
  });

  expect(result.length).toBe(2);
  const vat10 = result.find((r) => r.rate === 0.1);
  const vat22 = result.find((r) => r.rate === 0.22);
  expect(vat10).toBeDefined();
  expect(vat22).toBeDefined();
  // manopera 3000 + altri 2000 = 5000 limit for beni at 10%
  // beni 5000 -> 5000 at 10%, 0 at 22%
  expect(vat10!.baseCents).toBe(3000 + 2000 + 5000); // 10000
  expect(vat10!.vatCents).toBe(1000);
  expect(vat22!.baseCents).toBe(0);
  expect(vat22!.vatCents).toBe(0);
});

test("regions: calculateVAT - IT with beni exceeding manopera+altri", () => {
  const result = calculateVAT({
    regionCode: "IT",
    subtotalExVatCents: 20000,
    itSplit: { manoperaCents: 3000, beniCents: 15000, altriCents: 2000 },
  });

  const vat10 = result.find((r) => r.rate === 0.1);
  const vat22 = result.find((r) => r.rate === 0.22);
  expect(vat10).toBeDefined();
  expect(vat22).toBeDefined();
  // limit = 3000 + 2000 = 5000
  // beni10 = 5000, beni22 = 10000
  expect(vat10!.baseCents).toBe(10000);
  expect(vat10!.vatCents).toBe(1000);
  expect(vat22!.baseCents).toBe(10000);
  expect(vat22!.vatCents).toBe(2200);
});

test("regions: calculateVAT - FR renovation", () => {
  const result = calculateVAT({
    regionCode: "FR",
    subtotalExVatCents: 10000,
    isEnergyRenovation: false,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.1);
  expect(result[0].label).toBe("TVA 10% (rénovation)");
  expect(result[0].vatCents).toBe(1000);
});

test("regions: calculateVAT - FR energy renovation", () => {
  const result = calculateVAT({
    regionCode: "FR",
    subtotalExVatCents: 10000,
    isEnergyRenovation: true,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.055);
  expect(result[0].label).toBe("TVA 5,5% (rénovation énergétique)");
  expect(result[0].vatCents).toBe(550);
});

test("regions: calculateVAT - FR new build", () => {
  const result = calculateVAT({
    regionCode: "FR",
    subtotalExVatCents: 10000,
    // neuf would need explicit key, but default is renovation
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.1);
});

test("regions: calculateVAT - BE building > 10 years", () => {
  const result = calculateVAT({
    regionCode: "BE",
    subtotalExVatCents: 10000,
    buildingAge: 15,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.06);
  expect(result[0].label).toBe("TVA 6% (logement > 10 ans)");
  expect(result[0].vatCents).toBe(600);
});

test("regions: calculateVAT - BE building <= 10 years", () => {
  const result = calculateVAT({
    regionCode: "BE",
    subtotalExVatCents: 10000,
    buildingAge: 5,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.21);
  expect(result[0].label).toBe("TVA 21%");
  expect(result[0].vatCents).toBe(2100);
});

test("regions: calculateVAT - LU super-reduit", () => {
  const result = calculateVAT({
    regionCode: "LU",
    subtotalExVatCents: 10000,
    isEnergyRenovation: true,
    buildingAge: 15,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.03);
  expect(result[0].label).toBe("TVA 3% (super-réduit, sur accord)");
  expect(result[0].vatCents).toBe(300);
});

test("regions: calculateVAT - LU standard", () => {
  const result = calculateVAT({
    regionCode: "LU",
    subtotalExVatCents: 10000,
    isEnergyRenovation: false,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.17);
  expect(result[0].label).toBe("TVA 17%");
  expect(result[0].vatCents).toBe(1700);
});

test("regions: calculateVAT - NL single rate", () => {
  const result = calculateVAT({
    regionCode: "NL",
    subtotalExVatCents: 10000,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.21);
  expect(result[0].vatCents).toBe(2100);
});

test("regions: calculateVAT - DE single rate", () => {
  const result = calculateVAT({
    regionCode: "DE",
    subtotalExVatCents: 10000,
  });
  expect(result.length).toBe(1);
  expect(result[0].rate).toBe(0.19);
  expect(result[0].vatCents).toBe(1900);
});

test("compliance: funding declaration titles for all 6 markets", () => {
  expect(complianceForRegion("IT").funding.title).toBe("Scheda ENEA / Allegato F");
  expect(complianceForRegion("FR").funding.title).toBe("Attestation de travaux — MaPrimeRénov'");
  expect(complianceForRegion("BE").funding.title).toBe("Attestation — Prime Rénovation / Renolution");
  expect(complianceForRegion("NL").funding.title).toBe("Onderbouwing — ISDE-subsidie");
  expect(complianceForRegion("DE").funding.title).toBe("Fachunternehmererklärung (BEG)");
  expect(complianceForRegion("LU").funding.title).toBe("Attestation Klimabonus / Klimabonus-Bescheinigung");
});

test("compliance: funding declaration programmes for all 6 markets", () => {
  expect(complianceForRegion("IT").funding.programme).toBe("Ecobonus — detrazione sostituzione infissi");
  expect(complianceForRegion("FR").funding.programme).toBe("MaPrimeRénov' / CEE — remplacement de menuiseries");
  expect(complianceForRegion("BE").funding.programme).toBe("Prime Rénovation (Wallonie) / Renolution (Bruxelles)");
  expect(complianceForRegion("NL").funding.programme).toBe("ISDE (Investeringssubsidie Duurzame Energie) — isolatieglas");
  expect(complianceForRegion("DE").funding.programme).toBe("BEG EM / KfW / BAFA — Erneuerung der Fenster");
  expect(complianceForRegion("LU").funding.programme).toBe("Klimabonus — Fënsteren / remplacement de fenêtres");
});

test("compliance: funding hasXml only for IT", () => {
  expect(complianceForRegion("IT").funding.hasPortalXml).toBe(true);
  expect(complianceForRegion("FR").funding.hasPortalXml).toBe(false);
  expect(complianceForRegion("BE").funding.hasPortalXml).toBe(false);
  expect(complianceForRegion("NL").funding.hasPortalXml).toBe(false);
  expect(complianceForRegion("DE").funding.hasPortalXml).toBe(false);
  expect(complianceForRegion("LU").funding.hasPortalXml).toBe(false);
});

test("compliance: funding preamble for all markets", () => {
  for (const code of ["IT", "FR", "BE", "NL", "DE", "LU"] as const) {
    const funding = complianceForRegion(code).funding;
    expect(funding.preamble).toBeDefined();
    expect(Array.isArray(funding.preamble)).toBe(true);
    expect(funding.preamble.length).toBeGreaterThan(0);
  }
});