import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

/**
 * Regression for #45: generatePassportQrs used to insert one new passport per
 * quote unit on every run — each duplicate carrying a live, forever-valid QR
 * token. It must be idempotent like its sibling createBatchFromQuote
 * (invariant pinned in field-modules.test.ts) and return the existing tokens
 * so the labels panel still renders on a repeat visit.
 */
test("generatePassportQrs is idempotent — re-running creates nothing new and reuses tokens (#45)", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "PPQ_45");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // 3 units: one item with quantity 2 + one single item.
  const quote = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Rossi Marco",
    leadEmail: "rossi@example.com",
    customerAddress: "Via Pistoiese 412",
    customerCity: "Prato",
    customerPostalCode: "59100",
    items: [{ ...sampleItem, quantity: 2 }, sampleItem],
    vatRatePercent: 22,
  });

  const batchArgs = { tenantId: seeded.tenantId, quoteId: quote.quoteId };
  const batch = await asOwner.mutation(api.passports.createBatchFromQuote, batchArgs);
  expect(batch.created).toBe(3);

  // All passports linked to this quote (tiny table in a test DB: full scan + JS filter).
  const rowsForQuote = async () => {
    const all = await t.run((ctx) => ctx.db.query("serramentoPassports").collect());
    return all.filter((r) => r.quoteId === quote.quoteId);
  };

  const before = await rowsForQuote();
  const tokensBefore = before.map((p) => p.publicToken);

  const qrArgs = { passportId: before[0]._id };
  const first = await asOwner.mutation(api.passports.generatePassportQrs, qrArgs);
  expect(first).toHaveLength(3);
  expect(await rowsForQuote()).toHaveLength(3);

  // The second run must return the SAME three tokens and insert nothing.
  const second = await asOwner.mutation(api.passports.generatePassportQrs, qrArgs);
  expect(await rowsForQuote()).toHaveLength(3);
  expect(second).toHaveLength(3);
  for (const row of second) {
    expect(tokensBefore).toContain(row.token);
  }
});
