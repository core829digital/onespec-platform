import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("leaf widths typed on the drawing are stored as shares that add up to the whole frame", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "LEAF_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const make = (ratios: number[]) =>
    asOwner.mutation(api.quotes.createFieldQuote, {
      tenantId: seeded.tenantId, configuratorId, leadName: "Mario Rossi", leadEmail: "mario.rossi@example.com", vatRatePercent: 22,
      items: [{ ...sampleItem, width: 1500, sashes: sampleItem.sashes.map((s, i) => ({ ...s, widthRatio: ratios[i] })) }],
    });
  const shares = async (id: Awaited<ReturnType<typeof make>>["quoteId"]) =>
    ((await asOwner.query(api.quotes.getRequest, { quoteId: id }))!.items as Array<{ sashes: Array<{ widthRatio?: number }> }>)[0].sashes.map((s) => s.widthRatio ?? 0);

  const good = await shares((await make([0.4, 0.6])).quoteId);
  expect(good).toEqual([0.4, 0.6]);
  // a stale tab sends shares that do not add up: the quote is kept and the stored shares are the whole frame
  const odd = await shares((await make([0.5, 0.7])).quoteId);
  expect(odd.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  expect(odd[0]).toBeCloseTo(0.5 / 1.2, 12);
});
