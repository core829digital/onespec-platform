import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireTenantRole, requireMembership } from "./lib/auth";
import { enforceForCreateQuote, enforceForESignature, enforceForMultiSupplier } from "./lib/enforcement";
import { calculatePrice, type ProjectItem, type CatalogPayload } from "../src/shared/pricing";
import { currentPeriod } from "./lib/entitlements";
import { regionForCountry } from "./lib/regions";

/** Max size of a base64 signature PNG data URL (~200 KB of characters). */
const MAX_SIGNATURE_LEN = 200_000;

const QUOTE_STATUS = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("quoted"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("spam"),
);

export const listRequests = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(QUOTE_STATUS),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("quoteRequests")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", status),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("quoteRequests")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const getRequest = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return null;
    await requireMembership(ctx, quote.tenantId);
    return quote;
  },
});

export const updateStatus = mutation({
  args: { quoteId: v.id("quoteRequests"), status: v.union(v.literal("new"), v.literal("contacted"), v.literal("quoted"), v.literal("won"), v.literal("lost"), v.literal("spam")) },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    const oldStatus = quote.status;
    await ctx.db.patch(args.quoteId, { status: args.status });

    await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
      tenantId: quote.tenantId,
      type: "quote_status_changed",
      data: { quoteId: args.quoteId, oldStatus, newStatus: args.status, leadName: quote.leadName },
      href: `/app/requests/${args.quoteId}`,
    });

    await ctx.db.insert("auditLog", {
      tenantId: quote.tenantId,
      actorKind: "user",
      action: "quote.status_change",
      targetTable: "quoteRequests",
      targetId: args.quoteId,
      meta: { oldStatus, newStatus: args.status },
      createdAt: Date.now(),
    });
  },
});

export const assignRequest = mutation({
  args: { quoteId: v.id("quoteRequests"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    const assigneeMembership = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", quote.tenantId).eq("userId", args.userId),
      )
      .unique();
    if (!assigneeMembership || assigneeMembership.status !== "active") {
      throw new ConvexError("ASSIGNEE_NOT_A_MEMBER");
    }

    await ctx.db.patch(args.quoteId, { assignedToUserId: args.userId });
  },
});

export const addNote = mutation({
  args: { quoteId: v.id("quoteRequests"), note: v.string() },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireTenantRole(ctx, quote.tenantId, ["owner", "admin"]);

    await ctx.db.patch(args.quoteId, { internalNotes: (quote.internalNotes || "") + "\n" + args.note });
  },
});

