/** Verbale di Collaudo — signed inspection record with photo checklist (Phase C). */

import { query, mutation, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { requireTenantRegion, assertSignature } from "./lib/fieldModules";
import { complianceForRegion } from "./lib/compliance";
import { regionForCountry } from "./lib/regions";
import { nanoid } from "./lib/ids";
import { internal } from "./_generated/api";
import { enforceForESignature } from "./lib/enforcement";

/** Per-market inspection template (title, legal basis, photo + check lists). */
export const getTemplate = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const tenant = await ctx.db.get(args.tenantId);
    const region = regionForCountry(tenant?.country);
    return { regionCode: region.code, ...complianceForRegion(region.code).inspection };
  },
});

export const list = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query("inspectionReports")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const listByQuote = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return [];
    await requireMembership(ctx, quote.tenantId);
    return await ctx.db
      .query("inspectionReports")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();
  },
});

export const get = query({
  args: { reportId: v.id("inspectionReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    await requireMembership(ctx, report.tenantId);
    const photos = await Promise.all(
      report.photos.map(async (p) => ({
        ...p,
        url: p.storageId ? await ctx.storage.getUrl(p.storageId) : null,
      })),
    );
    return { ...report, photos };
  },
});

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getForPrint = query({
  args: { reportId: v.id("inspectionReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    await requireMembership(ctx, report.tenantId);
    const tenant = await ctx.db.get(report.tenantId);
    const region = regionForCountry(report.regionCode).code;
    const tpl = complianceForRegion(region).inspection;
    const photos = await Promise.all(
      report.photos.map(async (p) => ({
        ...p,
        url: p.storageId ? await ctx.storage.getUrl(p.storageId) : null,
      })),
    );
    return {
      report: { ...report, photos },
      tenant,
      title: tpl.title,
      legalBasis: tpl.legalBasis,
      warrantyLines: tpl.warrantyLines,
    };
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.optional(v.id("quoteRequests")),
    customerName: v.string(),
    siteAddress: v.optional(v.string()),
    installerTeam: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    const name = args.customerName.trim();
    if (!name) throw new ConvexError("CUSTOMER_NAME_REQUIRED");
    const tpl = complianceForRegion(regionCode).inspection;

    const now = Date.now();
    return await ctx.db.insert("inspectionReports", {
      tenantId: args.tenantId,
      regionCode,
      quoteId: args.quoteId,
      createdByUserId: userId,
      customerName: name,
      siteAddress: args.siteAddress?.trim(),
      installerToken: nanoid(16),
      installerTeam: args.installerTeam?.trim(),
      scheduledFor: args.scheduledFor,
      photos: tpl.photoChecklist.map((p) => ({ key: p.key, label: p.label })),
      checks: tpl.functionalChecks.map((c) => ({ key: c.key, label: c.label, passed: false })),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Assign the installer team + schedule, (re)issuing the field token if absent. */
export const assignInstaller = mutation({
  args: {
    reportId: v.id("inspectionReports"),
    installerTeam: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    regenerateToken: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    await requireTenantRole(ctx, report.tenantId, ["owner", "admin", "member"]);
    await ctx.db.patch(args.reportId, {
      installerTeam: args.installerTeam?.trim() ?? report.installerTeam,
      scheduledFor: args.scheduledFor ?? report.scheduledFor,
      installerToken:
        args.regenerateToken || !report.installerToken ? nanoid(16) : report.installerToken,
      updatedAt: Date.now(),
    });
  },
});

export const setPhoto = mutation({
  args: {
    reportId: v.id("inspectionReports"),
    photoKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    await requireTenantRole(ctx, report.tenantId, ["owner", "admin", "member"]);
    if (report.status === "signed") throw new ConvexError("REPORT_LOCKED");

    let matched = false;
    const photos = report.photos.map((p) => {
      if (p.key !== args.photoKey) return p;
      matched = true;
      if (p.storageId && p.storageId !== args.storageId) {
        ctx.storage.delete(p.storageId).catch(() => {});
      }
      return { ...p, storageId: args.storageId };
    });
    if (!matched) throw new ConvexError("UNKNOWN_PHOTO_SLOT");
    await ctx.db.patch(args.reportId, { photos, updatedAt: Date.now() });
  },
});

export const updateChecks = mutation({
  args: {
    reportId: v.id("inspectionReports"),
    checks: v.array(v.object({ key: v.string(), passed: v.boolean() })),
    installerNotes: v.optional(v.string()),
    clientRemarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    await requireTenantRole(ctx, report.tenantId, ["owner", "admin", "member"]);
    if (report.status === "signed") throw new ConvexError("REPORT_LOCKED");

    const passedByKey = new Map(args.checks.map((c) => [c.key, c.passed]));
    const checks = report.checks.map((c) => ({
      ...c,
      passed: passedByKey.get(c.key) ?? c.passed,
    }));
    await ctx.db.patch(args.reportId, {
      checks,
      installerNotes: args.installerNotes?.trim() ?? report.installerNotes,
      clientRemarks: args.clientRemarks?.trim() ?? report.clientRemarks,
      updatedAt: Date.now(),
    });
  },
});

export const sign = mutation({
  args: {
    reportId: v.id("inspectionReports"),
    signatureDataUrl: v.string(),
    signedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    await requireMembership(ctx, report.tenantId);
    await enforceForESignature(ctx, report.tenantId);
    if (report.status === "signed") throw new ConvexError("ALREADY_SIGNED");

    // Every mandatory photo slot must be filled before the record can be signed.
    const missing = report.photos.filter((p) => !p.storageId);
    if (missing.length > 0) {
      throw new ConvexError(`PHOTOS_INCOMPLETE:${missing.map((p) => p.key).join(",")}`);
    }
    assertSignature(args.signatureDataUrl);
    const signedByName = args.signedByName.trim();
    if (!signedByName) throw new ConvexError("SIGNER_NAME_REQUIRED");

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      signatureDataUrl: args.signatureDataUrl,
      signedByName,
      signedAt: now,
      status: "signed",
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      tenantId: report.tenantId,
      actorKind: "user",
      action: "inspection.signed",
      targetTable: "inspectionReports",
      targetId: args.reportId,
      meta: { signedByName, signedAt: now },
      createdAt: now,
    });
    return { ok: true, signedAt: now };
  },
});

export const remove = mutation({
  args: { reportId: v.id("inspectionReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;
    await requireTenantRole(ctx, report.tenantId, ["owner", "admin"]);
    if (report.status === "signed") throw new ConvexError("CANNOT_DELETE_SIGNED");
    for (const p of report.photos) {
      if (p.storageId) await ctx.storage.delete(p.storageId).catch(() => {});
    }
    await ctx.db.delete(args.reportId);
  },
});

/* ------------------------- App Posatore (/i/[token]) ------------------------ */

async function reportByToken(ctx: QueryCtx | MutationCtx, token: string) {
  if (!/^[A-Za-z0-9]{8,32}$/.test(token)) return null;
  return await ctx.db
    .query("inspectionReports")
    .withIndex("by_installer_token", (q) => q.eq("installerToken", token))
    .unique();
}

/** Field installer's view — no auth, the token is the capability. */
export const getByInstallerToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const report = await reportByToken(ctx, args.token);
    if (!report) return null;

    const tenant = await ctx.db.get(report.tenantId);
    const region = regionForCountry(report.regionCode).code;
    const tpl = complianceForRegion(region).inspection;

    const photos = await Promise.all(
      report.photos.map(async (p) => ({
        key: p.key,
        label: p.label,
        url: p.storageId ? await ctx.storage.getUrl(p.storageId) : null,
      })),
    );

    let items: { label: string; qty: number }[] = [];
    if (report.quoteId) {
      const quote = await ctx.db.get(report.quoteId);
      const raw = Array.isArray(quote?.items) ? (quote!.items as Record<string, unknown>[]) : [];
      items = raw.map((it, i) => ({
        label: `${it.productType === "balconyDoor" ? "Porta-finestra" : "Finestra"} ${
          it.width ?? "?"
        }×${it.height ?? "?"} mm${it.floor ? ` · ${it.floor}` : ""}`.trim() || `Serramento ${i + 1}`,
        qty: Number(it.quantity ?? 1),
      }));
    }

    return {
      status: report.status,
      customerName: report.customerName,
      siteAddress: report.siteAddress ?? null,
      installerTeam: report.installerTeam ?? null,
      scheduledFor: report.scheduledFor ?? null,
      dealerName: tenant?.name ?? "",
      title: tpl.title,
      items,
      photos,
      checks: report.checks,
      signedByName: report.signedByName ?? null,
      signedAt: report.signedAt ?? null,
    };
  },
});

export const installerUploadUrlFromHttp = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const report = await reportByToken(ctx, args.token);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    if (report.status === "signed") throw new ConvexError("REPORT_LOCKED");
    return await ctx.storage.generateUploadUrl();
  },
});

