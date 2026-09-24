import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("onboarding wizard state", () => {
  test("sales-led tenant needs no billing; advance + complete update the tenant", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t, { plan: "enterprise" });
    const as = t.withIdentity({ subject: ownerId });

    let s = await as.query(api.onboarding.getState);
    expect(s.hasTenant).toBe(true);
    if (!s.hasTenant) return;
    expect(s.completed).toBe(false);
    expect(s.needsPlan).toBe(false); // already has an active plan
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

  test("pending_plan tenant must pick a plan before completing onboarding", async () => {
    const t = newDb();
    const { ownerId, tenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "pending_plan" }));
    const as = t.withIdentity({ subject: ownerId });

    let s = await as.query(api.onboarding.getState);
    if (!s.hasTenant) throw new Error("expected a tenant");
    expect(s.needsPlan).toBe(true);

    // Can't complete onboarding while still pending_plan.
    await expect(as.mutation(api.onboarding.complete)).rejects.toThrow(/PLAN_SELECTION_REQUIRED/);

    // Dormant Stripe: selectPlan activates immediately (no payment to collect yet).
    await as.mutation(api.onboarding.selectPlan, { plan: "pro" });
    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant?.plan).toBe("pro");
    expect(tenant?.planStatus).toBe("trialing");

    s = await as.query(api.onboarding.getState);
    if (s.hasTenant) expect(s.needsPlan).toBe(false);

    await as.mutation(api.onboarding.complete);
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
