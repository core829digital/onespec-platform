import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

/**
 * Launch audit: a tenant must not be able to attach its own records to
 * ANOTHER tenant's quote / inspection / client, nor assign foreign users —
 * and per-quote lists never show another tenant's rows.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = newDb();
  const victim = await seedTenant(t, { plan: "enterprise" });
  const attacker = await seedTenant(t, { plan: "enterprise" });
  const cfg = await seedPublishedConfigurator(t, victim.tenantId, "VICTIM0001");
  const victimQuote = await t.mutation(internal.widget.insertQuote, {
    publicId: "VICTIM0001", configuratorId: cfg, catalogVersion: 1, items: [sampleItem],
    leadName: "V", leadEmail: "v@example.com", leadLocale: "it",
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const victimClient = await t.withIdentity({ subject: victim.ownerId }).mutation(api.clients.createClient, { tenantId: victim.tenantId, name: "Cliente vittima" });
  return { t, victim, attacker, victimQuote, victimClient, as: t.withIdentity({ subject: attacker.ownerId }) };
}

describe("cross-tenant references are refused", () => {
  test("survey on another tenant's quote", async () => {
    const { attacker, victimQuote, as } = await setup();
    await expect(as.mutation(api.surveys.create, {
      tenantId: attacker.tenantId, quoteId: victimQuote, customerName: "X", openings: [],
      diagnostics: {},
    })).rejects.toThrow("TENANT_MISMATCH");
  });

  test("passport on another tenant's quote", async () => {
    const { attacker, victimQuote, as } = await setup();
    await expect(as.mutation(api.passports.create, {
      tenantId: attacker.tenantId, quoteId: victimQuote, label: "L", customerName: "X",
    })).rejects.toThrow("TENANT_MISMATCH");
  });

  test("cantiere with another tenant's client / quote / users", async () => {
    const { victim, attacker, victimQuote, victimClient, as } = await setup();
    const base = { tenantId: attacker.tenantId, name: "C", address: "A", city: "B", postalCode: "1" };
    await expect(as.mutation(api.cantieri.createCantiere, { ...base, clientId: victimClient })).rejects.toThrow("TENANT_MISMATCH");
    await expect(as.mutation(api.cantieri.createCantiere, { ...base, quoteId: victimQuote })).rejects.toThrow("TENANT_MISMATCH");
    await expect(as.mutation(api.cantieri.createCantiere, { ...base, assignedUserIds: [victim.ownerId] })).rejects.toThrow("TENANT_MISMATCH");
    const own = await as.mutation(api.cantieri.createCantiere, { ...base, assignedUserIds: [attacker.memberId] });
    await expect(as.mutation(api.cantieri.updateCantiere, { cantiereId: own, clientId: victimClient })).rejects.toThrow("TENANT_MISMATCH");
  });

  test("per-quote lists only ever return the quote's own tenant rows", async () => {
    const { t, victim, attacker, victimQuote } = await setup();
    // Simulate a legacy/foreign row pointing at the victim's quote.
    await t.run((ctx) => ctx.db.insert("siteSurveys", {
      tenantId: attacker.tenantId, regionCode: "IT", quoteId: victimQuote, createdByUserId: attacker.ownerId,
      customerName: "Intruso", openings: [], diagnostics: {}, status: "draft",
      createdAt: Date.now(), updatedAt: Date.now(),
    } as never));
    const rows = await t.withIdentity({ subject: victim.ownerId }).query(api.surveys.listByQuote, { quoteId: victimQuote });
    expect(rows.every((r) => r.tenantId === victim.tenantId)).toBe(true);
  });
});

describe("cantiere tasks & clients (launch audit)", () => {
  test("reassigning a task works (it used to crash) and only to active members", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "enterprise" });
    const other = await seedTenant(t, { plan: "enterprise" });
    const as = t.withIdentity({ subject: s.ownerId });
    const cantiereId = await as.mutation(api.cantieri.createCantiere, { tenantId: s.tenantId, name: "C", address: "A", city: "B", postalCode: "1" });
    const { taskId } = await as.mutation(api.cantieri.createCantiereTask, { tenantId: s.tenantId, cantiereId, title: "Posa" });
    await as.mutation(api.cantieri.updateCantiereTask, { taskId, assignedUserId: s.memberId });
    expect((await t.run((ctx) => ctx.db.get(taskId)))?.userId).toBe(s.memberId);
    await expect(as.mutation(api.cantieri.updateCantiereTask, { taskId, assignedUserId: other.ownerId })).rejects.toThrow("TENANT_MISMATCH");
    await expect(as.mutation(api.cantieri.createCantiereTask, { tenantId: s.tenantId, cantiereId, title: "x".repeat(300) })).rejects.toThrow("INVALID_INPUT");
  });

  test("client assignee must be an active member; fields are bounded", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "enterprise" });
    const other = await seedTenant(t, { plan: "enterprise" });
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "C", assignedToUserId: other.ownerId })).rejects.toThrow("TENANT_MISMATCH");
    await expect(as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "C", notes: "x".repeat(20_000) })).rejects.toThrow("INVALID_INPUT");
    await expect(as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "  " })).rejects.toThrow("INVALID_NAME");
    const id = await as.mutation(api.clients.createClient, { tenantId: s.tenantId, name: "Ok", assignedToUserId: s.memberId });
    expect(id).toBeDefined();
  });
});
