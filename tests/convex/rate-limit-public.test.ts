import { afterEach, describe, expect, test, vi } from "vitest";
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

describe("token bucket refill clock", () => {
  afterEach(() => vi.useRealTimers());

  test("the fraction of a token earned between requests is not thrown away", async () => {
    vi.useFakeTimers();
    const t = newDb();
    const use = (key: string) => t.mutation(internal.lib.ratelimit.checkBucket, { bucketKey: key, tokens: 2, refillMs: 60_000 }); // 1 token / 30 s
    const key = "clock:test";
    vi.setSystemTime(0);
    await use(key); // 2 -> 1
    vi.setSystemTime(20_000);
    await use(key); // 1 -> 0 (20 s earned: not yet a whole token)
    vi.setSystemTime(50_000);
    await use(key); // 50 s since the start: 1 token back, used again
    vi.setSystemTime(59_000);
    await expect(use(key)).rejects.toThrow("RATE_LIMITED");
    vi.setSystemTime(60_000); // 60 s since the start = the second token. With the clock reset on every request it was only back at 80 s.
    await use(key);
  });

  test("a refused request leaves the bucket as it was", async () => {
    vi.useFakeTimers();
    const t = newDb();
    const use = () => t.mutation(internal.lib.ratelimit.checkBucket, { bucketKey: "refused:test", tokens: 1, refillMs: 60_000 });
    vi.setSystemTime(0);
    await use();
    for (const at of [10_000, 20_000, 30_000, 40_000, 50_000]) {
      vi.setSystemTime(at);
      await expect(use()).rejects.toThrow("RATE_LIMITED");
    }
    vi.setSystemTime(60_000);
    await use(); // the retries did not push the next refill away
  });
});

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

describe("rate-limit bucket retention", () => {
  test("idle buckets (2+ days) are purged; recent ones kept", async () => {
    const t = newDb();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", { bucketKey: "old", tokens: 0, updatedAt: now - 3 * 86_400_000 });
      await ctx.db.insert("rateLimits", { bucketKey: "fresh", tokens: 0, updatedAt: now - 3_600_000 });
    });
    expect(await t.mutation(internal.lib.ratelimit.purgeIdleBuckets, {})).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    expect(left.map((r) => r.bucketKey)).toEqual(["fresh"]);
  });
});
