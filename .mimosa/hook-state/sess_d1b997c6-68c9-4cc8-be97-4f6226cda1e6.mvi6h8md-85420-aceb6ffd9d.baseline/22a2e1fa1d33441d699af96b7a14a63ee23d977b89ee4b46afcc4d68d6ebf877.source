import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seeded() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const as = t.withIdentity({ subject: s.ownerId });
  const clientId = await t.run((ctx) =>
    ctx.db.insert("clients", { tenantId: s.tenantId, name: "Rossi", type: "company", tags: [], status: "active", createdAt: Date.now(), updatedAt: Date.now() }),
  );
  return { t, s, as, clientId };
}

describe("free-text inputs are bounded by the server, not only by the form", () => {
  test("client activity: title, description and link fields", async () => {
    const { as, clientId } = await seeded();
    const base = { clientId, type: "note" as const };
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "x".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "ok", description: "y".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "ok", relatedId: "z".repeat(61) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "Call\u0000", })).rejects.toThrow(/INVALID_INPUT/);
    // Line breaks in a description are fine; a normal note still works.
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "Telefonata", description: "riga 1\nriga 2" })).resolves.toBeTruthy();
  });

  test("catalogue product base only accepts a real piece category", async () => {
    const { t, s, as } = await seeded();
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
    await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
    await expect(as.mutation(api.catalog.setProductBase, { configuratorId, category: "not-a-category", basePriceCents: 100 })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.catalog.setProductBase, { configuratorId, category: "porta", basePriceCents: 100 });
  });
});
