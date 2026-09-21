import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ADMIN = "contact.core829@gmail.com";

async function seedSettings(t: ReturnType<typeof newDb>, registrationOpen: boolean) {
  await t.run((ctx) =>
    ctx.db.insert("appSettings", { key: "global", registrationOpen, resendMode: "noop", updatedAt: Date.now() }),
  );
}

test("registerTenant: closed registration rejects, open creates a Starter tenant with no Alpha fields", async () => {
  const t = newDb();
  await seedSettings(t, false);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "New", email: "new@example.com", emailVerificationTime: Date.now() }),
  );
  const as = t.withIdentity({ subject: userId });

  await expect(as.mutation(api.tenants.registerTenant, { companyName: "Acme" })).rejects.toThrow();

  await expect(as.mutation(api.registration.toggleRegistration, { open: true })).rejects.toThrow(); // only platform admins
  await t.run(async (ctx) => {
    const s = await ctx.db.query("appSettings").first();
    await ctx.db.patch(s!._id, { registrationOpen: true });
  });

  const res = await as.mutation(api.tenants.registerTenant, { companyName: "Acme" });
  const tenant = await t.run((ctx) => ctx.db.get(res.tenantId));
  expect(tenant?.plan).toBe("starter");
  expect(tenant?.isAlpha).toBeUndefined();
  expect(tenant?.alphaSeatNumber).toBeUndefined();
  expect(tenant?.createdVia).toBe("open_signup");
  const seats = await t.run((ctx) => ctx.db.query("alphaSeats").collect());
  expect(seats).toHaveLength(0);
});

test("retireAlpha: dry run changes nothing; apply moves admin to Showroom, others to Starter (grandfathered), clears seats; idempotent", async () => {
  const t = newDb();
  await seedSettings(t, false);
  const adminTenant = await seedTenant(t, { plan: "alpha", isAlpha: true });
  const other = await seedTenant(t, { plan: "alpha", isAlpha: true });
  const paying = await seedTenant(t, { plan: "pro" });

  await t.run(async (ctx) => {
    await ctx.db.patch(adminTenant.ownerId, { email: ADMIN });
    await ctx.db.patch(adminTenant.tenantId, { alphaSeatNumber: 1 });
    await ctx.db.patch(other.tenantId, { alphaSeatNumber: 2 });
    for (const [n, s] of [[1, adminTenant], [2, other]] as const) {
      await ctx.db.insert("alphaSeats", { seatNumber: n, tenantId: s.tenantId, userId: s.ownerId, email: `s${n}@x.com`, claimedAt: 1 });
    }
    const settings = await ctx.db.query("appSettings").first();
    await ctx.db.patch(settings!._id, { alphaSeatCap: 250, alphaSeatsClaimed: 2 });
  });

  const dry = await t.mutation(internal.migrations.retireAlpha, { adminEmail: ADMIN });
  expect(dry.applied).toBe(false);
  expect(dry.adminTenantFound).toBe(true);
  expect(dry.changes.map((c) => c.to).sort()).toEqual(["showroom", "starter"]);
  expect((await t.run((ctx) => ctx.db.get(other.tenantId)))?.plan).toBe("alpha");
  expect(await t.run((ctx) => ctx.db.query("alphaSeats").collect())).toHaveLength(2);

  const applied = await t.mutation(internal.migrations.retireAlpha, { adminEmail: ADMIN, apply: true });
  expect(applied.applied).toBe(true);

  const after = await t.run(async (ctx) => ({
    admin: await ctx.db.get(adminTenant.tenantId),
    other: await ctx.db.get(other.tenantId),
    paying: await ctx.db.get(paying.tenantId),
    seats: await ctx.db.query("alphaSeats").collect(),
    settings: await ctx.db.query("appSettings").first(),
    audits: await ctx.db.query("auditLog").withIndex("by_action", (q) => q.eq("action", "alpha.retire")).collect(),
  }));
  expect(after.admin?.plan).toBe("showroom");
  expect(after.admin?.isAlpha).toBeUndefined();
  expect(after.admin?.alphaSeatNumber).toBeUndefined();
  expect(after.other?.plan).toBe("starter");
  expect(after.other?.quotaOverrideQuotesPerMonth).toBe(50);
  expect(after.other?.createdVia).toBe("open_signup");
  expect(after.paying?.plan).toBe("pro");
  expect(after.seats).toHaveLength(0);
  expect(after.settings?.alphaSeatCap).toBeUndefined();
  expect(after.audits).toHaveLength(2);

  const again = await t.mutation(internal.migrations.retireAlpha, { adminEmail: ADMIN, apply: true });
  expect(again.changes).toHaveLength(0);
});
