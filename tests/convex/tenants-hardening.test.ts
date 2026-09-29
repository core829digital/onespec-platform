import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("tenants hardening (launch audit)", () => {
  test("an invitation sent before a downgrade can't push the team over the new seat limit", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" }); // 3 active members, Pro allows 5
    const inviteeId = await t.run(async (ctx) => {
      await ctx.db.insert("invitations", {
        tenantId: s.tenantId, email: "late@example.com", role: "member", token: "tok_late_invite_000000000000000",
        invitedByUserId: s.ownerId, expiresAt: Date.now() + 86_400_000,
      });
      // Downgrade to Base (2 seats) after the invitation was sent.
      await ctx.db.patch(s.tenantId, { plan: "base" });
      return ctx.db.insert("users", { name: "late", email: "late@example.com", emailVerificationTime: Date.now() });
    });
    await expect(
      t.withIdentity({ subject: inviteeId }).mutation(api.tenants.acceptInvitation, { token: "tok_late_invite_000000000000000" }),
    ).rejects.toThrow("MEMBER_LIMIT_REACHED");
  });

  test("an invitation within the seat limit is still accepted", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const inviteeId = await t.run(async (ctx) => {
      await ctx.db.insert("invitations", {
        tenantId: s.tenantId, email: "ok@example.com", role: "member", token: "tok_ok_invite_00000000000000000",
        invitedByUserId: s.ownerId, expiresAt: Date.now() + 86_400_000,
      });
      return ctx.db.insert("users", { name: "ok", email: "ok@example.com", emailVerificationTime: Date.now() });
    });
    const r = await t.withIdentity({ subject: inviteeId }).mutation(api.tenants.acceptInvitation, { token: "tok_ok_invite_00000000000000000" });
    expect(r.tenantId).toBe(s.tenantId);
  });

  test("company name and country are validated on update", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, name: " " })).rejects.toThrow("INVALID_NAME");
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, name: "x".repeat(500) })).rejects.toThrow("INVALID_NAME");
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, country: "Italy" })).rejects.toThrow("INVALID_INPUT");
    await as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, name: "  Serramenti   Rossi ", country: "it" });
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant).toMatchObject({ name: "Serramenti Rossi", country: "IT" });
  });
});

describe("widget view counting (launch audit)", () => {
  test("a plan without the public widget gets counted:false, never an error", async () => {
    const { internal } = await import("../../convex/_generated/api");
    const { seedPublishedConfigurator } = await import("./_helpers");
    const t = newDb();
    const s = await seedTenant(t, { plan: "base" });
    await seedPublishedConfigurator(t, s.tenantId, "VIEWBASE01");
    expect(await t.mutation(internal.widget.recordWidgetView, { publicId: "VIEWBASE01", viewToken: "tokenAAAAAAAA" })).toEqual({ counted: false });
  });
});

describe("quote notes (launch audit)", () => {
  test("notes are bounded so the quote document can never hit the 1 MB limit", async () => {
    const { internal } = await import("../../convex/_generated/api");
    const { seedPublishedConfigurator, sampleItem } = await import("./_helpers");
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "NOTES00001");
    const quoteId = await t.mutation(internal.widget.insertQuote, {
      publicId: "NOTES00001", configuratorId: cfg, catalogVersion: 1, items: [sampleItem],
      leadName: "N", leadEmail: "n@example.com", leadLocale: "it",
    });
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.quotes.addNote, { quoteId, note: "x".repeat(6000) })).rejects.toThrow("INVALID_INPUT");
    await expect(as.mutation(api.quotes.addNote, { quoteId, note: "   " })).rejects.toThrow("INVALID_INPUT");
    for (let i = 0; i < 25; i++) await as.mutation(api.quotes.addNote, { quoteId, note: `${i}-` + "y".repeat(4900) });
    const q = await t.run((ctx) => ctx.db.get(quoteId));
    expect(q!.internalNotes!.length).toBeLessThanOrEqual(100_000);
    expect(q!.internalNotes!.endsWith("y")).toBe(true);
    expect(q!.internalNotes!).toContain("24-");
  });
});
