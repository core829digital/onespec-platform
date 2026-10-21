import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/** GDPR Art. 17: a deletion request is actually executed after the 30-day grace period. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("account deletion execution", () => {
  test("after 30 days the member is anonymised, signed out and removed; nothing before that", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", { tenantId: s.tenantId, userId: s.memberId, type: "system", title: "x" });
      const accountId = await ctx.db.insert("authAccounts", { userId: s.memberId, provider: "password", providerAccountId: "m@example.com" });
      await ctx.db.insert("authVerificationCodes", { accountId, provider: "password", code: "123", expirationTime: Date.now() + 1000 });
      const sessionId = await ctx.db.insert("authSessions", { userId: s.memberId, expirationTime: Date.now() + 1e9 });
      await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e9 });
    });
    await t.withIdentity({ subject: s.memberId }).mutation(api.account.requestDeletion, {});

    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 0, skipped: 0 });

    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 1, skipped: 0 });

    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(s.memberId),
      membership: await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", s.memberId)).first(),
      accounts: await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", s.memberId)).collect(),
      sessions: await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", s.memberId)).collect(),
      refresh: await ctx.db.query("authRefreshTokens").collect(),
      codes: await ctx.db.query("authVerificationCodes").collect(),
      notifications: await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", s.memberId)).collect(),
      request: await ctx.db.query("deletionRequests").withIndex("by_user", (q) => q.eq("userId", s.memberId)).first(),
    }));
    expect(state.user).toMatchObject({ name: "Utente eliminato" });
    expect(state.user?.email).toBeUndefined();
    expect(state.membership?.status).toBe("removed");
    expect(state.accounts).toHaveLength(0);
    expect(state.sessions).toHaveLength(0);
    expect(state.refresh).toHaveLength(0);
    expect(state.codes).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(state.request).toMatchObject({ status: "completed", email: "" });
    // Another run is a no-op.
    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 0, skipped: 0 });
  });

  test("a cancelled request is never executed", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: s.memberId });
    await as.mutation(api.account.requestDeletion, {});
    await as.mutation(api.account.cancelDeletion, {});
    vi.setSystemTime(new Date("2026-12-01T10:00:00Z"));
    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 0, skipped: 0 });
    expect((await t.run((ctx) => ctx.db.get(s.memberId)))?.email).toBeDefined();
  });

  test("a user who became sole owner meanwhile is skipped (tenant never orphaned)", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    // Request as admin, then promote to sole owner (demote the real owner).
    await t.withIdentity({ subject: s.adminId }).mutation(api.account.requestDeletion, {});
    await t.run(async (ctx) => {
      for (const m of await ctx.db.query("memberships").withIndex("by_tenant", (q) => q.eq("tenantId", s.tenantId)).collect()) {
        if (m.userId === s.adminId) await ctx.db.patch(m._id, { role: "owner" });
        if (m.userId === s.ownerId) await ctx.db.patch(m._id, { role: "member" });
      }
    });
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 0, skipped: 1 });
  });

  test("retention purges notifications older than a year only", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    await t.run((ctx) => ctx.db.insert("notifications", { tenantId: s.tenantId, userId: s.ownerId, type: "system", title: "old" }));
    vi.setSystemTime(new Date("2027-10-15T10:00:00Z"));
    await t.run((ctx) => ctx.db.insert("notifications", { tenantId: s.tenantId, userId: s.ownerId, type: "system", title: "new" }));
    expect(await t.mutation(internal.account.purgeOldNotifications, {})).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(left.map((n) => n.title)).toEqual(["new"]);
  });
});
