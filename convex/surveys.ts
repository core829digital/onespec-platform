/** Rilievo Cantiere — on-site survey module (Phase C). */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { requireTenantRegion } from "./lib/fieldModules";

const openingValidator = v.object({
  label: v.string(),
  widthMm: v.number(),
  heightMm: v.number(),
  room: v.optional(v.string()),
  floor: v.optional(v.string()),
  laserSource: v.optional(v.string()),
  notes: v.optional(v.string()),
  photoStorageIds: v.optional(v.array(v.id("_storage"))),
});

const diagnosticsValidator = v.object({
  wallType: v.optional(v.string()),
  counterFrame: v.optional(v.string()),
  mould: v.optional(v.boolean()),
  floorAccess: v.optional(v.string()),
  craneRequired: v.optional(v.boolean()),
  existingShutter: v.optional(v.boolean()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query("siteSurveys")
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
      .query("siteSurveys")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();
  },
});

export const get = query({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return null;
    await requireMembership(ctx, survey.tenantId);

    const openings = await Promise.all(
      survey.openings.map(async (o) => ({
        ...o,
        photoUrls: o.photoStorageIds
          ? await Promise.all(o.photoStorageIds.map((id) => ctx.storage.getUrl(id)))
          : [],
      })),
    );
    return { ...survey, openings };
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
    customerName: v.string(),
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    openings: v.array(openingValidator),
    diagnostics: diagnosticsValidator,
  },
  handler: async (ctx, args) => {
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    const name = args.customerName.trim();
    if (!name) throw new ConvexError("CUSTOMER_NAME_REQUIRED");

    const now = Date.now();
    return await ctx.db.insert("siteSurveys", {
      tenantId: args.tenantId,
      regionCode,
      quoteId: args.quoteId,
      createdByUserId: userId,
      customerName: name,
      customerAddress: args.customerAddress?.trim(),
      customerCity: args.customerCity?.trim(),
      customerPostalCode: args.customerPostalCode?.trim(),
      openings: args.openings,
      diagnostics: args.diagnostics,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    surveyId: v.id("siteSurveys"),
    customerName: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    openings: v.optional(v.array(openingValidator)),
    diagnostics: v.optional(diagnosticsValidator),
    status: v.optional(v.union(v.literal("draft"), v.literal("completed"), v.literal("synced"))),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError("SURVEY_NOT_FOUND");
    await requireTenantRole(ctx, survey.tenantId, ["owner", "admin", "member"]);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.customerName !== undefined) patch.customerName = args.customerName.trim();
    if (args.customerAddress !== undefined) patch.customerAddress = args.customerAddress.trim();
    if (args.customerCity !== undefined) patch.customerCity = args.customerCity.trim();
    if (args.customerPostalCode !== undefined) patch.customerPostalCode = args.customerPostalCode.trim();
    if (args.openings !== undefined) patch.openings = args.openings;
    if (args.diagnostics !== undefined) patch.diagnostics = args.diagnostics;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "completed" && !survey.completedAt) patch.completedAt = Date.now();
    }
    await ctx.db.patch(args.surveyId, patch);
  },
});

export const remove = mutation({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return;
    await requireTenantRole(ctx, survey.tenantId, ["owner", "admin"]);
    for (const o of survey.openings) {
      for (const id of o.photoStorageIds ?? []) {
        await ctx.storage.delete(id).catch(() => {});
      }
    }
    await ctx.db.delete(args.surveyId);
  },
});
