import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireTenantRole, requireMembership } from "./lib/auth";
import { calculatePrice, type ProjectItem, type CatalogPayload } from "../src/shared/pricing";

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

    // Authoritative calculation — server is the source of truth for price.
    const baseCalc = calculatePrice(payload, items);

    const installCost = Math.max(args.installationPriceCents ?? 0, 0);
    const demolitionCost = Math.max(args.demolitionPriceCents ?? 0, 0);
    const discountPct = Math.min(Math.max(args.discountPercent ?? 0, 0), 100);
    const ecobonusPct = Math.min(Math.max(args.ecobonusPercent ?? 0, 0), 100);
    const maPrimePct = Math.min(Math.max(args.maPrimeRenovPercent ?? 0, 0), 100);

    const subtotalExVat = baseCalc.priceExVatCents + installCost + demolitionCost;
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
      profitMarginPercent: args.profitMarginPercent,
      depositTerms: args.depositTerms ?? (args.regionCode === "FR" ? "Acompte 30% à la commande · 70% à la livraison" : "30% ordine · 60% merce pronta · 10% posa"),
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