export const setInstallerPhotoFromHttp = internalMutation({
  args: { token: v.string(), photoKey: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const report = await reportByToken(ctx, args.token);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    if (report.status === "signed") throw new ConvexError("REPORT_LOCKED");
    let matched = false;
    const photos = report.photos.map((p) => {
      if (p.key !== args.photoKey) return p;
      matched = true;
      if (p.storageId && p.storageId !== args.storageId) {
        ctx.storage.delete(p.storageId).catch(() => {});
      }
      return { ...p, storageId: args.storageId };
    });
    if (!matched) throw new ConvexError("UNKNOWN_PHOTO_SLOT");
    await ctx.db.patch(report._id, { photos, updatedAt: Date.now() });
  },
});

export const updateInstallerChecksFromHttp = internalMutation({
  args: {
    token: v.string(),
    checks: v.array(v.object({ key: v.string(), passed: v.boolean() })),
    installerNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await reportByToken(ctx, args.token);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    if (report.status === "signed") throw new ConvexError("REPORT_LOCKED");
    const passedByKey = new Map(args.checks.map((c) => [c.key, c.passed]));
    const checks = report.checks.map((c) => ({ ...c, passed: passedByKey.get(c.key) ?? c.passed }));
    await ctx.db.patch(report._id, {
      checks,
      installerNotes: args.installerNotes?.trim().slice(0, 2000) ?? report.installerNotes,
      updatedAt: Date.now(),
    });
  },
});

