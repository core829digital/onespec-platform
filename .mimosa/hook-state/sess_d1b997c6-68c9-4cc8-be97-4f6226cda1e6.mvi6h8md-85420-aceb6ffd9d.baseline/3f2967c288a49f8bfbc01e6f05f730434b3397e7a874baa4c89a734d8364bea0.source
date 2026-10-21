import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { chamberQualityKey, chamberTierDefaults, chamberTierLabels, chambersOfQualityKey, profileQualityKey } from "../../src/shared/catalog-rules";
import { finishLibraryRows } from "../../src/shared/finish-library";
import { glazingPackageRows, parseGlazingKey } from "../../src/shared/glazing-packages";
import {
  COLOUR_SURCHARGE_MULTIPLIER,
  LEGACY_PVC_PROFILE_KEYS,
  QUALITY_CLASS_LABEL,
  STANDARD_PROFILES,
  TRIPLE_GLAZING_SURCHARGE_PER_M2_CENTS,
  isPriceZone,
  standardProfileLabels,
} from "../../src/shared/standard-pricing";

/** What the seeds put in the catalogue by default for the options a complete price already includes. */
const DEFAULT_INCLUDED: Array<{ kind: "sashType" | "installation"; key: string; priceCents: number }> = [
  { kind: "sashType", key: "classic", priceCents: 3500 },
  { kind: "sashType", key: "tiltturn", priceCents: 6500 },
  { kind: "sashType", key: "tilt", priceCents: 2500 },
  { kind: "installation", key: "classico", priceCents: 8000 },
];

export interface StandardApplyResult {
  profilesAdded: number;
  profilesDisabled: number;
  optionsReset: number;
  glazingUpdated: number;
  finishUpdated: number;
}

/** White frames: no colour surcharge. */
const WHITE_FINISH = new Set(["white", "ral-9016", "ral-9010", "std-profile-white"]);

/**
 * Apply the standard price list to a configurator. Nothing is deleted: the 12 profiles are added, the older PVC profile
 * rows are only switched off, and the options a complete price already includes (opening types, basic installation) are
 * zeroed ONLY while they still hold the seed value. Glazing packages and library finishes are re-priced the same way
 * (only while they hold the seed placeholder), so a price the installer edited is never overwritten. Idempotent.
 */
