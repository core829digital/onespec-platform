import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("widget.insertQuote — server-authoritative recompute", () => {
  test("recomputes the total from the catalogue incl. brand + screen + installation", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    const item = {
      ...sampleItem,
      profileSystem: "premium", // ×1.5 on material cost
      insectScreen: true,
      insectScreenType: "molla", // +6500
      insectScreenColor: "brown", // +1000
      installation: "posaClima", // +15000
    };

    // A tampered client price — must be ignored, stored separately.
    const res = await t.mutation(internal.widget.insertQuote, {
      publicId: "PUBID12345",
      configuratorId,
      catalogVersion: 1,
      items: [item],
      leadName: "Mario Rossi",
      leadEmail: "mario@example.com",
      leadLocale: "it",
      clientReportedPriceCents: 100, // absurd
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const quote = await t.run((ctx) => ctx.db.get(res));
    // material 30240 ×1.5 = 45360 ; profile 14560 ; sash tiltturn 6500 ;
    // screen 6500 + colour 1000 ; installation 15000  → 88920
    expect(quote?.priceCents).toBe(88920);
    expect(quote?.clientReportedPriceCents).toBe(100);
    expect(quote?.leadName).toBe("Mario Rossi");
  });

  test("rejects an over-cap single-sash item (validation, not a clamp)", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    await expect(
      t.mutation(internal.widget.insertQuote, {
        publicId: "PUBID12345",
        configuratorId,
        catalogVersion: 1,
        items: [{ ...sampleItem, sashes: [sampleItem.sashes[0]], width: 1500, height: 3000 }],
        leadName: "X",
        leadEmail: "x@example.com",
        leadLocale: "it",
      }),
    ).rejects.toThrow(/INVALID_ITEM/);
  });
});
