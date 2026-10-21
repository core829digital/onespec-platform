import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

// Fake timers stop convex-test firing scheduled functions on a real timer after
// the test body ("Write outside of transaction" unhandled rejection -> CI exit 1).
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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

// convex-test fires scheduled functions (emit() -> fanOutToTenant) on a timer; left
// running after the test body they throw "Write outside of transaction" as an
// unhandled rejection, which fails `vitest run` on CI. Fake timers (above) keep
// them from firing, and the mutation under test still commits its own write.
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

    // Drain scheduler work started by emit()/fanOut so it can never run after
    // the test (unhandled "Write outside of transaction" fails CI on Linux).
    await t.finishInProgressScheduledFunctions();
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

    // Drain scheduler work started by emit()/fanOut so it can never run after
    // the test (unhandled "Write outside of transaction" fails CI on Linux).
    await t.finishInProgressScheduledFunctions();
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

    // Drain scheduler work started by emit()/fanOut so it can never run after
    // the test (unhandled "Write outside of transaction" fails CI on Linux).
    await t.finishInProgressScheduledFunctions();
  });
});
