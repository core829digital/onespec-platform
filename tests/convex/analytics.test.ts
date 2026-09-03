import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

async function quote(
  t: ReturnType<typeof newDb>,
  tenantId: Id<"tenants">,
  configuratorId: Id<"configurators">,
  status: "new" | "contacted" | "quoted" | "won" | "lost" | "spam",
  priceCents: number,
) {
  return t.run((ctx) =>
    ctx.db.insert("quoteRequests", {
      tenantId,
      configuratorId,
      catalogVersion: 1,
      publicId: "PUBID12345",
      leadName: "L",
      leadEmail: "l@example.com",
      leadLocale: "it",
      items: [],
      priceCents,
      priceExVatCents: Math.round(priceCents / 1.22),
      vatRatePercent: 22,
      currency: "EUR" as const,
      status,
      sourceOrigin: "https://shop.example.com",
    }),
  );
}

describe("analytics.getOverview", () => {
  test("aggregates status, conversion and value from real rows only", async () => {
    const t = newDb();
    const { tenantId, memberId } = await seedTenant(t);
    const cfg = await seedPublishedConfigurator(t, tenantId);
    await quote(t, tenantId, cfg, "won", 100_00);
    await quote(t, tenantId, cfg, "won", 300_00);
    await quote(t, tenantId, cfg, "lost", 50_00);
    await quote(t, tenantId, cfg, "new", 80_00);
    await quote(t, tenantId, cfg, "spam", 999_00);

    const o = await t
      .withIdentity({ subject: memberId })
      .query(api.analytics.getOverview, { tenantId, range: "1m" });

    expect(o.totalRequests).toBe(5);
    expect(o.realLeads).toBe(4);
    expect(o.won).toBe(2);
    expect(o.wonValueCents).toBe(400_00);
    expect(o.avgDealCents).toBe(200_00);
    expect(o.conversionRate).toBeCloseTo(0.5);
    expect(o.bySource[0]).toEqual({ host: "shop.example.com", count: 5 });
    expect(o.byConfigurator[0].count).toBe(5);
  });

  test("widget views are deduped per token and drive visitor conversion rate", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    await seedPublishedConfigurator(t, tenantId);
    await quote(t, tenantId, await seedPublishedConfigurator(t, tenantId, "PUB2"), "new", 100_00);

    // 3 opens, one token repeated → 2 counted
    for (const tok of ["tokenAAAAAA", "tokenAAAAAA", "tokenBBBBBB"]) {
      await t.mutation(internal.widget.recordWidgetView, { publicId: "PUBID12345", viewToken: tok });
    }
    // an open on a draft configurator is ignored
    await t.run(async (ctx) => {
      const c = await ctx.db
        .query("configurators")
        .withIndex("by_publicId", (q) => q.eq("publicId", "PUB2"))
        .unique();
      if (c) await ctx.db.patch(c._id, { status: "draft" });
    });
    await t.mutation(internal.widget.recordWidgetView, { publicId: "PUB2", viewToken: "tokenCCCCCC" });

    const o = await t
      .withIdentity({ subject: ownerId })
      .query(api.analytics.getOverview, { tenantId, range: "1m" });
    expect(o.widgetViews).toBe(2);
    expect(o.visitorConversionRate).toBeCloseTo(0.5); // 1 request / 2 views
  });

  test("foreign tenant is rejected", async () => {
    const t = newDb();
    const a = await seedTenant(t);
    const b = await seedTenant(t);
    await expect(
      t.withIdentity({ subject: b.ownerId }).query(api.analytics.getOverview, { tenantId: a.tenantId }),
    ).rejects.toThrow();
  });
});
