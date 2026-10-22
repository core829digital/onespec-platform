import { describe, expect, test } from "vitest";
import { checkUwEligibility } from "../convex/lib/calcPreview";
import { UW_LIMIT_BY_ZONE } from "../convex/lib/enea";

/** Issue #43: the IT badge and the ENEA document must not disagree (it used 1.4 vs 1.3). */
describe("Uw eligibility", () => {
  test("Italy uses the zone-E limit of the ENEA document", () => {
    expect(checkUwEligibility("IT", UW_LIMIT_BY_ZONE.E)).toBe(true);
    expect(checkUwEligibility("IT", 1.35)).toBe(false);
  });
});
