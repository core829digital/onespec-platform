import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("renameBusinessToPro migrates business rows to pro with audit, idempotent", async () => {
  const t = newDb();
  const a = await seedTenant(t, { plan: "business" });
  const b = await seedTenant(t, { plan: "business" });
  const c = await seedTenant(t, { plan: "starter" });

  const first = await t.mutation(internal.migrations.renameBusinessToPro, {});
  expect(first.migrated).toBe(2);
  expect(first.done).toBe(true);

  const after = await t.run(async (ctx) => ({
    a: await ctx.db.get(a.tenantId),
    b: await ctx.db.get(b.tenantId),
    c: await ctx.db.get(c.tenantId),
    audits: await ctx.db
      .query("auditLog")
      .withIndex("by_action", (q) => q.eq("action", "plan.migrate"))
      .collect(),
  }));
  expect(after.a?.plan).toBe("pro");
  expect(after.b?.plan).toBe("pro");
  expect(after.c?.plan).toBe("starter");
  expect(after.audits.length).toBe(2);

  const second = await t.mutation(internal.migrations.renameBusinessToPro, {});
  expect(second.migrated).toBe(0);
});

test("backfillTrialEndsAt fills pre-Stripe trialing rows only", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.patch(seeded.tenantId, {
      planStatus: "trialing",
      createdAt: now - 20 * 24 * 60 * 60 * 1000,
    });
  });

  const res = await t.mutation(internal.migrations.backfillTrialEndsAt, {});
  expect(res.backfilled).toBe(1);

  const tenant = await t.run((ctx) => ctx.db.get(seeded.tenantId));
  expect(tenant?.trialPlan).toBe("pro");
  expect(tenant?.trialEndsAt).toBe(now - 20 * 24 * 60 * 60 * 1000 + 14 * 24 * 60 * 60 * 1000);

  const again = await t.mutation(internal.migrations.backfillTrialEndsAt, {});
  expect(again.backfilled).toBe(0);
});
