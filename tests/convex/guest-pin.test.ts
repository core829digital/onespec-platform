import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Issue #77: the PIN's lifetime is whole days from 1 to 365.
test("guest PIN expiry is bounded and the default stays 30 days", async () => {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const as = t.withIdentity({ subject: s.ownerId });
  const cantiereId = await t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId: s.tenantId, name: "Cantiere", address: "Via 1", city: "Roma", postalCode: "00100",
      status: "preventivo", priority: "medium", assignedUserIds: [], createdAt: Date.now(), updatedAt: Date.now(),
    }),
  );
  for (const expiresInDays of [-1, 0, 0.5, 366, 1e12]) {
    await expect(as.mutation(api.cantieri.generateGuestPin, { cantiereId, expiresInDays })).rejects.toThrow(/INVALID_INPUT/);
  }
  const r = await as.mutation(api.cantieri.generateGuestPin, { cantiereId });
  expect(r.expiresAt - Date.now()).toBe(30 * 24 * 60 * 60 * 1000);
  const year = await as.mutation(api.cantieri.generateGuestPin, { cantiereId, expiresInDays: 365 });
  expect(year.expiresAt - Date.now()).toBe(365 * 24 * 60 * 60 * 1000);
});
