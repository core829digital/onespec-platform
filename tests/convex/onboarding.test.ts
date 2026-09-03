import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("onboarding wizard state", () => {
  test("alpha tenant needs no billing; advance + complete update the tenant", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t, { plan: "alpha", isAlpha: true });
    const as = t.withIdentity({ subject: ownerId });

    let s = await as.query(api.onboarding.getState);
    expect(s.hasTenant).toBe(true);
    if (!s.hasTenant) return;
    expect(s.completed).toBe(false);
    expect(s.needsBilling).toBe(false); // alpha + no stripe key
    expect(s.step).toBe("welcome");
    expect(s.entitlements.whiteLabel).toBe(true);

    await as.mutation(api.onboarding.advance, { step: "team" });
    s = await as.query(api.onboarding.getState);
    if (s.hasTenant) expect(s.step).toBe("team");

    await as.mutation(api.onboarding.complete);
    s = await as.query(api.onboarding.getState);
    if (s.hasTenant) expect(s.completed).toBe(true);

    // idempotent: advancing after completion is a no-op
    await as.mutation(api.onboarding.advance, { step: "welcome" });
    s = await as.query(api.onboarding.getState);
    if (s.hasTenant) expect(s.completed).toBe(true);
  });

  test("a non-member has no onboarding state", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    // memberId IS a member here — use a fresh user with no tenant
    const strangerId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "x@example.com", emailVerificationTime: Date.now() }),
    );
    const s = await t.withIdentity({ subject: strangerId }).query(api.onboarding.getState);
    expect(s.hasTenant).toBe(false);
    void memberId;
  });
});