export const signByInstallerFromHttp = internalMutation({
  args: {
    token: v.string(),
    signatureDataUrl: v.string(),
    signedByName: v.string(),
    clientRemarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await reportByToken(ctx, args.token);
    if (!report) throw new ConvexError("REPORT_NOT_FOUND");
    if (report.status === "signed") throw new ConvexError("ALREADY_SIGNED");

    const missing = report.photos.filter((p) => !p.storageId);
    if (missing.length > 0) {
      throw new ConvexError(`PHOTOS_INCOMPLETE:${missing.map((p) => p.key).join(",")}`);
    }
    assertSignature(args.signatureDataUrl);
    const signedByName = args.signedByName.trim();
    if (!signedByName) throw new ConvexError("SIGNER_NAME_REQUIRED");

    const now = Date.now();
    await ctx.db.patch(report._id, {
      signatureDataUrl: args.signatureDataUrl,
      signedByName,
      clientRemarks: args.clientRemarks?.trim().slice(0, 2000) ?? report.clientRemarks,
      signedAt: now,
      status: "signed",
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      tenantId: report.tenantId,
      actorKind: "system",
      action: "inspection.signed_by_installer",
      targetTable: "inspectionReports",
      targetId: report._id,
      meta: { signedByName, signedAt: now, team: report.installerTeam },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
      tenantId: report.tenantId,
      type: "system",
      data: {
        kind: "inspection_signed",
        message: `Verbale di collaudo firmato — ${report.customerName}`,
      },
      href: `/app/inspections`,
    });
    return { ok: true };
  },
});