export const createFieldQuote = mutation({
  args: {
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    leadName: v.string(),
    leadEmail: v.string(),
    leadPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    leadLocale: v.optional(v.string()),
    leadMessage: v.optional(v.string()),
    items: v.any(),
    installationType: v.optional(v.string()),
    installationPriceCents: v.optional(v.number()),
    demolitionPriceCents: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
    ecobonusPercent: v.optional(v.number()),
    /** Country-specific line items (Renson grilles, HVL joints, RC2/RC3, RAL kitÔÇª) priced client-side and re-clamped here. */
    regionalSurchargeCents: v.optional(v.number()),
    profitMarginPercent: v.optional(v.number()),
    vatRatePercent: v.optional(v.number()),
    depositTerms: v.optional(v.string()),
    regionCode: v.optional(v.string()),
    poseType: v.optional(v.string()),
    rgeCertificate: v.optional(v.string()),
    maPrimeRenovPercent: v.optional(v.number()),
    decennaleInsurance: v.optional(v.string()),
    rensonGrilleWidthMm: v.optional(v.number()),
    voletMonoblocHeightMm: v.optional(v.number()),
    hvlJointCount: v.optional(v.number()),
    isostoneSill: v.optional(v.boolean()),
    ralMontage: v.optional(v.boolean()),
    rcSecurityLevel: v.optional(v.string()),
    klimabonusEligible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await enforceForCreateQuote(ctx, args.tenantId);
    const { userId } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin", "member"]);
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.tenantId !== args.tenantId) {
      throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    }

    const targetVersion = configurator.publishedCatalogVersion ?? 1;
    const versionDoc = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", args.configuratorId).eq("version", targetVersion),
      )
      .unique();

    if (!versionDoc) throw new ConvexError("NO_PUBLISHED_VERSION");

    const payload = versionDoc.payload as CatalogPayload;
    const items: ProjectItem[] = Array.isArray(args.items) ? args.items : [];

    // Authoritative calculation ÔÇö server is the source of truth for price.
    const baseCalc = calculatePrice(payload, items);

    const installCost = Math.max(args.installationPriceCents ?? 0, 0);
    const demolitionCost = Math.max(args.demolitionPriceCents ?? 0, 0);
    const regionalSurcharge = Math.min(Math.max(Math.round(args.regionalSurchargeCents ?? 0), 0), 100_000_000);
    const discountPct = Math.min(Math.max(args.discountPercent ?? 0, 0), 100);
    const ecobonusPct = Math.min(Math.max(args.ecobonusPercent ?? 0, 0), 100);
    const maPrimePct = Math.min(Math.max(args.maPrimeRenovPercent ?? 0, 0), 100);

    const subtotalExVat = baseCalc.priceExVatCents + installCost + demolitionCost + regionalSurcharge;
    const discountedExVat = Math.round(subtotalExVat * (1 - discountPct / 100));

    const effectiveVat = args.vatRatePercent !== undefined ? args.vatRatePercent : configurator.vatRatePercent;
    const finalPriceCents = Math.round(discountedExVat * (1 + effectiveVat / 100));
    const ecobonusDeductionCents = ecobonusPct > 0 ? Math.round(finalPriceCents * (ecobonusPct / 100)) : undefined;
    const maPrimeRenovDeductionCents = maPrimePct > 0 ? Math.round(finalPriceCents * (maPrimePct / 100)) : undefined;

    const quoteId = await ctx.db.insert("quoteRequests", {
      tenantId: args.tenantId,
      configuratorId: args.configuratorId,
      catalogVersion: targetVersion,
      publicId: configurator.publicId,
      leadName: args.leadName.trim(),
      leadEmail: args.leadEmail.trim(),
      leadPhone: args.leadPhone?.trim(),
      customerAddress: args.customerAddress?.trim(),
      customerCity: args.customerCity?.trim(),
      customerPostalCode: args.customerPostalCode?.trim(),
      leadLocale: args.leadLocale ?? configurator.defaultLocale ?? "it",
      leadMessage: args.leadMessage,
      channel: "field_b2b",
      installationType: args.installationType,
      installationPriceCents: installCost,
      demolitionPriceCents: demolitionCost,
      discountPercent: discountPct,
      ecobonusPercent: ecobonusPct > 0 ? ecobonusPct : undefined,
      ecobonusDeductionCents,
      regionalSurchargeCents: regionalSurcharge > 0 ? regionalSurcharge : undefined,
      profitMarginPercent: args.profitMarginPercent,
      depositTerms: args.depositTerms ?? (args.regionCode === "FR" ? "Acompte 30% ├á la commande ┬À 70% ├á la livraison" : "30% ordine ┬À 60% merce pronta ┬À 10% posa"),
      regionCode: args.regionCode,
      poseType: args.poseType,
      rgeCertificate: args.rgeCertificate,
      maPrimeRenovPercent: maPrimePct > 0 ? maPrimePct : undefined,
      maPrimeRenovDeductionCents,
      decennaleInsurance: args.decennaleInsurance,
      rensonGrilleWidthMm: args.rensonGrilleWidthMm,
      voletMonoblocHeightMm: args.voletMonoblocHeightMm,
      hvlJointCount: args.hvlJointCount,
      isostoneSill: args.isostoneSill,
      ralMontage: args.ralMontage,
      rcSecurityLevel: args.rcSecurityLevel,
      klimabonusEligible: args.klimabonusEligible,
      items,
      priceCents: finalPriceCents,
      priceExVatCents: discountedExVat,
      vatRatePercent: effectiveVat,
      currency: "EUR",
      status: "quoted",
      assignedToUserId: userId,
    });

    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "quote.field_create",
      targetTable: "quoteRequests",
      targetId: quoteId,
      meta: { priceCents: finalPriceCents, leadName: args.leadName },
      createdAt: Date.now(),
    });

    // Increment quote count for quota tracking
    const period = currentPeriod();
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId).eq("period", period))
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, {
        quoteRequestsCount: counter.quoteRequestsCount + 1,
      });
    } else {
      await ctx.db.insert("usageCounters", {
        tenantId: args.tenantId,
        period,
        quoteRequestsCount: 1,
        activeConfiguratorsCount: 0,
      });
    }

    return { quoteId, priceCents: finalPriceCents };
  },
});

