import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("clients search (issue #46)", () => {
  test("finds a client outside the newest page, and still hides deleted cards", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: s.ownerId });
    await t.run(async (ctx) => {
      const now = Date.now();
      // Oldest first: "Bianchi Serramenti" is the 1st of 160 cards, far outside the newest 50 (and the old 150 scan).
      await ctx.db.insert("clients", { tenantId: s.tenantId, name: "Bianchi Serramenti", phone: "+39 333 1234567", type: "company", tags: [], status: "active", createdAt: now, updatedAt: now });
      for (let i = 0; i < 158; i++) {
        await ctx.db.insert("clients", { tenantId: s.tenantId, name: `Cliente ${i}`, type: "company", tags: [], status: "active", createdAt: now, updatedAt: now });
      }
      await ctx.db.insert("clients", { tenantId: s.tenantId, name: "Bianchi Cancellato", type: "company", tags: [], status: "lost", createdAt: now, updatedAt: now });
    });

    const byName = await as.query(api.clients.listClients, { tenantId: s.tenantId, search: "bianchi" });
    expect(byName.map((c) => c.name)).toEqual(["Bianchi Serramenti"]);
    const byPhone = await as.query(api.clients.listClients, { tenantId: s.tenantId, search: "1234567" });
    expect(byPhone).toHaveLength(1);
    // The archive view finds the deleted one.
    const lost = await as.query(api.clients.listClients, { tenantId: s.tenantId, status: "lost", search: "bianchi" });
    expect(lost.map((c) => c.name)).toEqual(["Bianchi Cancellato"]);
    // Without a search the list is still the newest page.
    expect(await as.query(api.clients.listClients, { tenantId: s.tenantId })).toHaveLength(50);
  });
});
