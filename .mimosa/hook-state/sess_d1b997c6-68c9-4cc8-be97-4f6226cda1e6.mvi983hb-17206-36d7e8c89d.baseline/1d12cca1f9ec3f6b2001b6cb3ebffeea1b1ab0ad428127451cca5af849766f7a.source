import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";
import { errorKey, keyForCode } from "../../src/lib/errors";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("a fascicolo without a quote can't generate the funding doc until a quote is linked", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(seeded.tenantId, { country: "IT" }));
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "IT_LINK_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Created from the page: no quote.
  const passportId = await asOwner.mutation(api.passports.create, {
    tenantId: seeded.tenantId,
    label: "FIN-01",
    customerName: "Rossi",
    installedAt: Date.now(),
  });
  await expect(asOwner.mutation(api.passports.generateFundingDoc, { passportId })).rejects.toThrow(
    /FUNDING_NEEDS_QUOTE/,
  );

  const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Rossi",
    leadEmail: "r@example.com",
    customerPostalCode: "59100",
    regionCode: "IT",
    items: [sampleItem],
    vatRatePercent: 10,
  });
  await asOwner.mutation(api.passports.linkQuote, { passportId, quoteId });
  const res = await asOwner.mutation(api.passports.generateFundingDoc, { passportId });
  expect(res.uwPost).toBeGreaterThan(0);
});

test("linkQuote refuses another tenant's quote", async () => {
  const t = newDb();
  const mine = await seedTenant(t, { plan: "pro" });
  const other = await seedTenant(t, { plan: "pro" });
  const cfg = await seedPublishedConfigurator(t, other.tenantId, "OTHER_TENANT_1");
  const asOther = t.withIdentity({ subject: other.ownerId });
  const { quoteId } = await asOther.mutation(api.quotes.createFieldQuote, {
    tenantId: other.tenantId,
    configuratorId: cfg,
    leadName: "X",
    leadEmail: "x@example.com",
    regionCode: "IT",
    items: [sampleItem],
    vatRatePercent: 10,
  });
  const asMine = t.withIdentity({ subject: mine.ownerId });
  const passportId = await asMine.mutation(api.passports.create, {
    tenantId: mine.tenantId,
    label: "A",
    customerName: "B",
  });
  await expect(asMine.mutation(api.passports.linkQuote, { passportId, quoteId })).rejects.toThrow(/QUOTE_NOT_FOUND/);
});

test("errors: a deliberate ConvexError maps to a specific key, anything else to generic — never the raw text", () => {
  expect(errorKey(new ConvexError("FUNDING_NEEDS_QUOTE"))).toBe("fundingNeedsQuote");
  expect(errorKey(new ConvexError("QUOTE_QUOTA_EXCEEDED"))).toBe("quotaExceeded");
  expect(errorKey(new ConvexError("FISCAL_ENGINE_NOT_ALLOWED"))).toBe("planRequired");
  expect(errorKey(new ConvexError("PASSPORT_NOT_FOUND"))).toBe("notFound");
  expect(errorKey(new ConvexError({ code: "PLAN_SUSPENDED" }))).toBe("planSuspended");
  expect(errorKey(new Error("[CONVEX M(passports:generateFundingDoc)] Server Error"))).toBe("generic");
  expect(keyForCode("SOMETHING_UNKNOWN")).toBe("generic");
});