export const signQuote = mutation({
  args: {
    quoteId: v.id("quoteRequests"),
    signatureDataUrl: v.string(),
    signedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requireMembership(ctx, quote.tenantId);
    await enforceForESignature(ctx, quote.tenantId);

    if (!args.signatureDataUrl.startsWith("data:image/")) {
      throw new ConvexError("INVALID_SIGNATURE");
    }
    if (args.signatureDataUrl.length > MAX_SIGNATURE_LEN) {
      throw new ConvexError("SIGNATURE_TOO_LARGE");
    }
    const signedByName = args.signedByName.trim();
    if (!signedByName) throw new ConvexError("SIGNER_NAME_REQUIRED");

    const now = Date.now();
    await ctx.db.patch(args.quoteId, {
      signatureDataUrl: args.signatureDataUrl,
      signedByName,
      signedAt: now,
      status: "won",
    });

    await ctx.db.insert("auditLog", {
      tenantId: quote.tenantId,
      actorKind: "user",
      action: "quote.signed",
      targetTable: "quoteRequests",
      targetId: args.quoteId,
      meta: { signedByName: args.signedByName, signedAt: now },
      createdAt: now,
    });

    return { ok: true, signedAt: now };
  },
});

export const getQuoteForPrint = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return null;
    await requireMembership(ctx, quote.tenantId);

    const tenant = await ctx.db.get(quote.tenantId);
    const branding = await ctx.db
      .query("branding")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", quote.configuratorId))
      .unique();

    const configurator = await ctx.db.get(quote.configuratorId);

