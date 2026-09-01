import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
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
      .query(api.analytics.getOverview, { tenantId, days: 30 });

    expect(o.totalRequests).toBe(5);
    expect(o.realLeads).toBe(4);
    expect(o.won).toBe(2);
    expect(o.wonValueCents).toBe(400_00);
    expect(o.avgDealCents).toBe(200_00);
    expect(o.conversionRate).toBeCloseTo(0.5);
    expect(o.bySource[0]).toEqual({ host: "shop.example.com", count: 5 });
    expect(o.byConfigurator[0].count).toBe(5);
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
