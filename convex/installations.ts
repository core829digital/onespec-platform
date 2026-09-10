/** Posa UNI 11673 wizard — installation-node design + bill of materials (Phase C). */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { requireTenantRegion } from "./lib/fieldModules";
import { enforceForFullFieldModules } from "./lib/enforcement";
import { complianceForRegion, computePosaMaterials } from "./lib/compliance";
import { regionForCountry } from "./lib/regions";

/** Static per-market ruleset for the wizard UI (job types, nodes, notes). */
export const getStandard = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const tenant = await ctx.db.get(args.tenantId);
    const region = regionForCountry(tenant?.country);
    const compliance = complianceForRegion(region.code);
    return {
      regionCode: region.code,
      complianceFlags: region.complianceFlags,
      fundingTitle: compliance.funding.title,
      inspectionTitle: compliance.inspection.title,
      ...compliance.installation,
    };
  },
});

export const list = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query("installationDossiers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { dossierId: v.id("installationDossiers") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.dossierId);
    if (!doc) return null;
    await requireMembership(ctx, doc.tenantId);
    return doc;
  },
});

export const listByQuote = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return [];
    await requireMembership(ctx, quote.tenantId);
    return await ctx.db
      .query("installationDossiers")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();
  },
});

export const getForPrint = query({
  args: { dossierId: v.id("installationDossiers") },
  handler: async (ctx, args) => {
    const dossier = await ctx.db.get(args.dossierId);
    if (!dossier) return null;
    await requireMembership(ctx, dossier.tenantId);
    const tenant = await ctx.db.get(dossier.tenantId);
    const region = regionForCountry(dossier.regionCode).code;
    const std = complianceForRegion(region).installation;
    const jobLabel = std.jobTypes.find((j) => j.key === dossier.jobType)?.label ?? dossier.jobType;
    const nodeLabel = std.nodeTypes.find((n) => n.key === dossier.nodeType)?.label ?? dossier.nodeType;
    const survey = dossier.surveyId ? await ctx.db.get(dossier.surveyId) : null;
    const quote = dossier.quoteId ? await ctx.db.get(dossier.quoteId) : null;
    return { dossier, tenant, jobLabel, nodeLabel, notes: std.notes, survey, quote };
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.optional(v.id("quoteRequests")),
    surveyId: v.optional(v.id("siteSurveys")),
    jobType: v.string(),
    nodeType: v.string(),
    perimeterMm: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await enforceForFullFieldModules(ctx, args.tenantId);
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    const std = complianceForRegion(regionCode).installation;

    if (!std.jobTypes.some((j) => j.key === args.jobType)) throw new ConvexError("INVALID_JOB_TYPE");
    if (!std.nodeTypes.some((n) => n.key === args.nodeType)) throw new ConvexError("INVALID_NODE_TYPE");

    const perimeterMm = Math.min(Math.max(Math.round(args.perimeterMm), 0), 1_000_000);
    const materials = computePosaMaterials(regionCode, perimeterMm);

    const now = Date.now();
    return await ctx.db.insert("installationDossiers", {
      tenantId: args.tenantId,
      regionCode,
      quoteId: args.quoteId,
      surveyId: args.surveyId,
      createdByUserId: userId,
      jobType: args.jobType,
      nodeType: args.nodeType,
      perimeterMm,
      materials,
      normRef: std.norm,
      notes: args.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    dossierId: v.id("installationDossiers"),
    jobType: v.optional(v.string()),
    nodeType: v.optional(v.string()),
    perimeterMm: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.dossierId);
    if (!doc) throw new ConvexError("DOSSIER_NOT_FOUND");
    await requireTenantRole(ctx, doc.tenantId, ["owner", "admin", "member"]);
    const region = regionForCountry(doc.regionCode).code;
    const std = complianceForRegion(region).installation;

    const jobType = args.jobType ?? doc.jobType;
    const nodeType = args.nodeType ?? doc.nodeType;
    if (!std.jobTypes.some((j) => j.key === jobType)) throw new ConvexError("INVALID_JOB_TYPE");
    if (!std.nodeTypes.some((n) => n.key === nodeType)) throw new ConvexError("INVALID_NODE_TYPE");

    const perimeterMm =
      args.perimeterMm !== undefined
        ? Math.min(Math.max(Math.round(args.perimeterMm), 0), 1_000_000)
        : doc.perimeterMm;

    await ctx.db.patch(args.dossierId, {
      jobType,
      nodeType,
      perimeterMm,
      materials: computePosaMaterials(region, perimeterMm),
      notes: args.notes !== undefined ? args.notes.trim() : doc.notes,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { dossierId: v.id("installationDossiers") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.dossierId);
    if (!doc) return;
    await requireTenantRole(ctx, doc.tenantId, ["owner", "admin"]);
    await ctx.db.delete(args.dossierId);
  },
});