return {
      quote,
      tenant,
      branding,
      configurator,
    };
  },
});
/** Create a field quote from a completed survey — links survey to quote and pre-fills quote with survey data. */
export const createFieldQuoteFromSurvey = mutation({
  args: {
    tenantId: v.id('tenants'),
    surveyId: v.id('siteSurveys'),
    configuratorId: v.id('configurators'),
  },
  handler: async (ctx, args) => {
    await enforceForCreateQuote(ctx, args.tenantId);
    const { userId } = await requireTenantRole(ctx, args.tenantId, ['owner', 'admin', 'member']);

    // Get the survey
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new ConvexError('SURVEY_NOT_FOUND');
    if (survey.tenantId !== args.tenantId) throw new ConvexError('TENANT_MISMATCH');
    if (survey.status !== 'completed') throw new ConvexError('SURVEY_NOT_COMPLETED');
    if (survey.quoteId) throw new ConvexError('SURVEY_ALREADY_LINKED');

    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.tenantId !== args.tenantId) {
      throw new ConvexError('CONFIGURATOR_NOT_FOUND');
    }

    const targetVersion = configurator.publishedCatalogVersion ?? 1;
    const versionDoc = await ctx.db
      .query('catalogVersions')
      .withIndex('by_configurator_version', (q) =>
        q.eq('configuratorId', args.configuratorId).eq('version', targetVersion),
      )
      .unique();

    if (!versionDoc) throw new ConvexError('NO_PUBLISHED_VERSION');

    const payload = versionDoc.payload as CatalogPayload;

    // Convert survey openings to quote items with default values
    const items: ProjectItem[] = survey.openings.map((opening) => {
      const firstEnabledMaterial = payload.materials.find((m) => m.enabled);
      const material = firstEnabledMaterial?.key ?? 'pvc';
      return {
        productType: 'window' as const,
        material,
        quality: { [material]: 'standard' },
        profileSystem: 'standard',
        width: opening.widthMm,
        height: opening.heightMm,
        quantity: 1,
        sashes: [
          { type: 'tiltturn', direction: 'right', active: true, hardware: 'standard', hardwareColor: 'white' },
        ],
        glazing: 'double',
        color: 'white',
        insectScreen: false,
        installation: 'standard',
      };
    });

    // Use survey data for quote
    const tenant = await ctx.db.get(args.tenantId);
    const region = tenant?.country ? regionForCountry(tenant.country).code : 'IT';

    const baseCalc = calculatePrice(payload, items);

    const installCost = 0;
    const demolitionCost = 0;
    const regionalSurcharge = 0;
    const discountPct = 0;
    const ecobonusPct = 0;
    const maPrimePct = 0;

    const subtotalExVat = baseCalc.priceExVatCents;
    const discountedExVat = Math.round(subtotalExVat * (1 - 0 / 100));

    const effectiveVat = configurator.vatRatePercent;
    const finalPriceCents = Math.round(discountedExVat * (1 + effectiveVat / 100));

    const quoteId = await ctx.db.insert('quoteRequests', {
      tenantId: args.tenantId,
      configuratorId: args.configuratorId,
      catalogVersion: targetVersion,
      publicId: configurator.publicId,
      leadName: survey.customerName,
      leadEmail: '',
      leadPhone: undefined,
      customerAddress: survey.customerAddress,
      customerCity: survey.customerCity,
      customerPostalCode: survey.customerPostalCode,
      leadLocale: configurator.defaultLocale ?? 'it',
      leadMessage: `Generato da rilievo: ${survey.customerName}`,
      channel: 'field_b2b',
      installationType: 'standard',
      installationPriceCents: 0,
      demolitionPriceCents: 0,
      discountPercent: 0,
      regionalSurchargeCents: 0,
      profitMarginPercent: 30,
      vatRatePercent: effectiveVat,
      depositTerms: region === 'FR' ? 'Acompte 30% Ã  la commande Â· 70% Ã  la livraison' : '30% ordine Â· 60% merce pronta Â· 10% posa',
      regionCode: region,
      items,
      priceCents: finalPriceCents,
      priceExVatCents: baseCalc.priceExVatCents,
      vatRatePercent: effectiveVat,
      currency: 'EUR',
      status: 'quoted',
      assignedToUserId: userId,
    });

    // Link survey to quote
    await ctx.db.patch(args.surveyId, { quoteId, updatedAt: Date.now() });

    await ctx.db.insert('auditLog', {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: 'user',
      action: 'quote.field_create_from_survey',
      targetTable: 'quoteRequests',
      targetId: quoteId,
      meta: { priceCents: finalPriceCents, leadName: survey.customerName, surveyId: args.surveyId },
      createdAt: Date.now(),
    });

    // Increment quote count for quota tracking
    const period = currentPeriod();
    const counter = await ctx.db
      .query('usageCounters')
      .withIndex('by_tenant_period', (q) => q.eq('tenantId', args.tenantId).eq('period', period))
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, {
        quoteRequestsCount: counter.quoteRequestsCount + 1,
      });
    } else {
      await ctx.db.insert('usageCounters', {
        tenantId: args.tenantId,
        period,
        quoteRequestsCount: 1,
        activeConfiguratorsCount: 0,
      });
    }

    return { quoteId, priceCents: finalPriceCents };
  },
});

