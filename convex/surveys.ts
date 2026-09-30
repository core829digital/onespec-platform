/** Rilievo Cantiere — on-site survey module (Phase C). */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requirePermission } from "./lib/rbac";
import { requireTenantRegion } from "./lib/fieldModules";
import { enforceForFieldSurvey } from "./lib/enforcement";
import { resolveLinks, logClientActivity, assertOwnedRefs } from "./lib/links";
import { assertStoredFile } from "./lib/uploads";

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
  recommendation: v.optional(v.string()),
});

const MAX_LASER_MEASUREMENTS = 500;
const MAX_OPENINGS = 200;
const MAX_PHOTOS = 100;

/** Arrays stored inside the survey doc are bounded (1 MB document limit). */
function assertSurveyArrays(a: { openings?: unknown[]; photos?: Array<{ annotations?: unknown[] }>; laserMeasurements?: unknown[] }): void {
  // Annotations are free-form drawing data: bounded per photo and in total size.
  for (const p of a.photos ?? []) {
    if ((p.annotations?.length ?? 0) > 200 || JSON.stringify(p.annotations ?? []).length > 100_000) {
      throw new ConvexError("INVALID_INPUT");
    }
  }
  if ((a.openings?.length ?? 0) > MAX_OPENINGS || (a.photos?.length ?? 0) > MAX_PHOTOS ||
      (a.laserMeasurements?.length ?? 0) > MAX_LASER_MEASUREMENTS) {
    throw new ConvexError("INVALID_INPUT");
  }
}

const laserMeasurementValidator = v.object({
  L: v.number(),
  H: v.number(),
  timestamp: v.number(),
  deviceId: v.optional(v.string()),
});

const photoValidator = v.object({
  storageId: v.id("_storage"),
  annotations: v.optional(v.array(v.any())),
  type: v.optional(v.union(v.literal("foro"), v.literal("controtelaio"), v.literal("davanzale"), v.literal("rulou"))),
  uploadedAt: v.number(),
});

export const list = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "surveys.use");
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
    await requirePermission(ctx, quote.tenantId, "surveys.use");
    return await ctx.db
      .query("siteSurveys")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .take(200)
      .then((rows) => rows.filter((r) => r.tenantId === quote.tenantId));
  },
});

export const get = query({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return null;
    await requirePermission(ctx, survey.tenantId, "surveys.use");

    const openings = await Promise.all(
      survey.openings.map(async (o) => ({
        ...o,
        photoUrls: o.photoStorageIds
          ? await Promise.all(o.photoStorageIds.map((id) => ctx.storage.getUrl(id)))
          : [],
      })),
    );

    const photos = await Promise.all(
      (survey.photos ?? []).map(async (p) => ({
        ...p,
        url: await ctx.storage.getUrl(p.storageId),
      }))
    );

    return { ...survey, openings, photos };
  },
});

