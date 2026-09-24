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
