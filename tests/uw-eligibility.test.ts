import { describe, expect, test } from "vitest";
import { checkUwEligibility } from "../convex/lib/calcPreview";
import { UW_LIMIT_BY_ZONE } from "../convex/lib/enea";
import { resolveVisitorVat } from "../convex/lib/fiscal";

/** Issue #43: the IT badge and the ENEA document must not disagree (it used 1.4 vs 1.3). */
describe("Uw eligibility", () => {
  test("Italy uses the zone-E limit of the ENEA document", () => {
    expect(checkUwEligibility("IT", UW_LIMIT_BY_ZONE.E)).toBe(true);
    expect(checkUwEligibility("IT", 1.35)).toBe(false);
  });
});

describe("resolveVisitorVat", () => {
  test("a valid visitor pick wins, anything else falls back to the configurator's rate", () => {
    expect(resolveVisitorVat(10, 22)).toBe(10);
    expect(resolveVisitorVat(0, 22)).toBe(0);
    expect(resolveVisitorVat(undefined, 22)).toBe(22);
    expect(resolveVisitorVat(-1, 22)).toBe(22);
    expect(resolveVisitorVat(101, 22)).toBe(22);
    expect(resolveVisitorVat(Number.NaN, 22)).toBe(22);
  });
});
