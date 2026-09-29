import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";
import { LOCKED_LEAD_NAME } from "../../convex/lib/quotaLock";

/**
 * "Accetta ma blocca": on the widget-first plans a request over the monthly
 * cap is saved but its contact details never reach the tenant until upgrade
 * or next month. Full-platform plans keep today's flag-only behaviour.
 */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof newDb>;

async function setUsed(t: T, tenantId: Id<"tenants">, period: string, used: number) {
  await t.run(async (ctx) => {
    await ctx.db.insert("usageCounters", { tenantId, period, quoteRequestsCount: used, activeConfiguratorsCount: 0 });
  });
}

function submit(t: T, configuratorId: Id<"configurators">, publicId: string, n: number) {
  return t.mutation(internal.widget.insertQuote, {
    publicId,
    configuratorId,
    catalogVersion: 1,
    items: [sampleItem],
    leadName: `Cliente ${n}`,
    leadEmail: `cliente${n}@example.com`,
    leadPhone: "+39 333 000 0000",
    leadMessage: "Chiamatemi",
    leadLocale: "it",
  });
}

describe("widget-first plans: over-quota requests are saved but locked", () => {
  test("Essentials boundary 39 / 40 / 41: the 41st is locked and redacted on every read path", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "ESS0000001");
    await setUsed(t, s.tenantId, "2026-10", 38);

    const q39 = await submit(t, cfg, "ESS0000001", 39);
    const q40 = await submit(t, cfg, "ESS0000001", 40);
    const q41 = await submit(t, cfg, "ESS0000001", 41);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const raw = await t.run(async (ctx) => Promise.all([q39, q40, q41].map((id) => ctx.db.get(id))));
    expect(raw.map((q) => !!q?.quotaLocked)).toEqual([false, false, true]);
    // The stored document keeps the real data (unlock is lossless).
    expect(raw[2]?.leadEmail).toBe("cliente41@example.com");

    const as = t.withIdentity({ subject: s.ownerId });
    const list = await as.query(api.quotes.listRequests, { tenantId: s.tenantId });
    const locked = list.find((r) => r._id === q41)!;
    expect(locked.leadName).toBe(LOCKED_LEAD_NAME);
    expect(locked.leadEmail).toBe("");
    expect(locked.leadPhone).toBeUndefined();
    expect(locked.leadMessage).toBeUndefined();
    expect(locked.priceCents).toBeGreaterThan(0); // value stays visible
    expect(list.find((r) => r._id === q40)!.leadEmail).toBe("cliente40@example.com");

    const detail = await as.query(api.quotes.getRequest, { quoteId: q41 });
    expect(JSON.stringify(detail)).not.toContain("cliente41");
    // The printable document is never served for a locked request.
    expect(await as.query(api.quotes.getQuoteForPrint, { quoteId: q41 })).toEqual({ gate: "quote_locked" });

    const csv = await as.mutation(api.exports.exportRequestsCsv, { tenantId: s.tenantId });
    expect(JSON.stringify(csv)).not.toContain("cliente41@example.com");
    expect(JSON.stringify(csv)).toContain("cliente40@example.com");

    // Notifications (in-app + e-mail payload) never carry the locked lead.
    const notifs = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(JSON.stringify(notifs)).not.toContain("cliente41");
    expect(notifs.some((n) => n.type === "plan_limit")).toBe(true);
  });

  test("Essentials+ and Max lock at 80 and 200 (×2 / ×5)", async () => {
    for (const [plan, cap] of [["essentials_plus", 80], ["max", 200]] as const) {
      const t = newDb();
      const s = await seedTenant(t, { plan });
      const cfg = await seedPublishedConfigurator(t, s.tenantId, "CAP0000001");
      await setUsed(t, s.tenantId, "2026-10", cap - 1);
      const last = await submit(t, cfg, "CAP0000001", 1);
      const over = await submit(t, cfg, "CAP0000001", 2);
      const rows = await t.run(async (ctx) => [await ctx.db.get(last), await ctx.db.get(over)]);
      expect(rows.map((r) => !!r?.quotaLocked)).toEqual([false, true]);
    }
  });

  test("full-platform plans are unchanged: over quota is flagged, never locked", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "BASE000001");
    await setUsed(t, s.tenantId, "2026-10", 20);
    const id = await submit(t, cfg, "BASE000001", 1);
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.overQuota).toBe(true);
    expect(row?.quotaLocked).toBeUndefined();
    const list = await t.withIdentity({ subject: s.ownerId }).query(api.quotes.listRequests, { tenantId: s.tenantId });
    expect(list[0].leadEmail).toBe("cliente1@example.com");
  });

  test("founding / unlimited tenants on a widget plan are never locked", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { unlimitedAccess: true }));
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "UNL0000001");
    await setUsed(t, s.tenantId, "2026-10", 500);
    const id = await submit(t, cfg, "UNL0000001", 1);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBeUndefined();
  });

  test("upgrade unlocks; a later downgrade never re-locks", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "UPG0000001");
    await setUsed(t, s.tenantId, "2026-10", 40);
    const id = await submit(t, cfg, "UPG0000001", 1);
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBe(true);

    await t.run((ctx) => ctx.db.patch(s.tenantId, { plan: "essentials_plus" }));
    await t.mutation(internal.usage.unlockTenantLockedRequests, { tenantId: s.tenantId });
    expect((await t.run((ctx) => ctx.db.get(id)))?.quotaLocked).toBeUndefined();

    await t.run((ctx) => ctx.db.patch(s.tenantId, { plan: "essentials" }));
    const list = await t.withIdentity({ subject: s.ownerId }).query(api.quotes.listRequests, { tenantId: s.tenantId });
    expect(list[0].leadEmail).toBe("cliente1@example.com");
  });

  test("month rollover: last month's locked requests unlock, this month's stay locked", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "ROL0000001");
    await setUsed(t, s.tenantId, "2026-10", 40);
    const october = await submit(t, cfg, "ROL0000001", 1);

    vi.setSystemTime(new Date("2026-11-03T08:00:00Z"));
    await setUsed(t, s.tenantId, "2026-11", 40);
    const november = await submit(t, cfg, "ROL0000001", 2);

    await t.mutation(internal.usage.unlockPreviousPeriods, {});
    const rows = await t.run(async (ctx) => [await ctx.db.get(october), await ctx.db.get(november)]);
    expect(rows.map((r) => !!r?.quotaLocked)).toEqual([false, true]);
  });
});