/** Survey + tenant header data for the PDF sheet (photos resolved to URLs). */
export const getForPrint = query({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return null;
    await requirePermission(ctx, survey.tenantId, "surveys.use");
    const tenant = await ctx.db.get(survey.tenantId);
    const openings = await Promise.all(
      survey.openings.map(async (o) => ({
        ...o,
        photoUrls: o.photoStorageIds
          ? await Promise.all(o.photoStorageIds.map((id) => ctx.storage.getUrl(id)))
          : [],
      })),
    );
    const photos = await Promise.all(
      (survey.photos ?? []).map(async (p) => ({
        storageId: p.storageId,
        type: p.type,
        uploadedAt: p.uploadedAt,
        url: await ctx.storage.getUrl(p.storageId),
      })),
    );
    return { survey: { ...survey, openings, photos }, tenant };
  },
});

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "surveys.use");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.optional(v.id("quoteRequests")),
    clientId: v.optional(v.id("clients")),
    cantiereId: v.optional(v.id("cantieri")),
    customerName: v.string(),
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    openings: v.array(openingValidator),
    diagnostics: diagnosticsValidator,
    laserMeasurements: v.optional(v.array(laserMeasurementValidator)),
    photos: v.optional(v.array(photoValidator)),
  },
  handler: async (ctx, args) => {
    await enforceForFieldSurvey(ctx, args.tenantId);
    await requirePermission(ctx, args.tenantId, "surveys.use");
    assertSurveyArrays(args);
    for (const p of args.photos ?? []) await assertStoredFile(ctx, p.storageId, { kind: "image" });
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    await assertOwnedRefs(ctx, args.tenantId, { quoteId: args.quoteId });
    const links = await resolveLinks(ctx, args.tenantId, {
      clientId: args.clientId,
      cantiereId: args.cantiereId,
    });
    // Picking a client is enough — no need to retype their name/address.
    const name = args.customerName.trim() || links.client?.name || "";
    if (!name) throw new ConvexError("CUSTOMER_NAME_REQUIRED");

    const now = Date.now();
    const surveyId = await ctx.db.insert("siteSurveys", {
      tenantId: args.tenantId,
      regionCode,
      quoteId: args.quoteId,
      clientId: links.clientId,
      cantiereId: links.cantiereId,
      createdByUserId: userId,
      customerName: name,
      customerAddress: args.customerAddress?.trim() || links.client?.siteAddress,
      customerCity: args.customerCity?.trim() || links.client?.siteCity,
      customerPostalCode: args.customerPostalCode?.trim() || links.client?.sitePostalCode,
      openings: args.openings,
      diagnostics: args.diagnostics,
      laserMeasurements: args.laserMeasurements ?? [],
      photos: args.photos ?? [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await logClientActivity(ctx, {
      tenantId: args.tenantId,
      clientId: links.clientId,
      userId,
      type: "survey",
      title: "Rilievo creato",
      relatedTable: "siteSurveys",
      relatedId: surveyId,
    });
    return surveyId;
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
    laserMeasurements: v.optional(v.array(laserMeasurementValidator)),
    photos: v.optional(v.array(photoValidator)),
    status: v.optional(v.union(v.literal("draft"), v.literal("completed"), v.literal("synced"))),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError("SURVEY_NOT_FOUND");
    await requirePermission(ctx, survey.tenantId, "surveys.use");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.customerName !== undefined) patch.customerName = args.customerName.trim();
    if (args.customerAddress !== undefined) patch.customerAddress = args.customerAddress.trim();
    if (args.customerCity !== undefined) patch.customerCity = args.customerCity.trim();
    if (args.customerPostalCode !== undefined) patch.customerPostalCode = args.customerPostalCode.trim();
    assertSurveyArrays(args);
    for (const p of args.photos ?? []) await assertStoredFile(ctx, p.storageId, { kind: "image" });
    if (args.openings !== undefined) patch.openings = args.openings;
    if (args.diagnostics !== undefined) patch.diagnostics = args.diagnostics;
    if (args.laserMeasurements !== undefined) patch.laserMeasurements = args.laserMeasurements;
    if (args.photos !== undefined) patch.photos = args.photos;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "completed" && !survey.completedAt) patch.completedAt = Date.now();
    }
    await ctx.db.patch(args.surveyId, patch);
  },
});

export const saveLaserMeasurement = mutation({
  args: {
    surveyId: v.id("siteSurveys"),
    measurement: laserMeasurementValidator,
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError("SURVEY_NOT_FOUND");
    await requirePermission(ctx, survey.tenantId, "surveys.use");

    // Appended to an array field of the survey doc: bounded so a long session
    // (or a device streaming readings) can never push it to the 1 MB limit.
    if ((survey.laserMeasurements?.length ?? 0) >= MAX_LASER_MEASUREMENTS) throw new ConvexError("INVALID_INPUT");
    const measurements = [...(survey.laserMeasurements ?? []), args.measurement];
    await ctx.db.patch(args.surveyId, { laserMeasurements: measurements, updatedAt: Date.now() });
  },
});

export const saveDiagnosticRecommendation = mutation({
  args: {
    surveyId: v.id("siteSurveys"),
    recommendation: v.string(),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError("SURVEY_NOT_FOUND");
    await requirePermission(ctx, survey.tenantId, "surveys.use");

    const diagnostics = { ...survey.diagnostics, recommendation: args.recommendation };
    await ctx.db.patch(args.surveyId, { diagnostics, updatedAt: Date.now() });
  },
});

export const completeSurvey = mutation({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError("SURVEY_NOT_FOUND");
    await requirePermission(ctx, survey.tenantId, "surveys.use");
    if (survey.status === "completed") return;
    // A survey with no usable measurement can't become a quote — refuse
    // instead of letting an empty rilievo reach 'Genera preventivo'.
    if (!survey.openings.some((o) => o.widthMm > 0 && o.heightMm > 0)) {
      throw new ConvexError("NO_ITEMS");
    }

    await ctx.db.patch(args.surveyId, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { surveyId: v.id("siteSurveys") },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return;
    await requirePermission(ctx, survey.tenantId, "surveys.delete");
    // Delete every stored file: per-opening photos AND the survey-level
    // photos (these used to be left behind in storage).
    for (const o of survey.openings) {
      for (const id of o.photoStorageIds ?? []) {
        await ctx.storage.delete(id).catch(() => {});
      }
    }
    for (const p of survey.photos ?? []) {
      await ctx.storage.delete(p.storageId).catch(() => {});
    }
    await ctx.db.delete(args.surveyId);
  },
});
