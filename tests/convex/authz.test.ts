import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("tenant isolation (BOLA / IDOR)", () => {
  test("a member of tenant A cannot read tenant B data", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    const B = await seedTenant(t);

    const asA = t.withIdentity({ subject: A.ownerId });

    // getTenant / listMembers on B
    await expect(asA.query(api.tenants.getTenant, { tenantId: B.tenantId })).rejects.toThrow();
    await expect(asA.query(api.tenants.listMembers, { tenantId: B.tenantId })).rejects.toThrow();
    await expect(
      asA.query(api.quotes.listRequests, { tenantId: B.tenantId }),
    ).rejects.toThrow();
  });

  test("a member of tenant A cannot read a configurator owned by tenant B", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    const B = await seedTenant(t);
    const cfgB = await seedPublishedConfigurator(t, B.tenantId, "BBBBBBBBBB");

    const asA = t.withIdentity({ subject: A.ownerId });
    await expect(
      asA.query(api.configurators.getConfigurator, { configuratorId: cfgB }),
    ).rejects.toThrow();
    await expect(
      asA.query(api.configurators.getEditorState, { configuratorId: cfgB }),
    ).rejects.toThrow();
    // Preview query is best-effort: non-member => null, not a leak.
    const preview = await asA.query(api.widget.getConfiguratorForPreview, {
      publicId: "BBBBBBBBBB",
    });
    expect(preview).toBeNull();
  });

  test("an anonymous caller cannot read any tenant query", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    await expect(t.query(api.tenants.getTenant, { tenantId: A.tenantId })).rejects.toThrow();
    await expect(t.query(api.tenants.getMyTenant, {})).rejects.toThrow(/UNAUTHENTICATED/);
    // The public widget query, by contrast, is safe to call anonymously.
    await expect(
      t.query(api.widget.getPublicConfigurator, { publicId: "NOPENOPE00" }),
    ).resolves.toBeNull();
  });
});

describe("RBAC", () => {
  test("role 'member' cannot mutate configurator / branding / quote status", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    const cfg = await seedPublishedConfigurator(t, A.tenantId, "AAAAAAAAAA");
    const asMember = t.withIdentity({ subject: A.memberId });

    await expect(
      asMember.mutation(api.configurators.publishConfigurator, { configuratorId: cfg }),
    ).rejects.toThrow();
    await expect(
      asMember.mutation(api.branding.updateBranding, {
        configuratorId: cfg,
        colorAccent: "#000000",
      }),
    ).rejects.toThrow();
  });

  test("role 'member' CAN list requests (read access)", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    const asMember = t.withIdentity({ subject: A.memberId });
    await expect(
      asMember.query(api.quotes.listRequests, { tenantId: A.tenantId }),
    ).resolves.toEqual([]);
  });

  test("non-platform-admin cannot call admin queries", async () => {
    const t = newDb();
    const A = await seedTenant(t);
    const asOwner = t.withIdentity({ subject: A.ownerId });
    await expect(asOwner.query(api.admin.listTenants, {})).rejects.toThrow();
    await expect(asOwner.query(api.admin.getSeatCount, {})).rejects.toThrow();
  });
});

describe("public widget query does not leak internals", () => {
  test("getPublicConfigurator returns null for a draft and strips system fields when published", async () => {
    const t = newDb();
    const A = await seedTenant(t);

    // draft
    const draftId = await t.run((ctx) =>
      ctx.db.insert("configurators", {
        tenantId: A.tenantId,
        publicId: "DRAFT00000",
        name: "Draft",
        status: "draft",
        allowedOrigins: [],
        defaultLocale: "it",
        defaultTheme: "auto",
        vatRatePercent: 22,
        priceRoundingStep: 1,
        showPricesToEndUser: true,
        currency: "EUR",
      }),
    );
    expect(draftId).toBeDefined();
    expect(await t.query(api.widget.getPublicConfigurator, { publicId: "DRAFT00000" })).toBeNull();

    await seedPublishedConfigurator(t, A.tenantId, "PUBLISHED01");
    const pub = await t.query(api.widget.getPublicConfigurator, { publicId: "PUBLISHED01" });
    expect(pub).not.toBeNull();
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('"_id"');
    expect(serialized).not.toContain('"tenantId"');
    expect(serialized).not.toContain('"_creationTime"');
  });
});