/** Create a quote with supplier lines for multi-supplier breakdown (Enterprise/Showroom only). */
export const createQuoteWithSuppliers = mutation({
  args: {
    tenantId: v.id('tenants'),
    configuratorId: v.id('configurators'),
    items: v.array(v.any()),
    supplierLines: v.array(v.object({
      supplierId: v.id('catalogSuppliers'),
      itemIndex: v.number(),
      supplierPriceCents: v.number(),
      leadTimeDays: v.number(),
    })),
    regionCode: v.union(v.literal('IT'), v.literal('FR'), v.literal('BE'), v.literal('NL'), v.literal('DE'), v.literal('LU')),
    leadName: v.string(),
    leadEmail: v.string(),
    leadPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    leadLocale: v.optional(v.string()),
    leadMessage: v.optional(v.string()),
    installationType: v.optional(v.string()),
    installationPriceCents: v.optional(v.number()),
    demolitionPriceCents: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
    ecobonusPercent: v.optional(v.number()),
    regionalSurchargeCents: v.optional(v.number()),
    profitMarginPercent: v.optional(v.number()),
    vatRatePercent: v.optional(v.number()),
    depositTerms: v.optional(v.string()),
    regionCode: v.optional(v.string()),
    poseType: v.optional(v.string()),
    rgeCertificate: v.optional(v.string()),
    maPrimeRenovPercent: v.optional(v.number()),
    decennaleInsurance: v.optional(v.string()),
    rensonGrilleWidthMm: v.optional(v.number()),
    voletMonoblocHeightMm: v.optional(v.number()),
    hvlJointCount: v.optional(v.number()),
    isostoneSill: v.optional(v.boolean()),
    ralMontage: v.optional(v.boolean()),
    rcSecurityLevel: v.optional(v.string()),
    klimabonusEligible: v.optional(v.boolean()),
    profitMarginPercent: v.optional(v.number()),
    vatRatePercent: v.optional(v.number()),
    depositTerms: v.optional(v.string()),
    regionCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await enforceForCreateQuote(ctx, args.tenantId);
    await enforceForMultiSupplier(ctx, args.tenantId);
    const { userId } = await requireTenantRole(ctx, args.tenantId, ['owner', 'admin', 'member']);

    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator || configurator.tenantId !== args.tenantId) {
      throw new ConvexError('CONFIGURATOR_NOT_FOUND');
    }

    const targetVersion = configurator.publishedCatalogVersion ?? 1;
    const versionDoc = await ctx.db
      .query('catalogVersions')
      .withIndex('by_configurator_version', (q) =>
        q.eq('configuratorId', args.configuratorId).eq('version', targetVersion),
      )
      .unique();

    if (!versionDoc) throw new ConvexError('NO_PUBLISHED_VERSION');

    const payload = versionDoc.payload as CatalogPayload;
    const items: ProjectItem[] = Array.isArray(args.items) ? args.items : [];

    // Validate supplier lines
    if (args.supplierLines && args.supplierLines.length > 0) {
      for (const line of args.supplierLines) {
        const supplier = await ctx.db.get(line.supplierId);
        if (!supplier || supplier.tenantId !== args.tenantId || !supplier.isActive) {
          throw new ConvexError('INVALID_SUPPLIER');
        }
        if (line.itemIndex < 0 || line.itemIndex >= items.length) {
          throw new ConvexError('INVALID_ITEM_INDEX');
        }
      }

    // Authoritative calculation â€” server is the source of truth for price.
    const baseCalc = calculatePrice(payload, items);

    const installCost = Math.max(args.installationPriceCents ?? 0, 0);
    const demolitionCost = Math.max(args.demolitionPriceCents ?? 0, 0);
    const regionalSurcharge = Math.min(Math.max(Math.round(args.regionalSurchargeCents ?? 0), 0), 100_000_000);
    const discountPct = Math.min(Math.max(args.discountPercent ?? 0, 0), 100);
    const ecobonusPct = Math.min(Math.max(args.ecobonusPercent ?? 0, 0), 100);
    const maPrimePct = Math.min(Math.max(args.maPrimeRenovPercent ?? 0, 0), 100);

    const subtotalExVat = baseCalc.priceExVatCents + installCost + demolitionCost + regionalSurcharge;
    const discountedExVat = Math.round(subtotalExVat * (1 - discountPct / 100));

    const effectiveVat = args.vatRatePercent !== undefined ? args.vatRatePercent : configurator.vatRatePercent;
    const finalPriceCents = Math.round(discountedExVat * (1 + effectiveVat / 100));
    const ecobonusDeductionCents = ecobonusPct > 0 ? Math.round(finalPriceCents * (ecobonusPct / 100)) : undefined;
    const maPrimeRenovDeductionCents = maPrimePct > 0 ? Math.round(finalPriceCents * (maPrimePct / 100)) : undefined;

    const quoteId = await ctx.db.insert('quoteRequests', {
      tenantId: args.tenantId,
      configuratorId: args.configuratorId,
      catalogVersion: targetVersion,
      publicId: configurator.publicId,
      leadName: args.leadName.trim(),
      leadEmail: args.leadEmail.trim(),
      leadPhone: args.leadPhone?.trim(),
      customerAddress: args.customerAddress?.trim(),
      customerCity: args.customerCity?.trim(),
      customerPostalCode: args.customerPostalCode?.trim(),
      leadLocale: args.leadLocale ?? configurator.defaultLocale ?? 'it',
      leadMessage: args.leadMessage,
      channel: 'field_b2b',
      installationType: args.installationType,
      installationPriceCents: installCost,
      demolitionPriceCents: demolitionCost,
      discountPercent: discountPct,
      ecobonusPercent: ecobonusPct > 0 ? ecobonusPct : undefined,
      ecobonusDeductionCents,
      regionalSurchargeCents: regionalSurcharge > 0 ? regionalSurcharge : undefined,
      profitMarginPercent: args.profitMarginPercent,
      depositTerms: args.depositTerms ?? (args.regionCode === 'FR' ? 'Acompte 30% Ã  la commande Â· 70% Ã  la livraison' : '30% ordine Â· 60% merce pronta Â· 10% posa'),
      regionCode: args.regionCode,
      poseType: args.poseType,
      rgeCertificate: args.rgeCertificate,
      maPrimeRenovPercent: maPrimePct > 0 ? maPrimePct : undefined,
      maPrimeRenovDeductionCents,
      decennaleInsurance: args.decennaleInsurance,
      rensonGrilleWidthMm: args.rensonGrilleWidthMm,
      voletMonoblocHeightMm: args.voletMonoblocHeightMm,
      hvlJointCount: args.hvlJointCount,
      isostoneSill: args.isostoneSill,
      ralMontage: args.ralMontage,
      rcSecurityLevel: args.rcSecurityLevel,
      klimabonusEligible: args.klimabonusEligible,
      items,
      priceCents: finalPriceCents,
      priceExVatCents: discountedExVat,
      vatRatePercent: effectiveVat,
      currency: 'EUR',
      status: 'quoted',
      assignedToUserId: userId,
      supplierLines: args.supplierLines,
    });

    await ctx.db.insert('auditLog', {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: 'user',
      action: 'quote.field_create_with_suppliers',
      targetTable: 'quoteRequests',
      targetId: quoteId,
      meta: { priceCents: finalPriceCents, leadName: args.leadName, supplierCount: args.supplierLines?.length ?? 0 },
      createdAt: Date.now(),
    });

    // Increment quote count for quota tracking
    const period = currentPeriod();
    const counter = await ctx.db
      .query('usageCounters')
      .withIndex('by_tenant_period', (q) => q.eq('tenantId', args.tenantId).eq('period', period))
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, {
        quoteRequestsCount: counter.quoteRequestsCount + 1,
      });
    } else {
      await ctx.db.insert('usageCounters', {
        tenantId: args.tenantId,
        period,
        quoteRequestsCount: 1,
        activeConfiguratorsCount: 0,
      });
    }

    return { quoteId, priceCents: finalPriceCents };
  },
});

