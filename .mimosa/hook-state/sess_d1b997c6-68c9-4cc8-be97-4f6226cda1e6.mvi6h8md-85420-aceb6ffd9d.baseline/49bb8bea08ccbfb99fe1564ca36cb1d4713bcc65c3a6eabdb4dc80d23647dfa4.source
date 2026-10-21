import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

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
  await expect(asAdmin.query(api.admin.getMarketPreview, { regionCode: "XX" })).rejects.toThrow(
    /UNKNOWN_REGION/,
  );
});

test("admin.getMarketPreview requires platform admin", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  await expect(asOwner.query(api.admin.getMarketPreview, { regionCode: "IT" })).rejects.toThrow();
});

test("admin.getMarketPreview returns all six markets", async () => {
  const t = newDb();
  const adminId = await makePlatformAdmin(t);
  const asAdmin = t.withIdentity({ subject: adminId });

  const it = await asAdmin.query(api.admin.getMarketPreview, { regionCode: "IT" });
  expect(it.installation.norm).toContain("UNI 11673");
  expect(it.funding.hasPortalXml).toBe(true);

  for (const code of ["FR", "BE", "NL", "DE", "LU"]) {
    const m = await asAdmin.query(api.admin.getMarketPreview, { regionCode: code });
    expect(m.regionCode).toBe(code);
    expect(m.installation.norm.length).toBeGreaterThan(0);
    expect(m.funding.title.length).toBeGreaterThan(0);
    expect(m.funding.hasPortalXml).toBe(false);
    expect(m.vatRates.length).toBeGreaterThan(0);
  }
});