describe("configurator cap", () => {
  test("counts existing configurators, not the ones created this month", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Primo" });
    await expect(as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Secondo" }))
      .rejects.toThrow("CONFIGURATOR_QUOTA_EXCEEDED");

    // Next month the per-period counter would have reset — the cap must not.
    vi.setSystemTime(new Date("2026-11-02T08:00:00Z"));
    await expect(as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Terzo" }))
      .rejects.toThrow("CONFIGURATOR_QUOTA_EXCEEDED");
  });

  test("Essentials+ allows 3, Max allows 10", async () => {
    for (const [plan, cap] of [["essentials_plus", 3], ["max", 10]] as const) {
      const t = newDb();
      const s = await seedTenant(t, { plan });
      const as = t.withIdentity({ subject: s.ownerId });
      for (let i = 0; i < cap; i++) {
        await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: `Conf ${i}` });
      }
      await expect(as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Oltre" }))
        .rejects.toThrow("CONFIGURATOR_QUOTA_EXCEEDED");
    }
  });

  test("after a downgrade only the oldest configurators within the cap keep serving", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "max" });
    const first = await seedPublishedConfigurator(t, s.tenantId, "DWN0000001");
    const second = await seedPublishedConfigurator(t, s.tenantId, "DWN0000002");
    await t.run((ctx) => ctx.db.patch(s.tenantId, { plan: "essentials" }));

    const a = await t.query(api.widget.getPublicConfigurator, { publicId: "DWN0000001" });
    const b = await t.query(api.widget.getPublicConfigurator, { publicId: "DWN0000002" });
    expect(a?.overPlanLimit).toBe(false);
    expect(b?.overPlanLimit).toBe(true);

    const okId = await submit(t, first, "DWN0000001", 1);
    const lockedId = await submit(t, second, "DWN0000002", 2);
    const rows = await t.run(async (ctx) => [await ctx.db.get(okId), await ctx.db.get(lockedId)]);
    expect(rows.map((r) => !!r?.quotaLocked)).toEqual([false, true]);
  });
});

