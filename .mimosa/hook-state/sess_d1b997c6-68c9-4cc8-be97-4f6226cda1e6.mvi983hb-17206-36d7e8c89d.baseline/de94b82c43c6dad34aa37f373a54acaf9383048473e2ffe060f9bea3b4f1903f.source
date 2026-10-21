import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup(rateCents: number | undefined, def?: "with" | "without") {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "POSA_01");
  await t.run(async (ctx) => {
    const v = (await ctx.db.query("catalogVersions").collect())[0];
    const payload = v.payload as { configurator: Record<string, unknown> };
    if (rateCents) payload.configurator = { ...payload.configurator, installationPerM2Cents: rateCents, ...(def ? { installationDefault: def } : {}) };
    await ctx.db.patch(v._id, { payload });
  });
  return { t, seeded, configuratorId, asOwner: t.withIdentity({ subject: seeded.ownerId }) };
}

const quote = (s: Awaited<ReturnType<typeof setup>>, item: object) =>
  s.asOwner.mutation(api.quotes.createFieldQuote, { tenantId: s.seeded.tenantId, configuratorId: s.configuratorId, leadName: "Mario Rossi", leadEmail: "mario.rossi@example.com", items: [item], vatRatePercent: 22 });

test("the server prices the fitting from the stored choice and records it on the quote", async () => {
  const s = await setup(8000);
  const without = await quote(s, { ...sampleItem, withInstallation: false });
  const withPosa = await quote(s, { ...sampleItem, withInstallation: true });
  const dflt = await quote(s, sampleItem); // configurator default = with
  const get = (id: typeof without.quoteId) => s.asOwner.query(api.quotes.getRequest, { quoteId: id });
  const [a, b, c] = [await get(without.quoteId), await get(withPosa.quoteId), await get(dflt.quoteId)];
  expect(a?.installationIncluded).toBe(false);
  expect(b?.installationIncluded).toBe(true);
  expect(c?.installationIncluded).toBe(true);
  const area = (1200 * 1400) / 1e6;
  expect(b!.priceExVatCents - a!.priceExVatCents).toBe(Math.round(8000 * area));
  expect(c!.priceExVatCents).toBe(b!.priceExVatCents);
});

test("a configurator with default 'without' and a configurator without a posa price", async () => {
  const s = await setup(8000, "without");
  const q = await quote(s, sampleItem);
  expect((await s.asOwner.query(api.quotes.getRequest, { quoteId: q.quoteId }))?.installationIncluded).toBe(false);
  const none = await setup(undefined);
  const q2 = await quote(none, { ...sampleItem, withInstallation: true });
  const doc = await none.asOwner.query(api.quotes.getRequest, { quoteId: q2.quoteId });
  expect(doc?.installationIncluded).toBeUndefined(); // nothing to choose: the flag is ignored
});
