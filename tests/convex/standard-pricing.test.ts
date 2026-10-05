import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";
import { LEGACY_PVC_PROFILE_KEYS, STANDARD_PROFILES, toSupplyCents } from "../../src/shared/standard-pricing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function italianTenant(zone?: "nord" | "centro" | "sud") {
  const t = newDb();
  const s = await seedTenant(t, { plan: "agency" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country: "IT", ...(zone ? { priceZone: zone } : {}) }));
  return { t, s, as: t.withIdentity({ subject: s.ownerId }), asMember: t.withIdentity({ subject: s.memberId }) };
}

const profiles = (t: Awaited<ReturnType<typeof italianTenant>>["t"], id: Id<"configurators">) =>
  t.run((ctx) => ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", id)).collect());

describe("standard price list in the catalogue", () => {
  test("a new Italian configurator with a zone starts on the standard list, nothing deleted", async () => {
    const { t, s, as } = await italianTenant("centro");
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Nuovo" });
    const c = await t.run((ctx) => ctx.db.get(configuratorId));
    expect(c?.pricingMode).toBe("standard");
    const rows = await profiles(t, configuratorId);
    expect(rows.filter((r) => r.standardKey)).toHaveLength(STANDARD_PROFILES.length);
    // Older profiles are still there, only switched off.
    const legacy = rows.filter((r) => r.materialKey === "pvc" && !r.standardKey && LEGACY_PVC_PROFILE_KEYS.includes(r.key));
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy.every((r) => r.enabled === false)).toBe(true);
  });

  test("without a zone the configurator is created in the old mode", async () => {
    const { t, s, as } = await italianTenant();
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Senza zona" });
    expect((await t.run((ctx) => ctx.db.get(configuratorId)))?.pricingMode).toBeUndefined();
    await expect(as.mutation(api.pricing.applyStandard, { configuratorId })).rejects.toThrow(/PRICE_ZONE_REQUIRED/);
  });

  test("applying twice is idempotent and never overwrites an edited price", async () => {
    const { t, s, as } = await italianTenant();
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test X" });
    // Edit one seeded option before opting in: it must survive.
    const edited = await t.run(async (ctx) => {
      const row = (await ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect()).find((h) => h.kind === "sashType" && h.key === "tiltturn")!;
      await ctx.db.patch(row._id, { priceCents: 7777 });
      return row._id;
    });
    await as.mutation(api.pricing.setPriceZone, { tenantId: s.tenantId, zone: "nord" });
    const first = await as.mutation(api.pricing.applyStandard, { configuratorId });
    expect(first.profilesAdded).toBe(STANDARD_PROFILES.length);
    expect((await t.run((ctx) => ctx.db.get(edited)))?.priceCents).toBe(7777);
    const before = (await profiles(t, configuratorId)).length;
    const second = await as.mutation(api.pricing.applyStandard, { configuratorId });
    expect(second).toMatchObject({ profilesAdded: 0, profilesDisabled: 0, optionsReset: 0, glazingUpdated: 0, finishUpdated: 0 });
    expect(await profiles(t, configuratorId)).toHaveLength(before);
  });

  test("setMargin accepts two decimals, refuses the rest; a member cannot change it", async () => {
    const { s, as, asMember } = await italianTenant("sud");
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test M" });
    expect(await as.mutation(api.pricing.setMargin, { configuratorId, marginPercent: 17.5 })).toEqual({ marginPercent: 17.5 });
    expect(await as.mutation(api.pricing.setMargin, { configuratorId, marginPercent: 0 })).toEqual({ marginPercent: 0 });
    for (const bad of [-1, 300.01, 12.345, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(as.mutation(api.pricing.setMargin, { configuratorId, marginPercent: bad })).rejects.toThrow(/INVALID_INPUT/);
    }
    await expect(asMember.mutation(api.pricing.setMargin, { configuratorId, marginPercent: 10 })).rejects.toThrow();
  });

  test("setPriceZone needs the settings permission and rejects an unknown zone", async () => {
    const { s, as, asMember } = await italianTenant();
    await expect(asMember.mutation(api.pricing.setPriceZone, { tenantId: s.tenantId, zone: "sud" })).rejects.toThrow();
    // @ts-expect-error invalid zone on purpose
    await expect(as.mutation(api.pricing.setPriceZone, { tenantId: s.tenantId, zone: "isole" })).rejects.toThrow();
    await as.mutation(api.pricing.setPriceZone, { tenantId: s.tenantId, zone: "sud" });
  });

  test("publish puts the zone's prices and the margin in the snapshot; custom mode switches it off", async () => {
    const { t, s, as } = await italianTenant("nord");
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Test P" });
    await as.mutation(api.pricing.setMargin, { configuratorId, marginPercent: 12.5 });
    await as.mutation(api.configurators.publishConfigurator, { configuratorId });
    const v = await t.run((ctx) => ctx.db.query("catalogVersions").withIndex("by_configurator_version", (q) => q.eq("configuratorId", configuratorId).eq("version", 1)).unique());
    const payload = v!.payload as { configurator: { pricingMode?: string; marginPercent?: number }; profileSystems: Array<{ key: string; standard?: { completePerM2Cents: number } }> };
    expect(payload.configurator).toMatchObject({ pricingMode: "standard", marginPercent: 12.5 });
    const row = payload.profileSystems.find((p) => p.key === "std_aluplast_ideal_4000");
    // Nord: market complete 260-310 EUR/m2 -> mid 285 -> supply price after the calibration factor.
    expect(row?.standard?.completePerM2Cents).toBe(toSupplyCents(28500));
    await as.mutation(api.pricing.useCustomPricing, { configuratorId });
    expect((await t.run((ctx) => ctx.db.get(configuratorId)))?.pricingMode).toBe("custom");
  });

  test("applyStandardEverywhere prices only Italian configurators without a mode that have a zone", async () => {
    const { t, s, as } = await italianTenant("centro");
    const { configuratorId: modeless } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Vecchio" });
    await t.run((ctx) => ctx.db.patch(modeless, { pricingMode: undefined }));
    const { configuratorId: custom } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Custom" });
    await t.run((ctx) => ctx.db.patch(custom, { pricingMode: "custom" }));
    // Another tenant with no zone is skipped.
    const other = await seedTenant(t, { plan: "agency" });
    await t.run((ctx) => ctx.db.patch(other.tenantId, { country: "IT" }));
    const asOther = t.withIdentity({ subject: other.ownerId });
    const { configuratorId: noZone } = await asOther.mutation(api.configurators.createConfigurator, { tenantId: other.tenantId, name: "Test Z" });

    const res = await t.mutation(internal.pricing.applyStandardEverywhere, {});
    expect(res.scheduled).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const mode = (id: Id<"configurators">) => t.run(async (ctx) => (await ctx.db.get(id))?.pricingMode);
    expect(await mode(modeless)).toBe("standard");
    expect(await mode(custom)).toBe("custom");
    expect(await mode(noZone) ?? undefined).toBeUndefined();
  });
});

describe("onboarding: price zone step", () => {
  test("state exposes the chosen zone; the zone step is accepted; the zone is stored", async () => {
    const { s, as } = await italianTenant();
    const before = await as.query(api.onboarding.getState, {});
    expect(before.hasTenant && before.priceZone).toBeNull();
    await as.mutation(api.onboarding.advance, { step: "pricing" });
    await as.mutation(api.pricing.setPriceZone, { tenantId: s.tenantId, zone: "sud" });
    const after = await as.query(api.onboarding.getState, {});
    expect(after.hasTenant && after.priceZone).toBe("sud");
    expect(after.hasTenant && after.step).toBe("pricing");
  });
});

describe("fitting (posa): the installer's price per m², with or without", () => {
  test("setInstallation validates, publishes only when priced and needs the permission", async () => {
    const { t, s, as, asMember } = await italianTenant("centro");
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Posa test" });
    const snapshot = async () => {
      await as.mutation(api.configurators.publishConfigurator, { configuratorId });
      const versions = await t.run((ctx) => ctx.db.query("catalogVersions").withIndex("by_configurator_version", (q) => q.eq("configuratorId", configuratorId)).collect());
      return versions.sort((a, b) => a.version - b.version).at(-1)!.payload as { configurator: { installationPerM2Cents?: number; installationDefault?: string } };
    };
    expect((await snapshot()).configurator.installationPerM2Cents).toBeUndefined();
    for (const bad of [-1, 100_001, 12.5, Number.NaN]) {
      await expect(as.mutation(api.pricing.setInstallation, { configuratorId, perM2Cents: bad, defaultMode: "with" })).rejects.toThrow();
    }
    await expect(asMember.mutation(api.pricing.setInstallation, { configuratorId, perM2Cents: 8000, defaultMode: "with" })).rejects.toThrow();
    expect(await as.mutation(api.pricing.setInstallation, { configuratorId, perM2Cents: 8000, defaultMode: "without" })).toEqual({ installationPerM2Cents: 8000, installationDefault: "without" });
    expect((await snapshot()).configurator).toMatchObject({ installationPerM2Cents: 8000, installationDefault: "without" });
    // 0 switches it off: nothing is published any more.
    await as.mutation(api.pricing.setInstallation, { configuratorId, perM2Cents: 0, defaultMode: "with" });
    expect((await snapshot()).configurator.installationPerM2Cents).toBeUndefined();
  });
});

describe("delivery: factory transport or the installer's own transporter / fitter", () => {
  test("setDelivery stores the rate, publishes it only in own mode, validates it and needs the permission", async () => {
    const { t, s, as, asMember } = await italianTenant("centro");
    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Consegna test" });
    const snapshot = async () => {
      await as.mutation(api.configurators.publishConfigurator, { configuratorId });
      const versions = await t.run((ctx) => ctx.db.query("catalogVersions").withIndex("by_configurator_version", (q) => q.eq("configuratorId", configuratorId)).collect());
      return versions.sort((a, b) => a.version - b.version).at(-1)!.payload as { configurator: { deliveryMode?: string; ownServicePerM2Cents?: number } };
    };
    expect((await snapshot()).configurator.deliveryMode).toBeUndefined();

    await expect(as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own" })).rejects.toThrow(/INVALID_INPUT/); // own without a rate
    await expect(as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own", perM2Cents: -1 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own", perM2Cents: 100_001 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own", perM2Cents: 12.5 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(asMember.mutation(api.pricing.setDelivery, { configuratorId, mode: "own", perM2Cents: 1500 })).rejects.toThrow();

    expect(await as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own", perM2Cents: 1500 })).toEqual({ deliveryMode: "own", ownServicePerM2Cents: 1500 });
    expect((await snapshot()).configurator).toMatchObject({ deliveryMode: "own", ownServicePerM2Cents: 1500 });

    // Back to the factory: the rate is remembered but no longer published.
    await as.mutation(api.pricing.setDelivery, { configuratorId, mode: "factory" });
    expect((await snapshot()).configurator.deliveryMode).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(configuratorId)))?.ownServicePerM2Cents).toBe(1500);
    expect(await as.mutation(api.pricing.setDelivery, { configuratorId, mode: "own" })).toEqual({ deliveryMode: "own", ownServicePerM2Cents: 1500 });
  });
});

