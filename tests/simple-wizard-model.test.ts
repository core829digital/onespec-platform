import { describe, expect, test } from "vitest";
import { ProjectItemSchema } from "../src/shared/widget-types";
import {
  buildWizardItem,
  buildWizardNotes,
  submitErrorMessage,
  wizardCopy,
  wizardMarket,
  COLOUR_KEYS,
  PRODUCT_KEYS,
  WIZARD_LANGS,
  WIZARD_REGIONS,
  type WizardSelection,
} from "../src/components/widget/simple-wizard-model";

function flatten(o: unknown, out: string[] = []): string[] {
  if (typeof o === "string") out.push(o);
  else if (o && typeof o === "object") for (const v of Object.values(o)) flatten(v, out);
  return out;
}

const sel = (overrides: Partial<WizardSelection> = {}): WizardSelection => ({
  work: "renovation",
  product: "finestra1",
  widthCm: "120",
  heightCm: "140",
  colour: "white",
  glazing: "double",
  frame: "straight",
  disposal: true,
  installation: true,
  incentive: "",
  postal: "20121",
  ...overrides,
});

describe("simple wizard copy", () => {
  test("every widget language has every string, non-empty, and is really translated", () => {
    const shape = flatten(wizardCopy("it")).length;
    for (const lang of WIZARD_LANGS) {
      const strings = flatten(wizardCopy(lang));
      expect(strings.length).toBe(shape);
      for (const s of strings) expect(s.trim().length).toBeGreaterThan(0);
      if (lang !== "it") expect(wizardCopy(lang).steps).not.toEqual(wizardCopy("it").steps);
    }
  });

  test("unsupported languages fall back to English, like the full widget", () => {
    expect(wizardCopy("ro")).toBe(wizardCopy("en"));
  });

  test("raw server error codes are never shown to the visitor", () => {
    const c = wizardCopy("fr");
    expect(submitErrorMessage(c, "RATE_LIMITED")).toBe(c.errors.RATE_LIMITED);
    expect(submitErrorMessage(c, "SPAM")).toBe(c.errors.GENERIC);
    expect(submitErrorMessage(c, undefined)).toBe(c.errors.GENERIC);
  });
});

describe("simple wizard markets", () => {
  test("each market offers only its own incentives, plus advice", () => {
    for (const region of WIZARD_REGIONS) {
      const m = wizardMarket(region);
      expect(m.incentives).toContain("advice");
      for (const k of m.incentives) {
        if (k !== "advice") expect(k.startsWith(region.toLowerCase() + "_")).toBe(true);
      }
    }
  });

  test("Italian-only content never reaches a foreign market", () => {
    for (const region of WIZARD_REGIONS.filter((r) => r !== "IT")) {
      const m = wizardMarket(region);
      expect(m.installationNorm).not.toBe("UNI 11673");
      expect(m.incentives.some((k) => k.startsWith("it_"))).toBe(false);
    }
  });

  test("unknown region falls back to the platform default (IT)", () => {
    expect(wizardMarket(undefined)).toBe(wizardMarket("IT"));
  });

  test("lead notes are written in the installer's market language", () => {
    expect(buildWizardNotes(sel(), wizardMarket("DE"))).toContain("Austausch / Sanierung");
    expect(buildWizardNotes(sel(), wizardMarket("BE"))).toContain("Remplacement / Rénovation");
    expect(buildWizardNotes(sel({ incentive: "nl_isde" }), wizardMarket("NL"))).toContain("ISDE-subsidie");
  });
});

describe("simple wizard item", () => {
  test("every product × colour × market validates against the server schema", () => {
    for (const region of WIZARD_REGIONS) {
      for (const product of PRODUCT_KEYS) {
        for (const colour of COLOUR_KEYS) {
          const s = sel({ product, colour });
          const item = buildWizardItem(s, buildWizardNotes(s, wizardMarket(region)));
          const r = ProjectItemSchema.safeParse(item);
          expect(r.success, `${region}/${product}/${colour}`).toBe(true);
        }
      }
    }
  });

  test("a 2-leaf 180 cm window keeps its real width (no silent squeeze to 120 cm)", () => {
    const item = buildWizardItem(sel({ product: "finestra2", widthCm: "180" }), "");
    expect(item.width).toBe(1800);
    expect(item.sashes).toHaveLength(2);
    expect(ProjectItemSchema.safeParse(item).success).toBe(true);
  });

  test("a 300 cm sliding door validates", () => {
    const item = buildWizardItem(sel({ product: "scorrevole", widthCm: "300", heightCm: "230" }), "");
    expect(item.width).toBe(3000);
    expect(ProjectItemSchema.safeParse(item).success).toBe(true);
  });

  test("single-sash items stay within the structural limit", () => {
    const item = buildWizardItem(sel({ product: "finestra1", widthCm: "400", heightCm: "400" }), "");
    expect(item.width).toBe(1200);
    expect(item.height).toBe(2800);
    expect(ProjectItemSchema.safeParse(item).success).toBe(true);
  });
});
