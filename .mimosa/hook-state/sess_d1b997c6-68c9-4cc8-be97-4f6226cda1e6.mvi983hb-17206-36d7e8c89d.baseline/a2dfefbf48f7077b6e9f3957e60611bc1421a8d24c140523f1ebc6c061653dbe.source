import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("account profile + consent", () => {
  test("updateProfile validates the name length", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t);
    const as = t.withIdentity({ subject: ownerId });
    await expect(as.mutation(api.account.updateProfile, { name: "" })).rejects.toThrow(/INVALID_NAME/);
    await as.mutation(api.account.updateProfile, { name: "  Giulia  ", locale: "fr" });
    const p = await as.query(api.account.getProfile);
    expect(p?.name).toBe("Giulia");
    expect(p?.locale).toBe("fr");
  });

  test("consent defaults: product updates on, marketing off; toggles persist", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t);
    const as = t.withIdentity({ subject: ownerId });
    let p = await as.query(api.account.getProfile);
    expect(p?.consent).toEqual({ productUpdates: true, marketing: false });
    await as.mutation(api.account.setConsent, { marketing: true });
    p = await as.query(api.account.getProfile);
    expect(p?.consent.marketing).toBe(true);
  });
});

describe("account deletion (GDPR)", () => {
  test("sole owner is blocked until ownership is transferred", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t);
    await expect(
      t.withIdentity({ subject: ownerId }).mutation(api.account.requestDeletion, {}),
    ).rejects.toThrow(/SOLE_OWNER/);
  });

  test("a non-owner member can request and then cancel deletion", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    const as = t.withIdentity({ subject: memberId });
    const res = await as.mutation(api.account.requestDeletion, { reason: "non serve più" });
    expect(res.scheduledFor).toBeGreaterThan(Date.now());

    let p = await as.query(api.account.getProfile);
    expect(p?.pendingDeletion).not.toBeNull();

    await as.mutation(api.account.cancelDeletion);
    p = await as.query(api.account.getProfile);
    expect(p?.pendingDeletion).toBeNull();

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action", (q) => q.eq("action", "account.deletion_requested"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
  });

  test("exportMyData returns a JSON blob with the account section", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    const res = await t
      .withIdentity({ subject: memberId })
      .mutation(api.account.exportMyData);
    const parsed = JSON.parse(res.content);
    expect(parsed.account.id).toBe(memberId);
    expect(res.filename).toMatch(/onespec-dati-\d{4}-\d{2}-\d{2}\.json/);
  });
});

describe("session revocation", () => {
  test("revokeSession deletes only the caller's own session + its refresh tokens", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t);
    const { sid } = await t.run(async (ctx) => {
      const s = await ctx.db.insert("authSessions", {
        userId: ownerId,
        expirationTime: Date.now() + 1_000_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId: s,
        expirationTime: Date.now() + 1_000_000,
      });
      return { sid: s };
    });

    await t.withIdentity({ subject: ownerId }).mutation(api.account.revokeSession, { sessionId: sid });

    const left = await t.run((ctx) => ctx.db.get(sid));
    expect(left).toBeNull();
    const tokens = await t.run((ctx) =>
      ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", sid)).collect(),
    );
    expect(tokens).toHaveLength(0);
  });
});
