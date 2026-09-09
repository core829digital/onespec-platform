/** Fascicolo del Serramento — digital dossier behind a QR label (Phase C). */

import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { requireTenantRegion } from "./lib/fieldModules";
import { complianceForRegion } from "./lib/compliance";
import { regionForCountry } from "./lib/regions";
import { guessZoneFromCap, buildAllegatoF, allegatoFToXml, type ClimateZone } from "./lib/enea";
import { computeOverallUw, type CatalogPayload, type ProjectItem } from "../src/shared/pricing";
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

export const listByQuote = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return [];
    await requireMembership(ctx, quote.tenantId);
    return await ctx.db
      .query("serramentoPassports")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();
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

/**
 * One fascicolo per serramento of a signed field quote (FASE 6.1). Expands each
 * quote item by quantity and skips items that already have a passport.
 */
export const createBatchFromQuote = mutation({
  args: { tenantId: v.id("tenants"), quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const { userId, regionCode } = await requireTenantRegion(ctx, args.tenantId);
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.tenantId !== args.tenantId) throw new ConvexError("QUOTE_NOT_FOUND");

    const existing = await ctx.db
      .query("serramentoPassports")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();

    const req = complianceForRegion(regionCode).dossier;
    const rawItems = Array.isArray(quote.items) ? (quote.items as Record<string, unknown>[]) : [];
    const units: string[] = [];
    rawItems.forEach((it, i) => {
      const qty = Math.max(1, Math.round(Number(it.quantity ?? 1)));
      const base =
        `${it.productType === "balconyDoor" ? "Porta-finestra" : "Finestra"} ${it.width ?? "?"}×${
          it.height ?? "?"
        }`.trim() || `Serramento ${i + 1}`;
      for (let k = 0; k < qty; k++) units.push(qty > 1 ? `${base} (${k + 1}/${qty})` : base);
    });

    const now = Date.now();
    const created: string[] = [];
    for (let idx = existing.length; idx < units.length; idx++) {
      const id = await ctx.db.insert("serramentoPassports", {
        tenantId: args.tenantId,
        regionCode,
        quoteId: args.quoteId,
        createdByUserId: userId,
        publicToken: nanoid(16),
        label: `FIN-${String(idx + 1).padStart(2, "0")} · ${units[idx]}`,
        customerName: quote.leadName,
        siteAddress: [quote.customerAddress, quote.customerCity].filter(Boolean).join(", ") || undefined,
        productSummary: units[idx],
        installedAt: now,
        documents: req.documents.map((d) => ({ key: d.key, label: d.label, required: d.required })),
        performanceDeclaration: req.performanceDeclaration,
        maintenanceLabel: req.maintenance.label,
        maintenancePriceCents: req.maintenance.defaultPriceCents,
        maintenanceActive: false,
        scanCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      created.push(id);
    }
    return { created: created.length, skipped: existing.length, total: units.length };
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

/**
 * Funding / fiscal declaration for the linked quote, per market:
 *  IT  → ENEA Allegato F (+ portal XML)   FR → Attestation MaPrimeRénov'
 *  BE  → Attestation Prime Rénovation      NL → ISDE-onderbouwing
 *  DE  → Fachunternehmererklärung (BEG)    LU → Attestation Klimabonus
 * All variants carry the computed Uw + surface + cost; only IT has portal XML.
 */
export const generateFundingDoc = mutation({
  args: {
    passportId: v.id("serramentoPassports"),
    zone: v.optional(
      v.union(
        v.literal("A"),
        v.literal("B"),
        v.literal("C"),
        v.literal("D"),
        v.literal("E"),
        v.literal("F"),
      ),
    ),
    gradiGiorno: v.optional(v.number()),
    uwAnte: v.optional(v.number()),
    deductionPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.passportId);
    if (!p) throw new ConvexError("PASSPORT_NOT_FOUND");
    await requireTenantRole(ctx, p.tenantId, ["owner", "admin", "member"]);
    if (!p.quoteId) throw new ConvexError("FUNDING_NEEDS_QUOTE");

    const quote = await ctx.db.get(p.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    const versionDoc = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) =>
        q.eq("configuratorId", quote.configuratorId).eq("version", quote.catalogVersion),
      )
      .unique();
    if (!versionDoc) throw new ConvexError("NO_CATALOG_VERSION");

    const items: ProjectItem[] = Array.isArray(quote.items) ? (quote.items as ProjectItem[]) : [];
    const uwPost = computeOverallUw(versionDoc.payload as CatalogPayload, items);
    if (uwPost <= 0) throw new ConvexError("CANNOT_COMPUTE_UW");
    const superficieM2 = items.reduce(
      (s, it) => s + ((it.width || 0) / 1000) * ((it.height || 0) / 1000) * (it.quantity || 1),
      0,
    );

    const region = regionForCountry(p.regionCode).code;
    const funding = complianceForRegion(region).funding;
    const indirizzo = [quote.customerAddress, quote.customerCity, quote.customerPostalCode]
      .filter(Boolean)
      .join(", ");
    const uwAnte = args.uwAnte ?? Math.max(uwPost + 1.6, 3.2);
    const deductionPercent = Math.min(Math.max(args.deductionPercent ?? 50, 0), 100);

    let eneaData: Record<string, unknown>;
    let eneaXml: string | undefined;

    if (region === "IT") {
      const guess = guessZoneFromCap(quote.customerPostalCode);
      const zone: ClimateZone = args.zone ?? guess.zone;
      const allegato = buildAllegatoF({
        zone,
        gradiGiorno: args.gradiGiorno ?? guess.gg,
        uwAnte,
        uwPost,
        superficieM2,
        costoCents: quote.priceCents,
        detrazionePercent: deductionPercent,
        beneficiario: quote.leadName,
        indirizzo,
        dataFineLavori: p.installedAt ?? Date.now(),
      });
      eneaData = { ...allegato, kind: "enea", title: funding.title, programme: funding.programme };
      eneaXml = allegatoFToXml(allegato);
    } else {
      const deltaU = Math.max(uwAnte - uwPost, 0);
      eneaData = {
        kind: "declaration",
        title: funding.title,
        programme: funding.programme,
        preamble: funding.preamble,
        beneficiario: quote.leadName,
        indirizzo,
        uwAnte: round2(uwAnte),
        uwPost: round2(uwPost),
        deltaU: round2(deltaU),
        superficieM2: round2(superficieM2),
        costoCents: quote.priceCents,
        deductionPercent,
        performanceDeclaration: p.performanceDeclaration ?? null,
        dataFineLavori: p.installedAt ?? Date.now(),
      };
      eneaXml = undefined;
    }

    const documents = p.documents.some((d) => d.key === "enea")
      ? p.documents.map((d) =>
          d.key === "enea" ? { ...d, label: funding.title, required: true } : d,
        )
      : [...p.documents, { key: "enea", label: funding.title, required: true }];

    await ctx.db.patch(args.passportId, { eneaData, eneaXml, documents, updatedAt: Date.now() });
    return {
      region,
      title: funding.title,
      hasXml: !!eneaXml,
      uwPost: round2(uwPost),
      conform: region === "IT" ? (eneaData.conform as boolean) : undefined,
    };
  },
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

     const ed = p.eneaData as Record<string, unknown> | undefined;
     const kind = (ed?.kind as string) ?? "enea";
     const enea = ed
       ? {
           kind,
           title: (ed.title as string) ?? "Documento agevolazione",
           programme: (ed.programme as string) ?? "",
           zone: (ed.zone as string) ?? null,
           uwPost: (ed.uwPost as number) ?? null,
           uwLimit: (ed.uwLimit as number) ?? null,
           conform: typeof ed.conform === "boolean" ? (ed.conform as boolean) : null,
           risparmioKwhAnno: (ed.risparmioKwhAnno as number) ?? null,
           // Funding declaration fields (non-IT markets)
           uwAnte: (ed.uwAnte as number) ?? null,
           deltaU: (ed.deltaU as number) ?? null,
           superficieM2: (ed.superficieM2 as number) ?? null,
           costoCents: (ed.costoCents as number) ?? null,
           deductionPercent: (ed.deductionPercent as number) ?? null,
           preamble: (ed.preamble as string[]) ?? null,
         }
       : null;

     return {
       label: p.label,
       customerName: p.customerName,
       productSummary: p.productSummary ?? null,
       installedAt: p.installedAt ?? null,
       regionCode: p.regionCode ?? null,
       enea,
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
