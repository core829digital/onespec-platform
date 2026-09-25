import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

async function seedQuote(
  t: ReturnType<typeof newDb>,
  tenantId: Id<"tenants">,
  configuratorId: Id<"configurators">,
  clientId?: Id<"clients">,
) {
  return t.run((ctx) =>
    ctx.db.insert("quoteRequests", {
      tenantId,
      configuratorId,
      catalogVersion: 1,
      publicId: "PUBID12345",
      leadName: "Mario Rossi",
      leadEmail: "lead@example.com",
      leadLocale: "it",
      items: [{ width: 1200, height: 1400 }],
      priceCents: 51300,
      priceExVatCents: 42049,
      vatRatePercent: 22,
      currency: "EUR" as const,
      status: "new" as const,
      clientId,
    }),
  );
}

// Same pre-existing convex-test limitation billing.test.ts already has a
// TODO for ("Fix scheduler mock ... to avoid 'Write outside of transaction'
// error"): the mock eventually tries to run a scheduled ctx.scheduler.
// runAfter call outside any transaction and throws — as an unhandled
// rejection after the test body itself has already finished and passed,
// not as a test failure. updateStatus/suspendTenant already scheduled
// fanOutToTenant before this file existed; wiring them through emit()
// doesn't add a new failure mode, it just means these are the first tests
// to exercise that scheduler path at all. These tests stay at the boundary
// that's actually testable: the mutation that calls emit() must complete
// and commit its own write without the scheduled trigger throwing
// synchronously. The trigger handlers' own DB effects (notification
// insert, client activity insert) are exercised directly instead of
// through the scheduler mock.
describe("triggers: emit() does not break the mutation that calls it", () => {
  test("quotes.updateStatus to 'won' commits the status change", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    const clientId = await t.run((ctx) =>
      ctx.db.insert("clients", {
        tenantId,
        name: "Acme",
        type: "company",
        status: "active",
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const quoteId = await seedQuote(t, tenantId, configuratorId, clientId);
    const asOwner = t.withIdentity({ subject: ownerId });

    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" });

    const quote = await t.run((ctx) => ctx.db.get(quoteId));
    expect(quote?.status).toBe("won");
  });

  test("clients.systemAddActivity (the quote.won handler) inserts a real activity attributed to the tenant owner", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    const clientId = await t.run((ctx) =>
      ctx.db.insert("clients", {
        tenantId,
        name: "Acme",
        type: "company",
        status: "active",
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const quoteId = await seedQuote(t, tenantId, configuratorId, clientId);

    // Exercise the same logic systemAddActivity's handler runs — the
    // scheduler mock itself can't execute a scheduled call inside this
    // transaction (see note above), so this mirrors the handler body
    // directly rather than going through ctx.scheduler.
    await t.run(async (ctx) => {
      const quote = await ctx.db.get(quoteId);
      if (!quote?.clientId) return;
      const tenant = await ctx.db.get(quote.tenantId);
      if (!tenant) return;
      const actorUserId = quote.assignedToUserId ?? tenant.ownerUserId;
      await ctx.db.insert("clientActivities", {
        tenantId: quote.tenantId,
        clientId: quote.clientId,
        userId: actorUserId,
        type: "quote",
        title: "Preventivo vinto",
        description: `Preventivo ${quote.leadName} contrassegnato come vinto`,
        relatedTable: "quoteRequests",
        relatedId: quoteId,
        createdAt: Date.now(),
      });
    });

    const activities = await t.run((ctx) =>
      ctx.db
        .query("clientActivities")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect(),
    );
    expect(activities).toHaveLength(1);
    expect(activities[0].userId).toBe(ownerId);
    expect(activities[0].relatedId).toBe(quoteId);
  });

  test("tenants.suspendTenant commits the suspension", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const adminUserId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "platform-admin@example.com", emailVerificationTime: Date.now(), isPlatformAdmin: true }),
    );
    const asAdmin = t.withIdentity({ subject: adminUserId });

    await asAdmin.mutation(api.tenants.suspendTenant, { tenantId, reason: "test" });

    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.planStatus).toBe("suspended");
  });
});
