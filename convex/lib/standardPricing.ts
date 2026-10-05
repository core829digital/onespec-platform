import type { Doc } from "../_generated/dataModel";
import { isPriceZone, resolveStandardPrice, standardProfileByKey, type PriceZone } from "../../src/shared/standard-pricing";

/** The zone prices are resolved for: the installer's own, else the middle of Italy (never blocks a publish). */
export function zoneOf(tenant: Pick<Doc<"tenants">, "priceZone"> | null | undefined): PriceZone {
  return isPriceZone(tenant?.priceZone) ? tenant!.priceZone! : "centro";
}

/**
 * The pricing fields of a catalogue snapshot's `configurator` block: mode, zone and the installer's margin.
 * The margin applies in every mode; the zone only matters in "standard".
 */
export function pricingBlock(
  configurator: Pick<Doc<"configurators">, "pricingMode" | "marginPercent" | "deliveryMode" | "ownServicePerM2Cents">,
  tenant: Pick<Doc<"tenants">, "priceZone"> | null | undefined,
) {
  return {
    ...(configurator.pricingMode ? { pricingMode: configurator.pricingMode } : {}),
    ...(configurator.pricingMode === "standard" ? { priceZone: zoneOf(tenant) } : {}),
    ...(typeof configurator.marginPercent === "number" && configurator.marginPercent > 0 ? { marginPercent: configurator.marginPercent } : {}),
    ...(configurator.deliveryMode === "own" && (configurator.ownServicePerM2Cents ?? 0) > 0 ? { deliveryMode: "own" as const, ownServicePerM2Cents: configurator.ownServicePerM2Cents } : {}),
  };
}

/** Profile rows of a snapshot: in "standard" mode every row with a price list key carries that entry's prices for the zone. */
export function withStandardPrices<T extends { standardKey?: string }>(
  rows: T[],
  configurator: Pick<Doc<"configurators">, "pricingMode">,
  tenant: Pick<Doc<"tenants">, "priceZone"> | null | undefined,
): Array<T & { standard?: ReturnType<typeof resolveStandardPrice> }> {
  if (configurator.pricingMode !== "standard") return rows;
  const zone = zoneOf(tenant);
  return rows.map((row) => {
    const entry = standardProfileByKey(row.standardKey);
    return entry ? { ...row, standard: resolveStandardPrice(entry, zone) } : row;
  });
}
