import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb, sampleItem, seedPublishedConfigurator, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DAY = 24 * 60 * 60 * 1000;

describe("retention of append-only tables (issue #35)", () => {
  test("old rows go, recent rows, CRM history and VIES proof behind a quote stay", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const now = () => Date.now();
    const insertOld = () =>
      t.run(async (ctx) => {
        await ctx.db.insert("auditLog", { tenantId: s.tenantId, actorKind: "system", action: "old", createdAt: now() });
        await ctx.db.insert("billingEvents", { stripeEventId: "evt_old", type: "x", receivedAt: now() });
        await ctx.db.insert("clientActivities", { tenantId: s.tenantId, clientId: await ctx.db.insert("clients", { tenantId: s.tenantId, name: "Rossi", type: "company", tags: [], status: "active", createdAt: now(), updatedAt: now() }), userId: s.ownerId, type: "note", title: "old", createdAt: now() } as never);
        const kept = await ctx.db.insert("viesChecks", { tenantId: s.tenantId, userId: s.ownerId, country: "DE", vatNumber: "DE136695976", valid: true, checkedAt: now() });
        await ctx.db.insert("viesChecks", { tenantId: s.tenantId, userId: s.ownerId, country: "DE", vatNumber: "DE999999999", valid: true, checkedAt: now() });
        return kept;
      });
    const provenCheck = await insertOld();
    // A quote that relied on the first VIES check (0% intra-EU supply).
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "RETENT0001");
    const quoteId = await t.mutation(internal.widget.insertQuote, {
      publicId: "RETENT0001", configuratorId, catalogVersion: 1, items: [sampleItem], leadName: "Kunde", leadEmail: "k@example.com", leadLocale: "de",
    });
    await t.run((ctx) => ctx.db.patch(quoteId, { viesCheckId: provenCheck }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    vi.advanceTimersByTime(800 * DAY);
    await t.run((ctx) => ctx.db.insert("auditLog", { tenantId: s.tenantId, actorKind: "system", action: "recent", createdAt: now() }));

    await t.mutation(internal.retention.purgeAppendOnly, {});
    const left = await t.run(async (ctx) => ({
      audit: (await ctx.db.query("auditLog").collect()).map((a) => a.action),
      billing: await ctx.db.query("billingEvents").collect(),
      activities: await ctx.db.query("clientActivities").collect(),
      vies: (await ctx.db.query("viesChecks").collect()).map((c) => c._id),
    }));
    expect(left.audit).toEqual(["recent"]);
    expect(left.billing).toHaveLength(0);
    expect(left.activities).toHaveLength(1); // the dealer's CRM history is not ours to expire
    expect(left.vies).toEqual([provenCheck]); // proof behind a quote is kept
  });
});
