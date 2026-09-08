/** Fascicolo del Serramento — digital dossier behind a QR label (Phase C). */

import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { requireTenantRegion } from "./lib/fieldModules";
import { complianceForRegion } from "./lib/compliance";
import { nanoid } from "./lib/ids";
import { internal } from "./_generated/api";

/* ----------------------------- dealer side ------------------------------ */

export const list = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query("serramentoPassports")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { passportId: v.id("serramentoPassports") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.passportId);
    if (!p) return null;
    await requireMembership(ctx, p.tenantId);
    const documents = await Promise.all(
      p.documents.map(async (d) => ({
        ...d,
        resolvedUrl: d.storageId ? await ctx.storage.getUrl(d.storageId) : d.url ?? null,
      })),
    );
    return { ...p, documents };
  },
});

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.optional(v.id("quoteRequests")),
    inspectionId: v.optional(v.id("inspectionReports")),
    label: v.string(),
    customerName: v.string(),
    siteAddress: v.optional(v.string()),
    productSummary: v.optional(v.string()),
    installedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    const label = args.label.trim();
    const customerName = args.customerName.trim();
    if (!label) throw new ConvexError("LABEL_REQUIRED");
    if (!customerName) throw new ConvexError("CUSTOMER_NAME_REQUIRED");

    const req = complianceForRegion(regionCode).dossier;
    const now = Date.now();
    return await ctx.db.insert("serramentoPassports", {
      tenantId: args.tenantId,
      regionCode,
      quoteId: args.quoteId,
      inspectionId: args.inspectionId,
      createdByUserId: userId,
      publicToken: nanoid(16),
      label,
      customerName,
      siteAddress: args.siteAddress?.trim(),
      productSummary: args.productSummary?.trim(),
      installedAt: args.installedAt,
      documents: req.documents.map((d) => ({ key: d.key, label: d.label, required: d.required })),
      performanceDeclaration: req.performanceDeclaration,
      maintenanceLabel: req.maintenance.label,
      maintenancePriceCents: req.maintenance.defaultPriceCents,
      maintenanceActive: false,
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const attachDocument = mutation({
  args: {
    passportId: v.id("serramentoPassports"),
    key: v.string(),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.passportId);
    if (!p) throw new ConvexError("PASSPORT_NOT_FOUND");
    await requireTenantRole(ctx, p.tenantId, ["owner", "admin", "member"]);
    if (args.url && !/^https:\/\//i.test(args.url)) throw new ConvexError("INVALID_URL");

    let matched = false;
    const documents = p.documents.map((d) => {
      if (d.key !== args.key) return d;
      matched = true;
      if (d.storageId && d.storageId !== args.storageId) ctx.storage.delete(d.storageId).catch(() => {});
      return { ...d, storageId: args.storageId, url: args.url };
    });
    if (!matched) throw new ConvexError("UNKNOWN_DOCUMENT_SLOT");
    await ctx.db.patch(args.passportId, { documents, updatedAt: Date.now() });
  },
});

export const setMaintenance = mutation({
  args: {
    passportId: v.id("serramentoPassports"),
    active: v.boolean(),
    priceCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.passportId);
    if (!p) throw new ConvexError("PASSPORT_NOT_FOUND");
    await requireTenantRole(ctx, p.tenantId, ["owner", "admin"]);
    await ctx.db.patch(args.passportId, {
      maintenanceActive: args.active,
      maintenancePriceCents:
        args.priceCents !== undefined
          ? Math.min(Math.max(Math.round(args.priceCents), 0), 10_000_000)
          : p.maintenancePriceCents,
      updatedAt: Date.now(),
    });
  },
});

export const listInterventions = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    return await ctx.db
      .query("passportInterventions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(100);
  },
});

export const updateInterventionStatus = mutation({
  args: {
    interventionId: v.id("passportInterventions"),
    status: v.union(v.literal("new"), v.literal("scheduled"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const iv = await ctx.db.get(args.interventionId);
    if (!iv) throw new ConvexError("INTERVENTION_NOT_FOUND");
    await requireTenantRole(ctx, iv.tenantId, ["owner", "admin", "member"]);
    await ctx.db.patch(args.interventionId, { status: args.status });
  },
});

/* ----------------------------- public (QR) ------------------------------ */

/** End-client view of a dossier — no auth. Returns only client-safe fields. */
export const getPublicByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("serramentoPassports")
      .withIndex("by_token", (q) => q.eq("publicToken", args.token))
      .unique();
    if (!p) return null;

    const tenant = await ctx.db.get(p.tenantId);
    const branding = p.quoteId
      ? await ctx.db.get(p.quoteId).then((q) =>
          q
            ? ctx.db
                .query("branding")
                .withIndex("by_configurator", (b) => b.eq("configuratorId", q.configuratorId))
                .unique()
            : null,
        )
      : null;

    const documents = await Promise.all(
      p.documents.map(async (d) => ({
        key: d.key,
        label: d.label,
        available: !!(d.storageId || d.url),
        url: d.storageId ? await ctx.storage.getUrl(d.storageId) : d.url ?? null,
      })),
    );

    return {
      label: p.label,
      customerName: p.customerName,
      productSummary: p.productSummary ?? null,
      installedAt: p.installedAt ?? null,
      performanceDeclaration: p.performanceDeclaration ?? null,
      maintenanceLabel: p.maintenanceLabel ?? null,
      maintenancePriceCents: p.maintenancePriceCents ?? null,
      documents,
      dealerName: branding?.companyInfo?.name ?? tenant?.name ?? "",
      dealerPhone: branding?.companyInfo?.phone ?? null,
      dealerEmail: branding?.companyInfo?.email ?? null,
    };
  },
});

export const recordScan = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("serramentoPassports")
      .withIndex("by_token", (q) => q.eq("publicToken", args.token))
      .unique();
    if (!p) return;
    await ctx.db.patch(p._id, { scanCount: p.scanCount + 1, lastScannedAt: Date.now() });
  },
});

export const recordInterventionFromHttp = internalMutation({
  args: {
    token: v.string(),
    kind: v.union(
      v.literal("adjustment"),
      v.literal("warranty"),
      v.literal("maintenance"),
      v.literal("other"),
    ),
    message: v.string(),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    sourceIpHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = args.message.trim().slice(0, 2000);
    if (message.length < 3) throw new ConvexError("MESSAGE_REQUIRED");
    const p = await ctx.db
      .query("serramentoPassports")
      .withIndex("by_token", (q) => q.eq("publicToken", args.token))
      .unique();
    if (!p) throw new ConvexError("PASSPORT_NOT_FOUND");

    const id = await ctx.db.insert("passportInterventions", {
      tenantId: p.tenantId,
      passportId: p._id,
      kind: args.kind,
      message,
      contactName: args.contactName?.trim().slice(0, 120),
      contactPhone: args.contactPhone?.trim().slice(0, 40),
      contactEmail: args.contactEmail?.trim().slice(0, 160),
      status: "new",
      sourceIpHash: args.sourceIpHash,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
      tenantId: p.tenantId,
      type: "system",
      data: {
        kind: "passport_intervention",
        passportLabel: p.label,
        interventionKind: args.kind,
        message: `Richiesta post-vendita (${args.kind}) — ${p.label}`,
      },
      href: `/app/passports`,
    });
    return { ok: true, id };
  },
});
