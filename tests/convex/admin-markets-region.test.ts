import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import type { RegionCode } from "../../convex/lib/regions";
import { newDb, seedTenant } from "./_helpers";

/**
 * Admin market preview (#68 hardening delta): getMarketPreview's region arg is
 * now the union validator, so an unknown region is rejected at the args level
 * instead of flowing through an unvalidated cast.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makePlatformAdmin(t: ReturnType<typeof newDb>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "admin",
      email: "contact.core829@gmail.com",
      emailVerificationTime: Date.now(),
      isPlatformAdmin: true,
    });
    return userId;
  });
}

test("admin.getMarketPreview rejects unknown region", async () => {
  const t = newDb();
  const adminId = await makePlatformAdmin(t);
  const asAdmin = t.withIdentity({ subject: adminId });
  const badRegion = ["X", "X"].join("") as RegionCode;
  const badArgs = { regionCode: badRegion };
  await expect(asAdmin.query(api.admin.getMarketPreview, badArgs)).rejects.toThrow();
});

test("admin.getMarketPreview requires platform admin", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const itArgs = { regionCode: "IT" as RegionCode };
  await expect(asOwner.query(api.admin.getMarketPreview, itArgs)).rejects.toThrow();
});

test("admin.getMarketPreview returns all six markets", async () => {
  const t = newDb();
  const adminId = await makePlatformAdmin(t);
  const asAdmin = t.withIdentity({ subject: adminId });

  const itArgs = { regionCode: "IT" as RegionCode };
  const it = await asAdmin.query(api.admin.getMarketPreview, itArgs);
  expect(it.installation.norm).toContain("UNI 11673");
  expect(it.funding.hasPortalXml).toBe(true);

  for (const code of ["FR", "BE", "NL", "DE", "LU"] as RegionCode[]) {
    const mArgs = { regionCode: code };
    const m = await asAdmin.query(api.admin.getMarketPreview, mArgs);
    expect(m.regionCode).toBe(code);
    expect(m.installation.norm.length).toBeGreaterThan(0);
    expect(m.funding.title.length).toBeGreaterThan(0);
    expect(m.funding.hasPortalXml).toBe(false);
    expect(m.vatRates.length).toBeGreaterThan(0);
  }
});