export async function applyStandardPricing(ctx: MutationCtx, configurator: Doc<"configurators">): Promise<StandardApplyResult> {
  const tenant = await ctx.db.get(configurator.tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  if (!isPriceZone(tenant.priceZone)) throw new ConvexError("PRICE_ZONE_REQUIRED");
  const scope = { tenantId: configurator.tenantId, configuratorId: configurator._id as Id<"configurators"> };
  const result: StandardApplyResult = { profilesAdded: 0, profilesDisabled: 0, optionsReset: 0, glazingUpdated: 0, finishUpdated: 0 };

  // 1. Profiles: add the 12 standard ones, switch off (never delete) the old seeded PVC ones.
  const profiles = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  const have = new Set(profiles.map((p) => p.standardKey).filter(Boolean));
  let order = 100;
  for (const sp of STANDARD_PROFILES) {
    order++;
    if (have.has(sp.key)) continue;
    await ctx.db.insert("catalogProfileSystems", {
      ...scope,
      materialKey: "pvc",
      key: sp.key,
      labels: standardProfileLabels(sp),
      multiplier: 1,
      group: sp.klass,
      standardKey: sp.key,
      qualityKey: chamberQualityKey(sp.chambers),
      sortOrder: order,
      enabled: true,
    });
    result.profilesAdded++;
  }
  for (const p of profiles) {
    if (p.materialKey === "pvc" && !p.standardKey && LEGACY_PVC_PROFILE_KEYS.includes(p.key) && p.enabled) {
      await ctx.db.patch(p._id, { enabled: false });
      result.profilesDisabled++;
    }
  }

  // 2. Options included in a complete price.
  const hardware = await ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  for (const d of DEFAULT_INCLUDED) {
    const row = hardware.find((h) => h.kind === d.kind && h.key === d.key);
    if (row && row.priceCents === d.priceCents) {
      await ctx.db.patch(row._id, { priceCents: 0 });
      result.optionsReset++;
    }
  }

  // 3. Glazing: triple costs per m² (about +60 EUR), double is included.
  const placeholders = new Map(glazingPackageRows().map((r) => [r.key, r.priceCents]));
  const glazing = await ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  for (const g of glazing) {
    const pkg = parseGlazingKey(g.key);
    let patch: Partial<Doc<"catalogGlazingOptions">> | null = null;
    if (pkg && g.priceCents === placeholders.get(g.key) && g.pricePerM2Cents === undefined) {
      patch = { priceCents: 0, pricePerM2Cents: pkg.family === "triple" ? TRIPLE_GLAZING_SURCHARGE_PER_M2_CENTS : 0 };
    } else if (g.key === "triple" && g.priceCents === 6000 && g.pricePerM2Cents === undefined) {
      patch = { priceCents: 0, pricePerM2Cents: TRIPLE_GLAZING_SURCHARGE_PER_M2_CENTS };
    }
    if (patch) {
      await ctx.db.patch(g._id, patch);
      result.glazingUpdated++;
    }
  }

  // 4. Finishes: a coloured / foil frame costs about 20% more (white: nothing).
  const libraryPlaceholders = new Map(finishLibraryRows().map((r) => [r.key, r.priceCents]));
  const finish = await ctx.db.query("catalogFinishOptions").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  for (const f of finish) {
    const seeded = libraryPlaceholders.has(f.key) ? libraryPlaceholders.get(f.key) === f.priceCents : (f.key === "ral" && f.priceCents === 5500) || (f.key === "woodeffect" && f.priceCents === 8500);
    if (!seeded || f.multiplier !== undefined) continue;
    await ctx.db.patch(f._id, { priceCents: 0, multiplier: WHITE_FINISH.has(f.key) ? 1 : COLOUR_SURCHARGE_MULTIPLIER });
    result.finishUpdated++;
  }

  await ensureProfileClassification(ctx, scope);
  await ctx.db.patch(configurator._id, { pricingMode: "standard", updatedAt: Date.now() });
  return result;
}

/**
 * Every profile with a known quality carries it (stored on the row), and every quality those profiles refer to exists as a
 * tier. Adds only what is missing: no tier is re-enabled, no classification an installer chose is overwritten. Idempotent.
 */
export async function ensureProfileClassification(
  ctx: MutationCtx,
  scope: { tenantId: Id<"tenants">; configuratorId: Id<"configurators"> },
): Promise<{ classified: number; tiersAdded: number }> {
  const profiles = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  const tiers = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator", (q) => q.eq("configuratorId", scope.configuratorId)).collect();
  let classified = 0;
  let tiersAdded = 0;
  for (const p of profiles) {
    const q = profileQualityKey(p);
    if (!q) continue;
    if (!p.qualityKey) {
      await ctx.db.patch(p._id, { qualityKey: q });
      classified++;
    }
    const n = chambersOfQualityKey(q);
    if (n && !tiers.some((t) => t.materialKey === p.materialKey && t.key === q)) {
      const order = tiers.filter((t) => t.materialKey === p.materialKey).reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;
      const row = { ...scope, materialKey: p.materialKey, key: q, labels: chamberTierLabels(n), ...chamberTierDefaults(n), sortOrder: order, enabled: true };
      const id = await ctx.db.insert("catalogQualityTiers", row);
      tiers.push({ ...row, _id: id, _creationTime: Date.now() });
      tiersAdded++;
    }
  }
  return { classified, tiersAdded };
}

/** Quality class names for the profile groups of the editor (used by tests and the picker). */
export const CLASS_GROUPS = Object.keys(QUALITY_CLASS_LABEL);
