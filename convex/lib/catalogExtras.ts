import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } from "../../src/shared/configurator-model";

/**
 * Catalogue sections added for the B2B / showroom configurator: telaio types,
 * accessories and an optional per-category base price. Kept in one place so the
 * publish, editor, working-catalogue and widget-preview queries all load them the
 * same way, and so a configurator created before these sections existed can be
 * brought up to date with `seedExtras` (idempotent).
 */

export async function loadExtras(ctx: QueryCtx | MutationCtx, configuratorId: Id<"configurators">) {
  const [frameTypes, accessories, productBase] = await Promise.all([
    ctx.db.query("catalogFrameTypes").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect(),
    ctx.db.query("catalogAccessories").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect(),
    ctx.db.query("catalogProductBase").withIndex("by_configurator", (q) => q.eq("configuratorId", configuratorId)).collect(),
  ]);
  return { frameTypes, accessories, productBase };
}

type Labels = Record<string, string>;
const lab = (it: string, en: string): Labels => ({ it, en });

/** Hardware rows the new leaf model refers to by key ("standard", "rc2", "hidden", black handle, tilt, lift-slide). */
const EXTRA_HARDWARE: Array<{
  kind: "hardware" | "hardwareColor" | "sashType";
  key: string;
  labels: Labels;
  priceCents: number;
  appliesToOperableOnly: boolean;
  sortOrder: number;
}> = [
  { kind: "hardware", key: "standard", labels: lab("Standard", "Standard"), priceCents: 0, appliesToOperableOnly: true, sortOrder: -1 },
  { kind: "hardware", key: "rc2", labels: lab("RC2 sicurezza", "RC2 security"), priceCents: 5500, appliesToOperableOnly: true, sortOrder: 10 },
  { kind: "hardware", key: "hidden", labels: lab("A scomparsa", "Concealed"), priceCents: 4500, appliesToOperableOnly: true, sortOrder: 11 },
  { kind: "hardwareColor", key: "silver", labels: lab("Argento", "Silver"), priceCents: 0, appliesToOperableOnly: true, sortOrder: 1 },
  { kind: "hardwareColor", key: "black", labels: lab("Nero", "Black"), priceCents: 1000, appliesToOperableOnly: true, sortOrder: 3 },
  { kind: "sashType", key: "tilt", labels: lab("Vasistas", "Tilt only"), priceCents: 2500, appliesToOperableOnly: true, sortOrder: 4 },
  { kind: "sashType", key: "liftslide", labels: lab("Alzante scorrevole", "Lift-and-slide"), priceCents: 12000, appliesToOperableOnly: true, sortOrder: 5 },
];

/** Profile series: technical data for the rows that already exist + the series that were missing. */
export const PROFILE_TECH: Record<string, { uFrame: number; group: string; label?: string }> = {
  aluplast: { uFrame: 1.3, group: "tab1", label: "Aluplast IDEAL 4000" },
  kommerling: { uFrame: 1.3, group: "tab1", label: "Kömmerling 70 AD" },
  rehau: { uFrame: 1.0, group: "tab2", label: "Rehau Synego" },
  deceuninck: { uFrame: 1.0, group: "tab2", label: "Deceuninck Elegant" },
  salamander: { uFrame: 0.92, group: "tab2", label: "Salamander Streamline" },
};

const EXTRA_PVC_PROFILES: Array<{ key: string; label: string; multiplier: number; uFrame: number; group: string; sortOrder: number }> = [
  { key: "aluplastEnergeto76", label: "Aluplast ENERGETO 76", multiplier: 1.05, uFrame: 1.1, group: "tab1", sortOrder: 10 },
  { key: "kommerling76", label: "Kömmerling 76 MD", multiplier: 1.14, uFrame: 1.1, group: "tab1", sortOrder: 11 },
  { key: "schuco", label: "Schüco AWS 75.SI+", multiplier: 1.15, uFrame: 0.88, group: "tab2", sortOrder: 12 },
];

const GLAZING_PSI: Record<string, number> = { double: 0.04, triple: 0.032, tripleLowE: 0.032 };

// priceCents below are flat surcharges in the same spirit/range as the
// sibling DEFAULT_GLAZING/DEFAULT_FINISH entries in catalog.ts (double=0,
// triple=6000, tripleLowE=9500 / white=0, ral=5500, woodeffect=8500) — these
// rows used to seed with a dead `multiplier` field the schema never reads
// (glazing/finish price on flat priceCents, not a multiplier) and were
// always inserted at priceCents: 0, so every tenant's catalog shipped with
// premium glazing/finish options priced as free upgrades.
const EXTRA_GLAZING: Array<{ key: string; labels: Labels; uGlass: number; psi: number; priceCents: number; sortOrder: number }> = [
  { key: "acoustic", labels: lab("Doppio vetro acustico 44.1/16/6", "Acoustic double glazing 44.1/16/6"), uGlass: 1.1, psi: 0.04, priceCents: 4500, sortOrder: 10 },
  { key: "satinDouble", labels: lab("Doppio vetro satinato", "Satin double glazing"), uGlass: 1.05, psi: 0.04, priceCents: 5500, sortOrder: 11 },
  { key: "satinTriple", labels: lab("Triplo vetro satinato", "Satin triple glazing"), uGlass: 0.58, psi: 0.032, priceCents: 12000, sortOrder: 12 },
];

