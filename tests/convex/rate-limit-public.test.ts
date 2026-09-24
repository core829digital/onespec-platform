import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { RATE_LIMITS } from "../../convex/lib/ratelimit";
import { newDb, seedTenant } from "./_helpers";

async function seedCantiere(
  t: ReturnType<typeof newDb>,
  tenantId: Awaited<ReturnType<typeof seedTenant>>["tenantId"],
  pin: string,
) {
  return t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId,
      name: "Cantiere Test",
      address: "Via Roma 1",
      city: "Prato",
      postalCode: "59100",
      status: "in_produzione",
      priority: "medium",
      assignedUserIds: [],
      guestPin: pin,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

describe("FASE L public rate limits", () => {
  test("checkBucket allows up to N tokens, then throws RATE_LIMITED", async () => {
    const t = newDb();
    const key = `test:${Date.now()}`;
    await t.mutation(internal.lib.ratelimit.checkBucket, {
      bucketKey: key,
      tokens: 2,
      refillMs: 60 * 1000,
    });
    await t.mutation(internal.lib.ratelimit.checkBucket, {
      bucketKey: key,
      tokens: 2,
      refillMs: 60 * 1000,
    });
    await expect(
      t.mutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: key,
        tokens: 2,
        refillMs: 60 * 1000,
      }),
    ).rejects.toThrow("RATE_LIMITED");
  });

  test("per-PIN bucket: hammering one PIN does not block another PIN from the same IP", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedCantiere(t, tenantId, "111111");
    await seedCantiere(t, tenantId, "222222");

    const perPin = RATE_LIMITS.guestPinPerPinPerIpPer10Min.tokens;
    for (let i = 0; i < perPin; i++) {
      await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "999999", ip: "5.5.5.5" });
    }
    const blocked = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "999999", ip: "5.5.5.5" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/tentativi/);

    // Same IP, different PIN bucket — still resolves.
    const other = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "222222", ip: "5.5.5.5" });
    expect(other.ok).toBe(true);
  });

  test("duplicate PIN rows do not 500 (first match wins)", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedCantiere(t, tenantId, "333333");
    await seedCantiere(t, tenantId, "333333");

    const res = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "333333", ip: "6.6.6.6" });
    expect(res.ok).toBe(true);
  });
});
