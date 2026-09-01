import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("configurator versions + rollback", () => {
  test("listVersions returns published versions newest-first with isCurrent flag", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    const versions = await t
      .withIdentity({ subject: ownerId })
      .query(api.configurators.listVersions, { configuratorId });

    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    expect(versions[0].isCurrent).toBe(true);
  });

  test("rollbackToVersion re-publishes old payload as a new version", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    // seed a v2 directly (avoids the publish fan-out scheduler in tests)
    await t.run(async (ctx) => {
      const cfg = (await ctx.db.get(configuratorId))!;
      await ctx.db.insert("catalogVersions", {
        tenantId: cfg.tenantId,
        configuratorId,
        version: 2,
        publishedByUserId: ownerId,
        publishedAt: Date.now(),
        payload: { marker: "v2" },
      });
      await ctx.db.patch(configuratorId, { publishedCatalogVersion: 2 });
    });

    const res = await t
      .withIdentity({ subject: ownerId })
      .mutation(api.configurators.rollbackToVersion, { configuratorId, version: 1 });

    expect(res.version).toBe(3);
    const cfg = await t
      .withIdentity({ subject: ownerId })
      .query(api.configurators.getConfigurator, { configuratorId });
    expect(cfg?.publishedCatalogVersion).toBe(3);

    // the new version carries v1's payload, not v2's
    const restored = await t.run((ctx) =>
      ctx.db
        .query("catalogVersions")
        .withIndex("by_configurator_version", (q) =>
          q.eq("configuratorId", configuratorId).eq("version", 3),
        )
        .unique(),
    );
    expect((restored?.payload as { marker?: string }).marker).toBeUndefined();
    expect(Array.isArray((restored?.payload as { materials?: unknown[] }).materials)).toBe(true);
  });

  test("member cannot rollback (RBAC)", async () => {
    const t = newDb();
    const { tenantId, memberId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    await expect(
      t
        .withIdentity({ subject: memberId })
        .mutation(api.configurators.rollbackToVersion, { configuratorId, version: 1 }),
    ).rejects.toThrow();
  });

  test("foreign tenant cannot list versions", async () => {
    const t = newDb();
    const a = await seedTenant(t);
    const b = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, a.tenantId, "AAAAA11111");

    await expect(
      t
        .withIdentity({ subject: b.ownerId })
        .query(api.configurators.listVersions, { configuratorId }),
    ).rejects.toThrow();
  });
});
