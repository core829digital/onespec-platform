import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("setupGuide.getProgress", () => {
  test("base plan: no billing step, steps reflect real rows only", async () => {
    const t = newDb();
    const { ownerId, tenantId } = await seedTenant(t, { plan: "base" });
    const as = t.withIdentity({ subject: ownerId });

    const empty = await as.query(api.setupGuide.getProgress, { tenantId });
    expect(empty?.plan).toBe("base");
    expect(empty?.steps.some((s) => s.key === "billing")).toBe(false);
    // seedTenant already creates 3 active memberships (owner/admin/member),
    // so "team" is already satisfied; every other step should still be open.
    expect(empty?.steps.find((s) => s.key === "team")?.done).toBe(true);
    expect(
      empty?.steps.filter((s) => s.key !== "team").every((s) => s.done === false),
    ).toBe(true);
    expect(empty?.completed).toBe(false);

    await seedPublishedConfigurator(t, tenantId);
    const withConfigurator = await as.query(api.setupGuide.getProgress, { tenantId });
    const configuratorStep = withConfigurator?.steps.find((s) => s.key === "configurator");
    const catalogStep = withConfigurator?.steps.find((s) => s.key === "catalog");
    expect(configuratorStep?.done).toBe(true);
    // seedPublishedConfigurator sets publishedCatalogVersion, so catalog is done too.
    expect(catalogStep?.done).toBe(true);
    expect(withConfigurator!.doneCount).toBeGreaterThan(0);
  });

  test("pro plan requires a real Stripe customer for the billing step", async () => {
    const t = newDb();
    const { ownerId, tenantId } = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: ownerId });

    const before = await as.query(api.setupGuide.getProgress, { tenantId });
    const billingBefore = before?.steps.find((s) => s.key === "billing");
    expect(billingBefore).toBeDefined();
    expect(billingBefore?.done).toBe(false);

    await t.run((ctx) => ctx.db.patch(tenantId, { stripeCustomerId: "cus_test123" }));
    const after = await as.query(api.setupGuide.getProgress, { tenantId });
    expect(after?.steps.find((s) => s.key === "billing")?.done).toBe(true);
  });

  test("all steps done marks the guide completed", async () => {
    const t = newDb();
    const { ownerId, adminId, tenantId } = await seedTenant(t, { plan: "pro" });
    await seedPublishedConfigurator(t, tenantId);
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { stripeCustomerId: "cus_test123" });
      await ctx.db.insert("branding", {
        tenantId,
        configuratorId: (await ctx.db.query("configurators").first())!._id,
        whiteLabel: false,
        colorAccent: "#16d19d",
        colorAccentInk: "#04231a",
        fontFamily: "inter",
        copy: {},
        companyInfo: { name: "Test Co" },
      });
      const clientId = await ctx.db.insert("clients", {
        tenantId,
        name: "Mario Rossi",
        type: "private",
        tags: [],
        status: "lead",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("cantieri", {
        tenantId,
        name: "Cantiere Test",
        address: "Via Roma 1",
        city: "Roma",
        postalCode: "00100",
        clientId,
        status: "preventivo",
        priority: "medium",
        assignedUserIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    void adminId;

    const as = t.withIdentity({ subject: ownerId });
    const progress = await as.query(api.setupGuide.getProgress, { tenantId });
    expect(progress?.steps.find((s) => s.key === "team")?.done).toBe(true); // owner+admin+member seeded
    expect(progress?.completed).toBe(true);
    expect(progress?.doneCount).toBe(progress?.totalCount);
  });

  test("a non-member cannot read another tenant's progress", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t, { plan: "base" });
    const stranger = await t.run((ctx) =>
      ctx.db.insert("users", { email: "stranger@example.com", emailVerificationTime: Date.now() }),
    );
    await expect(
      t.withIdentity({ subject: stranger }).query(api.setupGuide.getProgress, { tenantId }),
    ).rejects.toThrow(/NOT_A_MEMBER/);
  });

  test("widget-first plans only list steps they can complete", async () => {
    const t = newDb();
    for (const [plan, team] of [["essentials", false], ["essentials_plus", true], ["max", true]] as const) {
      const { ownerId, tenantId } = await seedTenant(t, { plan });
      const p = await t.withIdentity({ subject: ownerId }).query(api.setupGuide.getProgress, { tenantId });
      const keys = p!.steps.map((s) => s.key);
      expect(keys).not.toContain("client");
      expect(keys).not.toContain("cantiere");
      expect(keys.includes("team")).toBe(team);
      expect(keys).toContain("billing");
    }
  });
});
