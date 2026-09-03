import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("team invitations", () => {
  test("owner invites, invitee accepts, becomes a member", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "business" });
    const owner = t.withIdentity({ subject: ownerId });

    await owner.mutation(api.tenants.inviteMember, {
      tenantId,
      email: "New.Person@example.com",
      role: "member",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const pending = await owner.query(api.tenants.listInvitations, { tenantId });
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe("new.person@example.com");

    const token = await t.run(async (ctx) => {
      const inv = await ctx.db.query("invitations").first();
      return inv!.token;
    });

    // create the invitee user and accept
    const inviteeId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "new.person@example.com", emailVerificationTime: Date.now() }),
    );
    const res = await t
      .withIdentity({ subject: inviteeId })
      .mutation(api.tenants.acceptInvitation, { token });
    expect(res.tenantId).toBe(tenantId);

    const members = await owner.query(api.tenants.listMembers, { tenantId });
    expect(members.some((m) => m.userEmail === "new.person@example.com" && m.role === "member")).toBe(true);
    expect(await owner.query(api.tenants.listInvitations, { tenantId })).toHaveLength(0);
  });

  test("member (not owner/admin) cannot invite", async () => {
    const t = newDb();
    const { tenantId, memberId } = await seedTenant(t);
    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.tenants.inviteMember, {
        tenantId,
        email: "x@example.com",
        role: "member",
      }),
    ).rejects.toThrow();
  });

  test("seat quota blocks the invite when full", async () => {
    const t = newDb();
    // starter: maxTeamMembers = 2; seedTenant already makes 3 memberships (owner+admin+member)
    const { tenantId, ownerId } = await seedTenant(t, { plan: "starter" });
    await expect(
      t.withIdentity({ subject: ownerId }).mutation(api.tenants.inviteMember, {
        tenantId,
        email: "fourth@example.com",
        role: "member",
      }),
    ).rejects.toThrow(/MEMBER_LIMIT_REACHED/);
  });

  test("expired invitation cannot be accepted", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t, { plan: "business" });
    const token = "expiredtoken123456789012345678901";
    await t.run((ctx) =>
      ctx.db.insert("invitations", {
        tenantId,
        email: "late@example.com",
        role: "member",
        token,
        invitedByUserId: ownerId,
        expiresAt: Date.now() - 1000,
      }),
    );
    const uid = await t.run((ctx) =>
      ctx.db.insert("users", { email: "late@example.com", emailVerificationTime: Date.now() }),
    );
    await expect(
      t.withIdentity({ subject: uid }).mutation(api.tenants.acceptInvitation, { token }),
    ).rejects.toThrow(/EXPIRED/);
  });
});
