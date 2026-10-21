// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * Resource guard for #40: the BLE GATT link must not outlive the LaserMeasure
 * component (battery drain + a pinned singleton server), and the
 * characteristic listener must be removed with the SAME reference that was
 * added — a freshly-bound function removes nothing.
 */
const COMPONENT = "src/components/surveys/LaserMeasure.tsx";
const MANAGER = "src/lib/bluetooth-laser.ts";

describe("laser BLE lifecycle (#40)", () => {
  test("the component disconnects the GATT server on unmount", () => {
    const src = readFileSync(COMPONENT, "utf8");
    expect(src).toContain("void manager.disconnect();");
    // The disconnect lives in its own unmount-only effect (empty deps), not
    // in the callbacks effect that re-runs after every measured dimension.
    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]*?void manager\.disconnect\(\);[\s\S]*?\}, \[\]\);/);
  });

  test("the listener is removed by the same stored reference that was added", () => {
    const src = readFileSync(MANAGER, "utf8");
    // No fresh .bind(this) inside the removal — that creates a new function.
    expect(src).not.toMatch(/removeEventListener\([^)]*\.bind\(this\)/);
    // A single stored bound reference is used for both add and remove.
    expect(src).toMatch(/addEventListener\("characteristicvaluechanged", this\.(boundMeasurementHandler|onValueChanged)/);
    expect(src).toMatch(/removeEventListener\("characteristicvaluechanged", this\.(boundMeasurementHandler|onValueChanged)/);
  });
});
