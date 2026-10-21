import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { FULL_ACCESS_EMAILS, PARTNER_FULL_ACCESS_EMAILS, isFounderEmail, isFullAccessEmail } from "../../convex/lib/founding";
import { newDb } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function signUp(email: string) {
  const t = newDb();
  await t.run((ctx) => ctx.db.insert("appSettings", { key: "global", registrationOpen: true, resendMode: "noop", updatedAt: Date.now() }));
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Titolare", email, emailVerificationTime: Date.now() }));
  const as = t.withIdentity({ subject: userId });
  const { tenantId } = await as.mutation(api.tenants.registerTenant, { companyName: "Serramenti Demo Srl", country: "IT" });
  return { t, userId, as, tenantId };
}

describe("partner accounts: unlimited access, never admin", () => {
  test("the two partner addresses are on the list, in any letter case, and are not founders", () => {
    expect(PARTNER_FULL_ACCESS_EMAILS).toEqual(["eswindoors@gmail.com", "lujoe.solizioneinfissi@gmail.com"]);
    for (const e of PARTNER_FULL_ACCESS_EMAILS) {
      expect(isFullAccessEmail(e)).toBe(true);
      expect(isFullAccessEmail(` ${e.toUpperCase()} `)).toBe(true);
      expect(isFounderEmail(e)).toBe(false);
      expect(FULL_ACCESS_EMAILS).toContain(e);
    }
    expect(isFullAccessEmail("someone.else@gmail.com")).toBe(false);
    expect(isFullAccessEmail(null)).toBe(false);
  });

  test.each(PARTNER_FULL_ACCESS_EMAILS)("%s registers with unlimited access, active Enterprise, and is not a platform admin", async (email) => {
    const { t, userId, as, tenantId } = await signUp(email);
    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant).toMatchObject({ unlimitedAccess: true, plan: "enterprise", planStatus: "active" });
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.isPlatformAdmin).toBeFalsy();
    // Admin-only actions stay closed to them.
    await expect(as.mutation(api.tenants.setUnlimitedAccess, { tenantId, enabled: false })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
  });

  test("an ordinary address gets the normal flow (plan chosen later, limits apply)", async () => {
    const { t, tenantId } = await signUp("mario@example.com");
    expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({ plan: "base", planStatus: "pending_plan" });
    expect((await t.run((ctx) => ctx.db.get(tenantId)))?.unlimitedAccess).toBeUndefined();
  });

  test("the migration upgrades a partner's earlier company, never makes anyone admin, and is idempotent", async () => {
    const t = newDb();
    const ids = await t.run(async (ctx) => {
      const partner = await ctx.db.insert("users", { name: "P", email: "eswindoors@gmail.com" });
      const other = await ctx.db.insert("users", { name: "O", email: "other@example.com" });
      const mk = (owner: typeof partner) => ctx.db.insert("tenants", { name: "X", slug: `x-${owner}`, ownerUserId: owner, plan: "base", planStatus: "pending_plan", createdVia: "open_signup", createdAt: Date.now() });
      return { partner, other, pt: await mk(partner), ot: await mk(other) };
    });
    const first = await t.mutation(internal.migrations.grantFullAccessToPartners, {});
    expect(first).toMatchObject({ usersFound: 1, tenantsFlagged: 1, adminFlagsFound: 0 });
    expect(await t.run((ctx) => ctx.db.get(ids.pt))).toMatchObject({ unlimitedAccess: true, plan: "enterprise", planStatus: "active" });
    expect(await t.run((ctx) => ctx.db.get(ids.ot))).toMatchObject({ plan: "base", planStatus: "pending_plan" });
    expect((await t.run((ctx) => ctx.db.get(ids.partner)))?.isPlatformAdmin).toBeFalsy();
    expect(await t.mutation(internal.migrations.grantFullAccessToPartners, {})).toMatchObject({ tenantsFlagged: 0 });
  });
});