describe("white-label follows the CURRENT plan", () => {
  test("Essentials shows the badge even if the branding row was white-labelled on a higher plan", async () => {
    const t = newDb();
    const cases = [["essentials", false], ["essentials_plus", true], ["max", true], ["base", false], ["pro", true]] as const;
    for (const [i, [plan, expected]] of cases.entries()) {
      const s = await seedTenant(t, { plan });
      const publicId = `WLCASE000${i}`;
      const cfg = await seedPublishedConfigurator(t, s.tenantId, publicId);
      await t.run((ctx) =>
        ctx.db.insert("branding", {
          tenantId: s.tenantId, configuratorId: cfg, whiteLabel: true, colorAccent: "#000000", colorAccentInk: "#ffffff",
          fontFamily: "geist", copy: {}, companyInfo: { name: "X" },
        }),
      );
      const res = await t.query(api.widget.getPublicConfigurator, { publicId });
      expect([plan, res?.branding.whiteLabel]).toEqual([plan, expected]);
    }
  });
});

describe("cancelled / suspended subscription (founder's decisions A + B)", () => {
  test("A: a suspended tenant's widget stops serving on EVERY plan; stray submissions are saved but locked", async () => {
    const t = newDb();
    for (const [i, plan] of (["essentials_plus", "pro", "base", "agency"] as const).entries()) {
      const s = await seedTenant(t, { plan });
      const publicId = `SUSP00000${i}`;
      const cfg = await seedPublishedConfigurator(t, s.tenantId, publicId);
      await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "suspended" }));
      expect([plan, (await t.query(api.widget.getPublicConfigurator, { publicId }))?.overPlanLimit]).toEqual([plan, true]);
      const id = await submit(t, cfg, publicId, i);
      const row = await t.run((ctx) => ctx.db.get(id));
      expect(row?.suspendedLocked).toBe(true);
      expect(row?.quotaLocked).toBeUndefined();
      const list = await t.withIdentity({ subject: s.ownerId }).query(api.quotes.listRequests, { tenantId: s.tenantId });
      expect(list[0].leadEmail).toBe("");
    }
  });

  test("B: the monthly sweep does NOT unlock them; reactivation does", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "REAC000001");
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "suspended", stripeCustomerId: "cus_reac", stripeSubscriptionId: "sub_reac" }));
    const id = await submit(t, cfg, "REAC000001", 1);

    vi.setSystemTime(new Date("2026-11-05T08:00:00Z"));
    await t.mutation(internal.usage.unlockPreviousPeriods, {});
    expect((await t.run((ctx) => ctx.db.get(id)))?.suspendedLocked).toBe(true);

    await t.mutation(internal.billing.applyWebhookEvent, {
      eventId: "evt_reactivate",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_reac", customer: "cus_reac", status: "active", items: { data: [] } } },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.suspendedLocked).toBeUndefined();
    const list = await t.withIdentity({ subject: s.ownerId }).query(api.quotes.listRequests, { tenantId: s.tenantId });
    expect(list[0].leadEmail).toBe("cliente1@example.com");
  });

  test("B: an admin reactivation unlocks too", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "REAC000002");
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "suspended" }));
    const id = await submit(t, cfg, "REAC000002", 1);
    const adminId = await t.run((ctx) => ctx.db.insert("users", { name: "pa", email: "pa@example.com", emailVerificationTime: Date.now(), isPlatformAdmin: true }));
    await t.withIdentity({ subject: adminId }).mutation(api.tenants.reactivateTenant, { tenantId: s.tenantId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(id)))?.suspendedLocked).toBeUndefined();
  });

  test("past_due (payment retrying) keeps serving: leads arrive normally", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "PDUE000001");
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "past_due" }));
    expect((await t.query(api.widget.getPublicConfigurator, { publicId: "PDUE000001" }))?.overPlanLimit).toBe(false);
    const id = await submit(t, cfg, "PDUE000001", 1);
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.suspendedLocked).toBeUndefined();
    expect(row?.quotaLocked).toBeUndefined();
  });
});
