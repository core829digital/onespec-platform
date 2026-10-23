import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { CatalogPayload } from "../../src/shared/pricing";

/**
 * A configurator's catalogue version, by number, or null. `.first()`, not `.unique()`: (configuratorId, version) has no
 * uniqueness constraint in the schema, only an index, so a stray duplicate row must not turn every quote-building,
 * widget-submission and Showroom-pricing call into an uncoded crash — it is read-only and recoverable (the same reasoning
 * already applied to a duplicate `branding` row in quotes.ts). Every lookup of this pair goes through this one function.
 */
export async function findCatalogVersion(
  ctx: QueryCtx | MutationCtx,
  configuratorId: Id<"configurators">,
  version: number,
): Promise<Doc<"catalogVersions"> | null> {
  return await ctx.db
    .query("catalogVersions")
    .withIndex("by_configurator_version", (q) => q.eq("configuratorId", configuratorId).eq("version", version))
    .first();
}

/** The configurator's PUBLISHED catalogue version (version 1 for configurators published before versioning), or null. */
export async function findPublishedVersion(
  ctx: QueryCtx | MutationCtx,
  configurator: Doc<"configurators">,
): Promise<Doc<"catalogVersions"> | null> {
  return findCatalogVersion(ctx, configurator._id, configurator.publishedCatalogVersion ?? 1);
}

/**
 * The tenant's configurator and its published catalogue, the prelude every quote-building path shares (issue #61).
 * Throws CONFIGURATOR_NOT_FOUND (missing, or another tenant's) or NO_PUBLISHED_VERSION.
 */
export async function loadPublishedCatalog(
  ctx: QueryCtx | MutationCtx,
  configuratorId: Id<"configurators">,
  tenantId: Id<"tenants">,
): Promise<{ configurator: Doc<"configurators">; versionDoc: Doc<"catalogVersions">; payload: CatalogPayload }> {
  const configurator = await ctx.db.get(configuratorId);
  if (!configurator || configurator.tenantId !== tenantId) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
  const versionDoc = await findPublishedVersion(ctx, configurator);
  if (!versionDoc) throw new ConvexError("NO_PUBLISHED_VERSION");
  return { configurator, versionDoc, payload: versionDoc.payload as CatalogPayload };
}

/** Payment terms printed on a quote when the installer did not write their own. */
export function defaultDepositTerms(regionCode: string | undefined): string {
  return regionCode === "FR" ? "Acompte 30% à la commande · 70% à la livraison" : "30% ordine · 60% merce pronta · 10% posa";
}