/** Option lists for the in-app Showroom configurator (FASE 3). */
export const getShowroomCatalog = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const tenant = await ctx.db.get(args.tenantId);
    const region = regionForCountry(tenant?.country);

    const cat = await getTenantCatalog(ctx, args.tenantId);
    if (!cat) return { regionCode: region.code, ready: false as const };

    const p = cat.payload;
    const lbl = (o: { key: string; labels?: Record<string, string> }) =>
      o.labels?.[region.primaryLocale] ?? o.labels?.it ?? o.labels?.en ?? o.key;

    const materials = p.materials.filter((m) => m.enabled);
    return {
      regionCode: region.code,
      ready: true as const,
      materials: materials.map((m) => ({ key: m.key, label: lbl(m) })),
      quality: Object.fromEntries(
        materials.map((m) => [
          m.key,
          p.qualityTiers
            .filter((q) => q.materialKey === m.key && q.enabled)
            .map((q) => ({ key: q.key, label: lbl(q) })),
        ]),
      ) as Record<string, { key: string; label: string }[]>,
      glazing: p.glazing.filter((g) => g.enabled).map((g) => ({ key: g.key, label: lbl(g) })),
      finish: p.finish.filter((f) => f.enabled).map((f) => ({ key: f.key, label: lbl(f) })),
      installation: p.hardware
        .filter((h) => h.kind === 'installation' && h.enabled)
        .map((h) => ({ key: h.key, label: lbl(h), priceCents: h.priceCents })),
    };
  },
});
