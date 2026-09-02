import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireTenantRole, requireMembership } from "./lib/auth";

const DEFAULT_MATERIALS = [
  { key: "pvc", labels: { it: "PVC", en: "PVC", fr: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true },
  { key: "wood", labels: { it: "Legno", en: "Wood", fr: "Bois" }, basePerM2Cents: 32000, profilePerMlCents: 4500, uFrameBase: 1.2, sortOrder: 1, enabled: true },
  { key: "aluminum", labels: { it: "Alluminio", en: "Aluminum", fr: "Aluminium" }, basePerM2Cents: 26000, profilePerMlCents: 3800, uFrameBase: 1.6, sortOrder: 2, enabled: true },
];

const DEFAULT_QUALITIES = {
  pvc: [{ key: "chamber5", labels: { it: "5 camere", en: "5 chambers", fr: "5 chambres" }, multiplier: 1.0, uAdjust: 0, sortOrder: 0, enabled: true },
        { key: "chamber7", labels: { it: "7 camere", en: "7 chambers", fr: "7 chambres" }, multiplier: 1.15, uAdjust: -0.15, sortOrder: 1, enabled: true }],
  wood: [{ key: "pine", labels: { it: "Pino", en: "Pine", fr: "Pin" }, multiplier: 1.0, uAdjust: 0, sortOrder: 0, enabled: true },
         { key: "oak", labels: { it: "Rovere", en: "Oak", fr: "Chêne" }, multiplier: 1.35, uAdjust: -0.05, sortOrder: 1, enabled: true }],
  aluminum: [{ key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard" }, multiplier: 1.0, uAdjust: 0, sortOrder: 0, enabled: true },
             { key: "thermalbreak", labels: { it: "Taglio termico", en: "Thermal break", fr: "Rupture de pont thermique" }, multiplier: 1.25, uAdjust: -0.5, sortOrder: 1, enabled: true }],
};

const DEFAULT_PROFILE_SYSTEMS: Record<string, Array<{ key: string; labels: { it: string; en: string; fr: string }; multiplier: number; sortOrder: number; enabled: boolean }>> = {
  pvc: [
    { key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard" }, multiplier: 1.0, sortOrder: 0, enabled: true },
    { key: "aluplast", labels: { it: "Aluplast", en: "Aluplast", fr: "Aluplast" }, multiplier: 1.0, sortOrder: 1, enabled: true },
    { key: "rehau", labels: { it: "Rehau", en: "Rehau", fr: "Rehau" }, multiplier: 1.08, sortOrder: 2, enabled: true },
    { key: "kommerling", labels: { it: "Kömmerling", en: "Kömmerling", fr: "Kömmerling" }, multiplier: 1.1, sortOrder: 3, enabled: true },
    { key: "deceuninck", labels: { it: "Deceuninck", en: "Deceuninck", fr: "Deceuninck" }, multiplier: 1.06, sortOrder: 4, enabled: true },
    { key: "salamander", labels: { it: "Salamander", en: "Salamander", fr: "Salamander" }, multiplier: 1.05, sortOrder: 5, enabled: true },
  ],
  aluminum: [
    { key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard" }, multiplier: 1.0, sortOrder: 0, enabled: true },
    { key: "schuco", labels: { it: "Schüco", en: "Schüco", fr: "Schüco" }, multiplier: 1.15, sortOrder: 1, enabled: true },
    { key: "reynaers", labels: { it: "Reynaers", en: "Reynaers", fr: "Reynaers" }, multiplier: 1.12, sortOrder: 2, enabled: true },
    { key: "aluprof", labels: { it: "Aluprof", en: "Aluprof", fr: "Aluprof" }, multiplier: 1.0, sortOrder: 3, enabled: true },
    { key: "cortizo", labels: { it: "Cortizo", en: "Cortizo", fr: "Cortizo" }, multiplier: 1.08, sortOrder: 4, enabled: true },
  ],
};

const DEFAULT_SIZES: Array<{
  productType: "window" | "balconyDoor";
  sashCount: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
}> = [
  { productType: "window", sashCount: 1, minWidthMm: 450, maxWidthMm: 1200, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 2, minWidthMm: 600, maxWidthMm: 2400, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 3, minWidthMm: 900, maxWidthMm: 3600, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 4, minWidthMm: 1200, maxWidthMm: 4000, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 1, minWidthMm: 450, maxWidthMm: 1200, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 2, minWidthMm: 600, maxWidthMm: 2400, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 3, minWidthMm: 900, maxWidthMm: 3600, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 4, minWidthMm: 1200, maxWidthMm: 4000, minHeightMm: 1700, maxHeightMm: 2800 },
];

const DEFAULT_GLAZING = [
  { key: "double", labels: { it: "Doppio vetro", en: "Double glazing", fr: "Double vitrage" }, priceCents: 0, uGlass: 1.1, sortOrder: 0, enabled: true },
  { key: "triple", labels: { it: "Triplo vetro", en: "Triple glazing", fr: "Triple vitrage" }, priceCents: 6000, uGlass: 0.6, sortOrder: 1, enabled: true },
  { key: "tripleLowE", labels: { it: "Triplo Low-E", en: "Triple Low-E", fr: "Triple Low-E" }, priceCents: 9500, uGlass: 0.5, sortOrder: 2, enabled: true },
];

const DEFAULT_FINISH = [
  { key: "white", labels: { it: "Bianco", en: "White", fr: "Blanc" }, swatchHex: "#FFFFFF", priceCents: 0, sortOrder: 0, enabled: true },
  { key: "ral", labels: { it: "RAL personalizzato", en: "Custom RAL", fr: "RAL personnalisé" }, swatchHex: "#CCCCCC", priceCents: 5500, sortOrder: 1, enabled: true },
  { key: "woodeffect", labels: { it: "Effetto legno", en: "Wood effect", fr: "Effet bois" }, swatchHex: "#8B4513", priceCents: 8500, sortOrder: 2, enabled: true },
];

const DEFAULT_HARDWARE: Array<{
  kind: "hardware" | "hardwareColor" | "sashType" | "screen" | "threshold" | "misc";
  key: string;
  labels: { it: string; en: string; fr: string };
  priceCents: number;
  appliesToOperableOnly: boolean;
  sortOrder: number;
  enabled: boolean;
}> = [
  { kind: "hardware", key: "maco", labels: { it: "Maco", en: "Maco", fr: "Maco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "hardware", key: "roto", labels: { it: "Roto", en: "Roto", fr: "Roto" }, priceCents: 1500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "hardware", key: "siegenia", labels: { it: "Siegenia", en: "Siegenia", fr: "Siegenia" }, priceCents: 2500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "hardwareColor", key: "white", labels: { it: "Bianco", en: "White", fr: "Blanc" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "hardwareColor", key: "silver", labels: { it: "Argento", en: "Silver", fr: "Argent" }, priceCents: 1000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "hardwareColor", key: "bronze", labels: { it: "Bronzo", en: "Bronze", fr: "Bronze" }, priceCents: 2000, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "sashType", key: "fix", labels: { it: "Fisso", en: "Fixed", fr: "Fixe" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
  { kind: "sashType", key: "classic", labels: { it: "Classica", en: "Classic", fr: "Classique" }, priceCents: 3500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "sashType", key: "tiltturn", labels: { it: "Vasistas/Battente", en: "Tilt & Turn", fr: "Oscillo-battant" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "sashType", key: "sliding", labels: { it: "Scorrevole", en: "Sliding", fr: "Coulissant" }, priceCents: 8500, appliesToOperableOnly: true, sortOrder: 3, enabled: true },
  { kind: "screen", key: "insectScreen", labels: { it: "Zanzariera", en: "Insect screen", fr: "Moustiquaire" }, priceCents: 4500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "threshold", key: "balconyDoorThreshold", labels: { it: "Soglia balcone", en: "Balcony threshold", fr: "Seuil balcon" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
];

export const seedDefaultCatalog = internalMutation({
  args: { configuratorId: v.id("configurators"), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    for (const m of DEFAULT_MATERIALS) {
      await ctx.db.insert("catalogMaterials", { ...m, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const [materialKey, qualities] of Object.entries(DEFAULT_QUALITIES)) {
      for (const q of qualities) {
        await ctx.db.insert("catalogQualityTiers", { ...q, tenantId: args.tenantId, configuratorId: args.configuratorId, materialKey });
      }
    }
    for (const [materialKey, systems] of Object.entries(DEFAULT_PROFILE_SYSTEMS)) {
      for (const p of systems) {
        await ctx.db.insert("catalogProfileSystems", { ...p, tenantId: args.tenantId, configuratorId: args.configuratorId, materialKey });
      }
    }
    for (const s of DEFAULT_SIZES) {
      await ctx.db.insert("catalogSizeConstraints", { ...s, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const g of DEFAULT_GLAZING) {
      await ctx.db.insert("catalogGlazingOptions", { ...g, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const f of DEFAULT_FINISH) {
      await ctx.db.insert("catalogFinishOptions", { ...f, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const h of DEFAULT_HARDWARE) {
      await ctx.db.insert("catalogHardwareOptions", { ...h, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
  },
});

export const upsertMaterial = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), basePerM2Cents: v.number(), profilePerMlCents: v.number(), uFrameBase: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogMaterials").withIndex("by_configurator_key", q => q.eq("configuratorId", args.configuratorId).eq("key", args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogMaterials", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const deleteMaterial = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogMaterials").withIndex("by_configurator_key", q => q.eq("configuratorId", args.configuratorId).eq("key", args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertQualityTier = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string(), labels: v.any(), multiplier: v.number(), uAdjust: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogQualityTiers", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const deleteQualityTier = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertProfileSystem = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string(), labels: v.any(), multiplier: v.number(), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogProfileSystems", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const deleteProfileSystem = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertSizeConstraint = mutation({
  args: { configuratorId: v.id("configurators"), productType: v.union(v.literal("window"), v.literal("balconyDoor")), sashCount: v.number(), minWidthMm: v.number(), maxWidthMm: v.number(), minHeightMm: v.number(), maxHeightMm: v.number() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogSizeConstraints").withIndex("by_configurator_type", q => q.eq("configuratorId", args.configuratorId).eq("productType", args.productType)).filter(q => q.eq(q.field("sashCount"), args.sashCount)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogSizeConstraints", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertGlazingOption = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), priceCents: v.number(), uGlass: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogGlazingOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertFinishOption = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), swatchHex: v.optional(v.string()), priceCents: v.number(), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogFinishOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertHardwareOption = mutation({
  args: { configuratorId: v.id("configurators"), kind: v.union(v.literal("hardware"), v.literal("hardwareColor"), v.literal("sashType"), v.literal("screen"), v.literal("threshold"), v.literal("misc")), key: v.string(), labels: v.any(), priceCents: v.number(), appliesToOperableOnly: v.boolean(), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requireTenantRole(ctx, configurator.tenantId, ["owner", "admin"]);

    const existing = await ctx.db.query("catalogHardwareOptions").withIndex("by_configurator_kind", q => q.eq("configuratorId", args.configuratorId).eq("kind", args.kind)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogHardwareOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const getWorkingCatalog = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);
    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware] = await Promise.all([
      ctx.db.query("catalogMaterials").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogQualityTiers").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogProfileSystems").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
    ]);
    return { materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware };
  },
});