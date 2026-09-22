import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seedSettings(t: ReturnType<typeof newDb>, registrationOpen: boolean) {
  await t.run((ctx) =>
    ctx.db.insert("appSettings", { key: "global", registrationOpen, resendMode: "noop", updatedAt: Date.now() }),
  );
}

test("registerTenant: closed registration rejects, open creates a Base tenant", async () => {
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
  expect(tenant?.plan).toBe("base");
  expect(tenant?.createdVia).toBe("open_signup");
});
