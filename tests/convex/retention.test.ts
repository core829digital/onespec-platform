import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Regression for #35: the append-only tables (auditLog, clientActivities,
 * meteredEvents, billingEvents, viesChecks, catalogImports, trialFingerprints)
 * had no retention at all and grew without bound. The daily sweep drops rows
 * older than each window and keeps fresh ones, batched like the email-log
 * purge (take 500 + self-reschedule).
 */
test("append-only retention purges expired rows and keeps fresh ones (#35)", async () => {
  // Seed and write the "old" rows in the past: convex-test stamps _creationTime
  // from Date.now(), and monotonicity means every insert must come after the
  // previous one — so start the clock at the oldest point.
  vi.setSystemTime(new Date("2024-01-10T00:00:00Z").getTime());
  const t = newDb();
  const s = await seedTenant(t);

  await t.run(async (ctx) => {
    const clientId = await ctx.db.insert("clients", {
      tenantId: s.tenantId, name: "Rossi", type: "company", tags: [], status: "active",
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", { tenantId: s.tenantId, actorKind: "user", action: "old.act", createdAt: Date.now() });
    await ctx.db.insert("clientActivities", {
      tenantId: s.tenantId, clientId, userId: s.ownerId, type: "note", title: "old",
      relatedTable: "clients", relatedId: clientId, createdAt: Date.now(),
    });
    await ctx.db.insert("meteredEvents", {
      tenantId: s.tenantId, kind: "widget_pdf", subjectKey: "old", period: "2024-01",
      userId: s.ownerId, createdAt: Date.now(),
    });
    await ctx.db.insert("billingEvents", { stripeEventId: "evt_old", type: "invoice.paid", receivedAt: Date.now() });
    await ctx.db.insert("viesChecks", {
      tenantId: s.tenantId, userId: s.ownerId, country: "IT", vatNumber: "IT00905811006",
      valid: true, checkedAt: Date.now(),
    });
    await ctx.db.insert("trialFingerprints", { fingerprint: "old-fp", tenantId: s.tenantId, createdAt: Date.now() });
    const configuratorId = await ctx.db.insert("configurators", {
      tenantId: s.tenantId, publicId: "RET_35", name: "X", status: "published", allowedOrigins: [],
      defaultLocale: "it", defaultTheme: "auto", vatRatePercent: 22, priceRoundingStep: 1,
      showPricesToEndUser: true, currency: "EUR", publishedCatalogVersion: 1,
    });
    await ctx.db.insert("catalogImports", {
      tenantId: s.tenantId, configuratorId, target: "materials", importedByUserId: s.ownerId,
      importedAt: Date.now(), summary: { created: 0, updated: 0, rejected: 0 }, snapshot: [],
      undone: false,
    });
  });

  // Fresh rows (today): every window keeps them. The clock only moves forward.
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z").getTime());
  await t.run(async (ctx) => {
    await ctx.db.insert("auditLog", { tenantId: s.tenantId, actorKind: "user", action: "new.act", createdAt: Date.now() });
    await ctx.db.insert("billingEvents", { stripeEventId: "evt_new", type: "invoice.paid", receivedAt: Date.now() });
    await ctx.db.insert("viesChecks", {
      tenantId: s.tenantId, userId: s.ownerId, country: "IT", vatNumber: "IT00905811006",
      valid: false, checkedAt: Date.now(),
    });
  });

  const purged = await t.mutation(internal.retention.purgeAppendOnly, {});
  expect(purged).toBe(7);

  const remaining = await t.run(async (ctx) => ({
    audit: (await ctx.db.query("auditLog").collect()).map((r) => r.action),
    billing: (await ctx.db.query("billingEvents").collect()).map((r) => r.stripeEventId),
    vies: await ctx.db.query("viesChecks").collect(),
    activities: await ctx.db.query("clientActivities").collect(),
    metered: await ctx.db.query("meteredEvents").collect(),
    imports: await ctx.db.query("catalogImports").collect(),
    trials: await ctx.db.query("trialFingerprints").collect(),
  }));
  expect(remaining.audit).toEqual(["new.act"]);
  expect(remaining.billing).toEqual(["evt_new"]);
  expect(remaining.vies).toHaveLength(1);
  expect(remaining.vies[0]?.valid).toBe(false);
  expect(remaining.activities).toHaveLength(0);
  expect(remaining.metered).toHaveLength(0);
  expect(remaining.imports).toHaveLength(0);
  expect(remaining.trials).toHaveLength(0);
});