const EXTRA_FINISH: Array<{ key: string; labels: Labels; swatchHex: string; priceCents: number; sortOrder: number }> = [
  { key: "anthracite", labels: lab("Antracite RAL 7016", "Anthracite RAL 7016"), swatchHex: "#383E42", priceCents: 6500, sortOrder: 10 },
  { key: "bicolorRal", labels: lab("Bicolore: bianco interno / RAL esterno", "Bicolour: white inside / RAL outside"), swatchHex: "#6B7280", priceCents: 7500, sortOrder: 11 },
  { key: "whiteWoodExt", labels: lab("Bianco interno / effetto legno esterno", "White inside / wood effect outside"), swatchHex: "#8B5A2B", priceCents: 7000, sortOrder: 12 },
  { key: "woodIntExt", labels: lab("Effetto legno interno ed esterno", "Wood effect inside and outside"), swatchHex: "#A0522D", priceCents: 9500, sortOrder: 13 },
  { key: "whiteWoodEffect", labels: lab("Bianco effetto legno", "White wood effect"), swatchHex: "#F5F5DC", priceCents: 6000, sortOrder: 14 },
  { key: "ivoryWoodEffect", labels: lab("Ivory effetto legno", "Ivory wood effect"), swatchHex: "#FFFFF0", priceCents: 7000, sortOrder: 15 },
  { key: "otherColor", labels: lab("Altro colore", "Other colour"), swatchHex: "#B91C1C", priceCents: 9500, sortOrder: 16 },
];

/**
 * Bring a configurator's catalogue up to the B2B/showroom model. Idempotent: it
 * only inserts rows that are missing (by natural key) and only fills fields that
 * are still empty, so it never overwrites a price or a label the tenant edited.
 */
export async function seedExtras(
  ctx: MutationCtx,
  args: { tenantId: Id<"tenants">; configuratorId: Id<"configurators"> },
): Promise<{ inserted: number }> {
  const scope = { tenantId: args.tenantId, configuratorId: args.configuratorId };
  let inserted = 0;

  const frames = await ctx.db.query("catalogFrameTypes").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const f of DEFAULT_FRAME_TYPES) {
    if (frames.some((x) => x.key === f.key)) continue;
    await ctx.db.insert("catalogFrameTypes", { ...scope, ...f });
    inserted++;
  }

  const accessories = await ctx.db.query("catalogAccessories").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const a of DEFAULT_ACCESSORIES) {
    if (accessories.some((x) => x.category === a.category && x.key === a.key)) continue;
    await ctx.db.insert("catalogAccessories", { ...scope, ...a });
    inserted++;
  }

  const hardware = await ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const h of EXTRA_HARDWARE) {
    if (hardware.some((x) => x.kind === h.kind && x.key === h.key)) continue;
    await ctx.db.insert("catalogHardwareOptions", { ...scope, ...h, enabled: true });
    inserted++;
  }

  const profiles = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const p of profiles) {
    const tech = PROFILE_TECH[p.key];
    if (tech && p.materialKey === "pvc" && p.uFrame === undefined) {
      await ctx.db.patch(p._id, { uFrame: tech.uFrame, group: p.group ?? tech.group });
    }
  }
  const hasPvc = profiles.some((p) => p.materialKey === "pvc");
  if (hasPvc) {
    for (const p of EXTRA_PVC_PROFILES) {
      if (profiles.some((x) => x.materialKey === "pvc" && x.key === p.key)) continue;
      await ctx.db.insert("catalogProfileSystems", {
        ...scope,
        materialKey: "pvc",
        key: p.key,
        labels: { it: p.label, en: p.label, fr: p.label },
        multiplier: p.multiplier,
        uFrame: p.uFrame,
        group: p.group,
        sortOrder: p.sortOrder,
        enabled: true,
      });
      inserted++;
    }
  }

  const glazing = await ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const g of glazing) {
    if (g.psi === undefined && GLAZING_PSI[g.key] !== undefined) await ctx.db.patch(g._id, { psi: GLAZING_PSI[g.key] });
  }
  for (const g of EXTRA_GLAZING) {
    if (glazing.some((x) => x.key === g.key)) continue;
    await ctx.db.insert("catalogGlazingOptions", { ...scope, ...g, enabled: true });
    inserted++;
  }

  const finish = await ctx.db.query("catalogFinishOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).collect();
  for (const f of EXTRA_FINISH) {
    if (finish.some((x) => x.key === f.key)) continue;
    await ctx.db.insert("catalogFinishOptions", { ...scope, ...f, enabled: true });
    inserted++;
  }

  return { inserted };
}
