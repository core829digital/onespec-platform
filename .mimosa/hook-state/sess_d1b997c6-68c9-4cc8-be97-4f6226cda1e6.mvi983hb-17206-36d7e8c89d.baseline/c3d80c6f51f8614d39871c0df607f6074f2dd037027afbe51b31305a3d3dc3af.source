import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { DPA_VERSION } from "../../src/shared/dpa";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seed() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "starter" });
  await t.run(async (ctx) => {
    await ctx.db.insert("appSettings", { key: "global", registrationOpen: true, resendMode: "noop", updatedAt: Date.now() });
    await ctx.db.patch(s.tenantId, { vatId: "IT01234567890", address: "Via Roma 1, Prato" });
    await ctx.db.patch(s.ownerId, { isPlatformAdmin: true });
  });
  return { t, s };
}

test("DPA is not required until the admin switches it on; members see the state, only owner/admin can accept", async () => {
  const { t, s } = await seed();
  const asOwner = t.withIdentity({ subject: s.ownerId });
  const asMember = t.withIdentity({ subject: s.memberId });

  let st = await asMember.query(api.dpa.getDpaState, { tenantId: s.tenantId });
  expect(st.required).toBe(false);
  expect(st.canAccept).toBe(false);
  expect(st.acceptance).toBeNull();
  expect(st.controllerComplete).toBe(true);

  await asOwner.mutation(api.dpa.setDpaRequired, { required: true });
  st = await asMember.query(api.dpa.getDpaState, { tenantId: s.tenantId });
  expect(st.required).toBe(true);

  const args = { tenantId: s.tenantId, version: DPA_VERSION, signerName: "Mario Rossi", signerRole: "Legale rappresentante" };
  await expect(asMember.mutation(api.dpa.acceptDpa, args)).rejects.toThrow();
  await expect(asOwner.mutation(api.dpa.acceptDpa, { ...args, version: "1999-01-01" })).rejects.toThrow();
  await expect(asOwner.mutation(api.dpa.acceptDpa, { ...args, signerName: " " })).rejects.toThrow();

  const id = await asOwner.mutation(api.dpa.acceptDpa, args);
  expect(await asOwner.mutation(api.dpa.acceptDpa, args)).toBe(id); // idempotent

  st = await asMember.query(api.dpa.getDpaState, { tenantId: s.tenantId });
  expect(st.acceptance?.signerName).toBe("Mario Rossi");
  expect(st.acceptance?.controller.vatId).toBe("IT01234567890");
  const audits = await t.run((ctx) => ctx.db.query("auditLog").withIndex("by_action", (q) => q.eq("action", "dpa.accept")).collect());
  expect(audits).toHaveLength(1);
});

test("cannot accept before the company profile has name, VAT and address; non-admin cannot flip the switch", async () => {
  const { t, s } = await seed();
  await t.run((ctx) => ctx.db.patch(s.tenantId, { vatId: undefined }));
  const asOwner = t.withIdentity({ subject: s.ownerId });
  await expect(
    asOwner.mutation(api.dpa.acceptDpa, { tenantId: s.tenantId, version: DPA_VERSION, signerName: "Mario Rossi", signerRole: "Titolare" }),
  ).rejects.toThrow();
  const asAdmin = t.withIdentity({ subject: s.adminId });
  await expect(asAdmin.mutation(api.dpa.setDpaRequired, { required: true })).rejects.toThrow();
});
