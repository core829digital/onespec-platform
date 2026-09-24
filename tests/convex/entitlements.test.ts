import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  entitlementsFor,
  resolveTenantEntitlements,
  assertQuota,
  checkQuota,
} from "../../convex/lib/entitlements";
import { newDb, seedTenant } from "./_helpers";
import type { Doc } from "../../convex/_generated/dataModel";

describe("entitlement matrix matches the signed SaaS contracts (v2 ladder)", () => {
  test("base", () => {
    const e = entitlementsFor("base");
    expect(e.maxConfigurators).toBe(1);
    expect(e.maxQuotesPerMonth).toBe(20);
    expect(e.whiteLabel).toBe(false);
    expect(e.publicWidget).toBe(false);
    expect(e.customDomain).toBe(false);
    expect(e.fieldModules).toBe("rilievo_only");
    expect(e.fiscalEngine).toBe("basic");
    expect(e.analytics).toBe("none");
  });
  test("business (legacy) resolves to Pro", () => {
    const e = entitlementsFor("business");
    expect(e.maxConfigurators).toBe(3);
    expect(e.maxQuotesPerMonth).toBe(Infinity);
    expect(e.whiteLabel).toBe(true);
    expect(e.advancedPricingRules).toBe(true);
    expect(e.customDomain).toBe(false);
    expect(e.fieldModules).toBe("full");
  });
  test("pro (\"Widget WhiteLabel\") unlocks the public embeddable widget", () => {
    const e = entitlementsFor("pro");
    expect(e.maxConfigurators).toBe(3);
    expect(e.maxTeamMembers).toBe(5);
    expect(e.fieldModules).toBe("full");
    expect(e.eSignature).toBe(true);
    expect(e.trialEligible).toBe(true);
    expect(e.publicWidget).toBe(true);
    expect(e.whiteLabel).toBe(true);
  });
  test("agency (\"MultiBrand\") adds multi-supplier + showroom calculator", () => {
    const e = entitlementsFor("agency");
    expect(e.maxConfigurators).toBe(10);
    expect(e.maxQuotesPerMonth).toBe(1000);
    expect(e.multiSupplierAggregator).toBe(true);
    expect(e.showroomCalculator).toBe(true);
    expect(e.bulkImportMultiSite).toBe(true);
    expect(e.customDomain).toBe(false);
    expect(e.apiAccess).toBe(false);
  });
  test("enterprise (\"API\") is unlimited + custom domain + API", () => {
    const e = entitlementsFor("enterprise");
    expect(e.maxConfigurators).toBe(Infinity);
    expect(e.customDomain).toBe(true);
    expect(e.apiAccess).toBe(true);
    expect(e.gaebExport).toBe(true);
    expect(e.crmIntegration).toBe(true);
    expect(e.selfServeCheckout).toBe(false);
  });
  test("legacy 'starter'/'showroom' plan values still resolve (pre-migration rows)", () => {
    expect(entitlementsFor("starter").maxConfigurators).toBe(1);
    expect(entitlementsFor("showroom").maxConfigurators).toBe(Infinity);
    expect(entitlementsFor("showroom").publicWidget).toBe(true);
  });
  test("the retired alpha key falls back to base", () => {
    expect(entitlementsFor("alpha").maxConfigurators).toBe(1);
    expect(entitlementsFor("alpha").whiteLabel).toBe(false);
  });
  test("unknown plan falls back to base", () => {
    expect(entitlementsFor("nope").maxConfigurators).toBe(1);
  });
});

describe("resolveTenantEntitlements", () => {
  test("a base tenant does not get white-label", () => {
    const tenant = { plan: "base" } as Doc<"tenants">;
    expect(resolveTenantEntitlements(tenant).whiteLabel).toBe(false);
  });
  test("unlimitedAccess tenant gets everything, no limits", () => {
    const tenant = { plan: "base", unlimitedAccess: true } as Doc<"tenants">;
    const ent = resolveTenantEntitlements(tenant);
    expect(ent.maxConfigurators).toBe(Infinity);
    expect(ent.maxQuotesPerMonth).toBe(Infinity);
    expect(ent.maxTeamMembers).toBe(Infinity);
    expect(ent.whiteLabel).toBe(true);
    expect(ent.publicWidget).toBe(true);
    expect(ent.showroomCalculator).toBe(true);
    expect(ent.multiSupplierAggregator).toBe(true);
    expect(ent.apiAccess).toBe(true);
    expect(ent.gaebExport).toBe(true);
    expect(ent.crmIntegration).toBe(true);
    expect(ent.analytics).toBe("advanced");
    expect(ent.fieldModules).toBe("full");
    expect(ent.fiscalEngine).toBe("full");
  });
});

describe("quota gates", () => {
  test("assertQuota throws exactly at the limit, passes below, ignores Infinity", () => {
    expect(() => assertQuota(0, 1, "X")).not.toThrow();
    expect(() => assertQuota(1, 1, "X")).toThrow();
    expect(() => assertQuota(999, Infinity, "X")).not.toThrow();
  });
  test("checkQuota flags at 80% and blocks at 100%", () => {
    expect(checkQuota(3, 5).allowed).toBe(true);
    expect(checkQuota(4, 5).warning).toBeDefined();
    expect(checkQuota(5, 5).allowed).toBe(false);
  });
});

describe("createConfigurator enforces the plan limit", () => {
  test("base tenant is blocked on the 2nd configurator", async () => {
    const t = newDb();
    const A = await seedTenant(t, { plan: "base" });
    const asOwner = t.withIdentity({ subject: A.ownerId });

    const first = await asOwner.mutation(api.configurators.createConfigurator, {
      tenantId: A.tenantId,
      name: "First",
    });
    expect(first).toBeDefined();

    await expect(
      asOwner.mutation(api.configurators.createConfigurator, {
        tenantId: A.tenantId,
        name: "Second",
      }),
    ).rejects.toThrow(/CONFIGURATOR_QUOTA_EXCEEDED/);
  });

  test("business tenant can create 3", async () => {
    const t = newDb();
    const A = await seedTenant(t, { plan: "business" });
    const asOwner = t.withIdentity({ subject: A.ownerId });
    for (let i = 0; i < 3; i++) {
      await asOwner.mutation(api.configurators.createConfigurator, {
        tenantId: A.tenantId,
        name: `C${i}`,
      });
    }
    await expect(
      asOwner.mutation(api.configurators.createConfigurator, {
        tenantId: A.tenantId,
        name: "C4",
      }),
    ).rejects.toThrow(/CONFIGURATOR_QUOTA_EXCEEDED/);
  });
});
