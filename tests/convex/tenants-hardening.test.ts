import { describe, expect, test, vi } from "vitest";
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
    vi.useFakeTimers();
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "NOTES00001");
    const quoteId = await t.mutation(internal.widget.insertQuote, {
      publicId: "NOTES00001", configuratorId: cfg, catalogVersion: 1, items: [sampleItem],
      leadName: "N", leadEmail: "n@example.com", leadLocale: "it",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.quotes.addNote, { quoteId, note: "x".repeat(6000) })).rejects.toThrow("INVALID_INPUT");
    await expect(as.mutation(api.quotes.addNote, { quoteId, note: "   " })).rejects.toThrow("INVALID_INPUT");
    for (let i = 0; i < 25; i++) await as.mutation(api.quotes.addNote, { quoteId, note: `${i}-` + "y".repeat(4900) });
    const q = await t.run((ctx) => ctx.db.get(quoteId));
    expect(q!.internalNotes!.length).toBeLessThanOrEqual(100_000);
    expect(q!.internalNotes!.endsWith("y")).toBe(true);
    expect(q!.internalNotes!).toContain("24-");
    vi.useRealTimers();
  });
});

describe("branding hardening (launch audit)", () => {
  async function withBranding(plan: "base" | "pro") {
    const { seedPublishedConfigurator } = await import("./_helpers");
    const t = newDb();
    const s = await seedTenant(t, { plan });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, `BRAND${plan.toUpperCase()}01`);
    await t.run((ctx) => ctx.db.insert("branding", {
      tenantId: s.tenantId, configuratorId: cfg, whiteLabel: false, colorAccent: "#16d19d", colorAccentInk: "#04150f",
      fontFamily: "geist", copy: {}, companyInfo: { name: "X" },
    }));
    return { t, s, cfg, as: t.withIdentity({ subject: s.ownerId }) };
  }

  test("colours reject CSS injection, accept plain colour values", async () => {
    const { t, cfg, as } = await withBranding("pro");
    await expect(as.mutation(api.branding.updateBranding, { configuratorId: cfg, colorAccent: "red; background:url(https://evil)" }))
      .rejects.toThrow("INVALID_INPUT");
    await as.mutation(api.branding.updateBranding, { configuratorId: cfg, colorAccent: "#112233", colorBg: "rgb(10, 20, 30)", colorBgDark: "" });
    const b = await t.run((ctx) => ctx.db.query("branding").first());
    expect(b).toMatchObject({ colorAccent: "#112233", colorBg: "rgb(10, 20, 30)" });
    expect(b?.colorBgDark).toBeUndefined();
  });

  test("white-label without the entitlement is stored as false (save still works)", async () => {
    const { t, cfg, as } = await withBranding("base");
    await as.mutation(api.branding.updateBranding, { configuratorId: cfg, whiteLabel: true, colorAccent: "#000000" });
    const b = await t.run((ctx) => ctx.db.query("branding").first());
    expect(b?.whiteLabel).toBe(false);
    expect(b?.colorAccent).toBe("#000000");
  });

  test("white-label is kept on an entitled plan; oversized copy is refused", async () => {
    const { t, cfg, as } = await withBranding("pro");
    await as.mutation(api.branding.updateBranding, { configuratorId: cfg, whiteLabel: true });
    expect((await t.run((ctx) => ctx.db.query("branding").first()))?.whiteLabel).toBe(true);
    await expect(as.mutation(api.branding.updateBranding, { configuratorId: cfg, copy: { it: { title: "x".repeat(30_000) } } }))
      .rejects.toThrow("INVALID_INPUT");
  });
});
