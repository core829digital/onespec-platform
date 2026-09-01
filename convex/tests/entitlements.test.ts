import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import {
  entitlementsFor,
  resolveTenantEntitlements,
  assertQuota,
  checkQuota,
} from "../lib/entitlements";
import { newDb, seedTenant } from "./_helpers";
import type { Doc } from "../_generated/dataModel";

describe("entitlement matrix matches the verified pricing page", () => {
  test("starter", () => {
    const e = entitlementsFor("starter");
    expect(e.maxConfigurators).toBe(1);
    expect(e.maxQuotesPerMonth).toBe(50);
    expect(e.whiteLabel).toBe(false);
    expect(e.customDomain).toBe(false);
    expect(e.lifetimeDiscountPct).toBe(0);
  });
  test("business", () => {
    const e = entitlementsFor("business");
    expect(e.maxConfigurators).toBe(3);
    expect(e.maxQuotesPerMonth).toBe(300);
    expect(e.whiteLabel).toBe(true);
    expect(e.advancedPricingRules).toBe(true);
    expect(e.customDomain).toBe(false);
  });
  test("enterprise is unlimited + custom domain + API", () => {
    const e = entitlementsFor("enterprise");
    expect(e.maxConfigurators).toBe(Infinity);
    expect(e.maxQuotesPerMonth).toBe(Infinity);
    expect(e.customDomain).toBe(true);
    expect(e.apiAccess).toBe(true);
    expect(e.bulkImportMultiSite).toBe(true);
  });
  test("alpha = business + locked 15% discount", () => {
    const e = entitlementsFor("alpha");
    expect(e.maxConfigurators).toBe(3);
    expect(e.whiteLabel).toBe(true);
    expect(e.lifetimeDiscountPct).toBe(15);
  });
  test("unknown plan falls back to starter", () => {
    expect(entitlementsFor("nope").maxConfigurators).toBe(1);
  });
});

describe("resolveTenantEntitlements", () => {
  test("an alpha tenant keeps white-label + discount even if stored plan drifts", () => {
    const tenant = { plan: "starter", isAlpha: true } as Doc<"tenants">;
    const e = resolveTenantEntitlements(tenant);
    expect(e.whiteLabel).toBe(true);
    expect(e.lifetimeDiscountPct).toBe(15);
  });
  test("a non-alpha starter tenant does not get white-label", () => {
    const tenant = { plan: "starter", isAlpha: false } as Doc<"tenants">;
    expect(resolveTenantEntitlements(tenant).whiteLabel).toBe(false);
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
  test("starter tenant is blocked on the 2nd configurator", async () => {
    const t = newDb();
    const A = await seedTenant(t, { plan: "starter" });
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
    ).rejects.toThrow(/CONFIGURATOR_LIMIT_REACHED/);
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
    ).rejects.toThrow(/CONFIGURATOR_LIMIT_REACHED/);
  });
});
