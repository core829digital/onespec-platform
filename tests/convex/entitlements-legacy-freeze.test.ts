import { describe, expect, test } from "vitest";
import { entitlementsFor } from "../../convex/lib/entitlements";

/**
 * "Non modificare accessi" — the full-platform plans (Base / Pro / Agency /
 * Enterprise and their pre-v2 aliases) must keep exactly the access they had
 * before the widget-first plans (Essentials / Essentials+ / Max) were added.
 * The snapshot was recorded from the pre-change matrix; any drift fails here.
 * New module flags may be added, but they must be ON for every legacy plan,
 * which the second test enforces independently of the snapshot.
 */
const LEGACY = ["base", "pro", "agency", "enterprise", "starter", "showroom", "business"] as const;

const serialise = (o: object) =>
  JSON.parse(JSON.stringify(o, (_k, v) => (v === Infinity ? "Infinity" : v)));

describe("legacy plan access is frozen", () => {
  for (const plan of LEGACY) {
    test(plan, () => {
      const e = entitlementsFor(plan) as unknown as Record<string, unknown>;
      // Only compare the keys that existed before the widget-first ladder.
      const before = Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("module") && !k.startsWith("max") || LEGACY_MAX_KEYS.has(k)));
      expect(serialise(before)).toMatchSnapshot();
    });
  }
});

const LEGACY_MAX_KEYS = new Set(["maxConfigurators", "maxQuotesPerMonth", "maxTeamMembers", "maxLogisticsSuppliers", "maxCarriers"]);

describe("legacy plans get every widget-ladder module and unlimited widget-ladder caps", () => {
  for (const plan of LEGACY) {
    test(plan, () => {
      const e = entitlementsFor(plan) as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(e)) {
        if (k.startsWith("module")) expect([k, v]).toEqual([k, true]);
        if (k.startsWith("max") && !LEGACY_MAX_KEYS.has(k)) expect([k, v]).toEqual([k, Infinity]);
      }
    });
  }
});
