import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { RATE_LIMITS } from "../../convex/lib/ratelimit";
import { newDb, seedTenant } from "./_helpers";

async function seedCantiere(t: ReturnType<typeof newDb>, tenantId: Awaited<ReturnType<typeof seedTenant>>["tenantId"], pin: string) {
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

describe("getCantiereByGuestPin", () => {
  test("valid PIN resolves the cantiere; wrong PIN does not leak it", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedCantiere(t, tenantId, "123456");

    const ok = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "123456", ip: "1.2.3.4" });
    expect(ok.ok).toBe(true);

    const bad = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "000000", ip: "1.2.3.4" });
    expect(bad.ok).toBe(false);
  });

  test("a 6-digit PIN is rate-limited per IP — brute force gets throttled", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedCantiere(t, tenantId, "654321");

    const limit = RATE_LIMITS.guestPinPerIpPer10Min.tokens;
    // Distinct PIN per attempt: isolates the per-IP bucket from the per-PIN
    // bucket (same PIN 10x would trip the smaller per-PIN bucket first).
    for (let i = 0; i < limit; i++) {
      const r = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: `bad${i}`, ip: "9.9.9.9" });
      expect(r.error).not.toMatch(/tentativi/);
    }
    const throttled = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "wrong", ip: "9.9.9.9" });
    expect(throttled.ok).toBe(false);
    expect(throttled.error).toMatch(/tentativi/);

    // A different IP has its own bucket — not affected by the first IP's exhaustion.
    const otherIp = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "654321", ip: "1.1.1.1" });
    expect(otherIp.ok).toBe(true);
  });
});

describe("getCantiereByGuestPin — guest view payload", () => {
  test("returns only the read-only allow-list (no project value, notes or raw documents)", async () => {
    const t = newDb();
    const s = await seedTenant(t);
    const cantiereId = await seedCantiere(t, s.tenantId, "112233");
    await t.run(async (ctx) => {
      await ctx.db.patch(cantiereId, { valueCents: 9_999_00, notes: "margine interno 40%", guestPinExpiresAt: Date.now() + 86_400_000 });
      await ctx.db.insert("cantiereTasks", {
        tenantId: s.tenantId,
        cantiereId,
        userId: s.ownerId,
        title: "Posa finestre",
        status: "done",
        priority: "medium",
        dueAt: 1_800_000_000_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const r = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "112233", ip: "7.7.7.7" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const json = JSON.stringify(r);
    expect(json).not.toContain("margine interno");
    expect(json).not.toContain("999900");
    expect(json).not.toContain("tenantId");
    expect(json).not.toContain("112233"); // the PIN itself is not echoed back
    expect(r.cantiere.address).toBe("Via Roma 1, 59100 Prato");
    expect(r.cantiere.guestPinExpiresAt).toBeGreaterThan(Date.now());
    expect(r.tasks).toEqual([{ title: "Posa finestre", description: null, done: true, dueAt: 1_800_000_000_000 }]);
    expect(r.locale).toBe("it");
  });

  test("the view speaks the site's market language", async () => {
    const t = newDb();
    const s = await seedTenant(t);
    const cantiereId = await seedCantiere(t, s.tenantId, "445566");
    await t.run((ctx) => ctx.db.patch(cantiereId, { country: "DE" }));
    const r = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin: "445566", ip: "8.8.8.8" });
    expect(r.ok && r.locale).toBe("de");
  });
});

describe("generateGuestPin — expiresInDays clamped to [1, 365] days (#77)", () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function issue(t: ReturnType<typeof newDb>, expiresInDays?: number) {
    const s = await seedTenant(t);
    const cantiereId = await seedCantiere(t, s.tenantId, "");
    return (await t.withIdentity({ subject: s.ownerId }).mutation(api.cantieri.generateGuestPin,
      expiresInDays === undefined ? { cantiereId } : { cantiereId, expiresInDays })) as {
      pin: string;
      expiresAt: number;
    };
  }

  test("negative and zero TTLs no longer issue an already-expired PIN", async () => {
    const t = newDb();
    for (const bad of [-1, 0]) {
      const { pin, expiresAt } = await issue(t, bad);
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + DAY + 5_000);
      const view = await t.mutation(api.cantieri.getCantiereByGuestPin, { pin, ip: "5.5.5.5" });
      expect(view.ok).toBe(true); // the customer can actually open /k/<pin>
    }
  });

  test("an absurd TTL cannot defeat the expiry policy — capped at 365 days", async () => {
    const t = newDb();
    const { expiresAt } = await issue(t, 1e12);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 365 * DAY + 5_000);
  });

  test("fractional TTLs round to whole days; the default stays 30", async () => {
    const t = newDb();
    const frac = await issue(t, 2.9);
    expect(frac.expiresAt).toBeGreaterThanOrEqual(Date.now() + 3 * DAY - 5_000);
    const def = await issue(t);
    expect(def.expiresAt).toBeGreaterThan(Date.now() + 29 * DAY);
    expect(def.expiresAt).toBeLessThanOrEqual(Date.now() + 30 * DAY + 5_000);
  });
});
