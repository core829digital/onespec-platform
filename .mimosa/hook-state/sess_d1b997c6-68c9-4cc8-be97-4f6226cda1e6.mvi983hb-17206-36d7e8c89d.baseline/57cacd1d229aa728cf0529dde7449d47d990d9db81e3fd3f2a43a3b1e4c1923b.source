import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { fillOnboardingProfile, newDb, seedTenant } from "./_helpers";

describe("onboarding wizard state", () => {
  test("sales-led tenant needs no billing; advance + complete update the tenant", async () => {
    const t = newDb();
    const { ownerId, tenantId } = await seedTenant(t, { plan: "enterprise" });
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

    // Cannot finish with the company, address, contacts, tax and prices steps empty.
    await expect(as.mutation(api.onboarding.complete)).rejects.toThrow(/ONBOARDING_INCOMPLETE/);
    await fillOnboardingProfile(t, tenantId);
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

    await fillOnboardingProfile(t, tenantId);
    await as.mutation(api.onboarding.complete);
  });

  test("dormant selectPlan: only Pro is trialing, Base/Agency activate immediately", async () => {
    const t = newDb();
    const { ownerId: baseOwnerId, tenantId: baseTenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(baseTenantId, { planStatus: "pending_plan" }));
    await t.withIdentity({ subject: baseOwnerId }).mutation(api.onboarding.selectPlan, { plan: "base" });
    const baseTenant = await t.run((ctx) => ctx.db.get(baseTenantId));
    expect(baseTenant?.planStatus).toBe("active");

    const { ownerId: agencyOwnerId, tenantId: agencyTenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(agencyTenantId, { planStatus: "pending_plan" }));
    await t.withIdentity({ subject: agencyOwnerId }).mutation(api.onboarding.selectPlan, { plan: "agency" });
    const agencyTenant = await t.run((ctx) => ctx.db.get(agencyTenantId));
    expect(agencyTenant?.planStatus).toBe("active");
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

describe("full-access accounts (founders, platform admin)", () => {
  test("billing counts as active: no plan step, completes without a plan, and the wizard can be reopened", async () => {
    const t = newDb();
    const { ownerId, tenantId } = await seedTenant(t, { plan: "base" });
    await t.run((ctx) => ctx.db.patch(tenantId, { planStatus: "pending_plan", unlimitedAccess: true }));
    const as = t.withIdentity({ subject: ownerId });

    const s = await as.query(api.onboarding.getState);
    if (!s.hasTenant) throw new Error("expected a tenant");
    expect(s.needsPlan).toBe(false);
    expect(s.fullAccess).toBe(true);

    await fillOnboardingProfile(t, tenantId);
    await as.mutation(api.onboarding.complete);
    const done = await t.run((ctx) => ctx.db.get(tenantId));
    expect(done?.planStatus).toBe("active");
    expect(done?.plan).toBe("enterprise");
    expect(done?.onboardingCompletedAt).toBeDefined();

    // Data removed / wants to look again: the wizard comes back, still without billing.
    await as.mutation(api.onboarding.restart);
    const reopened = await t.run((ctx) => ctx.db.get(tenantId));
    expect(reopened?.onboardingCompletedAt).toBeUndefined();
    const s2 = await as.query(api.onboarding.getState);
    if (s2.hasTenant) {
      expect(s2.completed).toBe(false);
      expect(s2.needsPlan).toBe(false);
    }
  });

  test("an ordinary account cannot reopen the wizard", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: ownerId });
    await expect(as.mutation(api.onboarding.restart)).rejects.toThrow(/INSUFFICIENT_ROLE/);
  });
});
