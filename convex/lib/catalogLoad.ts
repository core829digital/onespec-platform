import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { CatalogPayload } from "../../src/shared/pricing";

/**
 * The configurator's published catalogue version (version 1 for configurators published before versioning), or null.
 * `.first()`, not `.unique()`: (configuratorId, version) has no uniqueness constraint in the schema, only an index, so a
 * stray duplicate row must not turn every quote-building and Showroom-pricing call into an uncoded crash. Same choice as
 * the public widget's lookup of the same pair (widget.ts's getPublicConfigurator) — read-only and recoverable.
 */
export async function findPublishedVersion(
  ctx: QueryCtx | MutationCtx,
  configurator: Doc<"configurators">,
): Promise<Doc<"catalogVersions"> | null> {
  const targetVersion = configurator.publishedCatalogVersion ?? 1;
  return await ctx.db
    .query("catalogVersions")
    .withIndex("by_configurator_version", (q) => q.eq("configuratorId", configurator._id).eq("version", targetVersion))
    .first();
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
