import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("configurators.createConfigurator", () => {
  test("returns { configuratorId, publicId } (not the id directly), and getEditorState works right after creation", async () => {
    // Regression test for a real 2026-09-29 bug: two frontend call sites
    // (configurators/page.tsx and onboarding/page.tsx) assigned this
    // mutation's whole return value to a variable named `configuratorId`
    // and interpolated it straight into a route/analytics field. Since the
    // mutation actually returns an object, that produced the literal string
    // "[object Object]" — Convex rejected it as an invalid document id, the
    // exact "getEditorState Server Error" reported right after creating a
    // new configurator and being routed into its setup wizard.
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: ownerId });

    const result = await as.mutation(api.configurators.createConfigurator, {
      tenantId,
      name: "Nuovo configuratore",
    });
    expect(result).toHaveProperty("configuratorId");
    expect(result).toHaveProperty("publicId");
    expect(typeof result.configuratorId).toBe("string");
    expect(result.configuratorId).not.toBe("[object Object]");

    // The exact next step the setup wizard takes on mount.
    const state = await as.query(api.configurators.getEditorState, {
      configuratorId: result.configuratorId,
    });
    expect(state?.configurator.name).toBe("Nuovo configuratore");
    expect(state?.configurator.publicId).toBe(result.publicId);
  });
});

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
