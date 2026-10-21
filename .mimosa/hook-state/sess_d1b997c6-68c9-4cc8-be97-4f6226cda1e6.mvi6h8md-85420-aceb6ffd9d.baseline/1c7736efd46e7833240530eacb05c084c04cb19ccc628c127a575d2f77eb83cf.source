import { describe, expect, test } from "vitest";
import { newDb, seedTenant } from "./_helpers";
import { roleAtLeast } from "../../convex/lib/rbac";
import { requirePermission } from "../../convex/lib/rbac";

describe("rbac: role hierarchy", () => {
  test("roleAtLeast ranks owner > admin > member", () => {
    expect(roleAtLeast("owner", "member")).toBe(true);
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("owner", "owner")).toBe(true);
    expect(roleAtLeast("admin", "owner")).toBe(false);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("bogus", "member")).toBe(false);
  });
});

describe("rbac: requirePermission combines role floor + plan ceiling", () => {
  test("a member is blocked from an admin-floor action regardless of plan", async () => {
    const t = newDb();
    const { tenantId, memberId } = await seedTenant(t, { plan: "enterprise" });
    await expect(
      t.run((ctx) => requirePermission(ctx as never, tenantId, "team.invite")),
    ).rejects.toThrow();
    void memberId;
  });

  test("an admin on Base clears the role floor but not the whiteLabel entitlement ceiling", async () => {
    const t = newDb();
    const { tenantId, adminId } = await seedTenant(t, { plan: "base" });
    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.run((ctx) => requirePermission(ctx as never, tenantId, "catalog.whiteLabel")),
    ).rejects.toThrow(/PLAN_UPGRADE_REQUIRED/);
  });

  test("an admin on Pro clears both the role floor and the whiteLabel entitlement", async () => {
    const t = newDb();
    const { tenantId, adminId } = await seedTenant(t, { plan: "pro" });
    const asAdmin = t.withIdentity({ subject: adminId });
    const res = await asAdmin.run((ctx) => requirePermission(ctx as never, tenantId, "catalog.whiteLabel"));
    expect(res.membership.role).toBe("admin");
  });

  test("an owner always clears an owner-floor action", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "base" });
    const asOwner = t.withIdentity({ subject: ownerId });
    const res = await asOwner.run((ctx) => requirePermission(ctx as never, tenantId, "billing.manage"));
    expect(res.membership.role).toBe("owner");
  });
});
