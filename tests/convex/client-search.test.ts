import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * Regression for #46: listClients paginated (newest `limit` cards) before
 * applying the search filter, so once a tenant passed 50 clients the older
 * cards were invisible to search — a false-negative CRM search that invites
 * duplicate client cards.
 */
test("listClients search sees past the newest-50 window (#46)", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // 55 clients: more than the default limit (50); the oldest carries a unique name.
  const oldestName = "Aardvark Client Piu Vecchio";
  await asOwner.mutation(api.clients.createClient, { tenantId: seeded.tenantId, name: oldestName });
  for (let i = 1; i < 55; i++) {
    await asOwner.mutation(api.clients.createClient, { tenantId: seeded.tenantId, name: `Cliente Recente ${i}` });
  }

  const found = await asOwner.query(api.clients.listClients, { tenantId: seeded.tenantId, search: "aardvark" });
  expect(found).toHaveLength(1);
  expect(found[0]?.name).toBe(oldestName);
});
