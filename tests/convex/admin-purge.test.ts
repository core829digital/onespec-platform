import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const client = (tenantId: Id<"tenants">, name: string) => ({
  tenantId, name, type: "private" as const, tags: [], status: "lead" as const, createdAt: 1, updatedAt: 1,
});

async function world() {
  const t = newDb();
  const keep1 = await seedTenant(t, { plan: "pro" });
  const keep2 = await seedTenant(t, { plan: "base" });
  const junk = await seedTenant(t, { plan: "base" });
  await t.run(async (ctx) => {
    await ctx.db.patch(keep1.ownerId, { email: "contact.core829@gmail.com" });
    await ctx.db.patch(keep2.ownerId, { email: "office@winex.ro" });
    await ctx.db.patch(junk.ownerId, { email: "junk@example.com" });
    await ctx.db.patch(junk.tenantId, { stripeCustomerId: "cus_junk" });
    await ctx.db.insert("clients", client(junk.tenantId, "C"));
    await ctx.db.insert("clients", client(keep1.tenantId, "Keep"));
    await ctx.db.insert("billingEvents", { stripeEventId: "e1", type: "x", tenantId: junk.tenantId, receivedAt: 1 });
  });
  return { t, keep1, keep2, junk };
}
const KEEP = ["contact.core829@gmail.com", "office@winex.ro"];

describe("adminPurge.purgeAccountsExcept", () => {
  test("dry run (default) reports but deletes nothing", async () => {
    const { t, junk } = await world();
    const r = await t.action(internal.adminPurge.purgeAccountsExcept, { keepEmails: KEEP });
    expect(r.dryRun).toBe(true);
    expect((r.deleting as { users: string[] }).users).toContain("junk@example.com");
    expect(r.stripeCustomersToRemoveManually).toEqual(["cus_junk"]);
    expect(await t.run((ctx) => ctx.db.get(junk.tenantId))).not.toBeNull();
  });

  test("a real run needs the confirmation phrase", async () => {
    const { t, junk } = await world();
    const r = await t.action(internal.adminPurge.purgeAccountsExcept, { keepEmails: KEEP, dryRun: false });
    expect(String(r.aborted)).toMatch(/confirm/);
    expect(await t.run((ctx) => ctx.db.get(junk.tenantId))).not.toBeNull();
  });

  test("aborts when a kept e-mail does not exist (typo protection)", async () => {
    const { t, junk } = await world();
    await expect(
      t.action(internal.adminPurge.purgeAccountsExcept, { keepEmails: [...KEEP, "tipo@sbagliato.it"], dryRun: false, confirm: "DELETE-ALL-EXCEPT-KEPT" }),
    ).rejects.toThrow(/not found/);
    expect(await t.run((ctx) => ctx.db.get(junk.tenantId))).not.toBeNull();
  });

  test("real run removes everything of the other accounts and keeps the two", async () => {
    const { t, keep1, keep2, junk } = await world();
    const r = await t.action(internal.adminPurge.purgeAccountsExcept, {
      keepEmails: KEEP, dryRun: false, confirm: "DELETE-ALL-EXCEPT-KEPT",
    });
    expect(r.done).toBe(true);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(junk.tenantId)).toBeNull();
      expect(await ctx.db.get(junk.ownerId)).toBeNull();
      expect(await ctx.db.get(junk.adminId)).toBeNull();
      expect(await ctx.db.get(keep1.tenantId)).not.toBeNull();
      expect(await ctx.db.get(keep1.ownerId)).not.toBeNull();
      expect(await ctx.db.get(keep2.tenantId)).not.toBeNull();
      const clients = await ctx.db.query("clients").collect();
      expect(clients.map((c) => c.tenantId)).toEqual([keep1.tenantId]);
      expect(await ctx.db.query("billingEvents").collect()).toHaveLength(0);
      // the kept tenants' own members are kept too (only doomed users are removed)
      const users = await ctx.db.query("users").collect();
      expect(users.some((u) => u.email === "junk@example.com")).toBe(false);
    });
  });

  test("refuses to delete a platform admin / full-access tenant unless allowProtected", async () => {
    const { t, junk } = await world();
    await t.run((ctx) => ctx.db.patch(junk.ownerId, { isPlatformAdmin: true }));
    const r = await t.action(internal.adminPurge.purgeAccountsExcept, {
      keepEmails: KEEP, dryRun: false, confirm: "DELETE-ALL-EXCEPT-KEPT",
    });
    expect(String(r.aborted)).toMatch(/Protected/);
    expect(await t.run((ctx) => ctx.db.get(junk.tenantId))).not.toBeNull();
  });
});
