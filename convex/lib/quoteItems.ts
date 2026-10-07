import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import type { CatalogPayload, ProjectItem } from "../../src/shared/pricing";
import { comboIssues } from "../../src/shared/catalog-rules";
import { MAX_PIECES } from "../../src/shared/piece-ops";
import { leafFieldOpenings, leafTransoms, normalizeTransoms } from "../../src/shared/transoms";
import { assemblyIssues } from "../../src/shared/composition";

/**
 * Validate the pieces a client sends with a quote. `items` is `v.any()` in the
 * mutation args, so without this a browser could store (and price) anything.
 * Returns the parsed pieces (unknown keys stripped); the server prices those.
 */
export function parseQuoteItems(raw: unknown): ProjectItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ConvexError("NO_ITEMS");
  if (raw.length > MAX_PIECES) throw new ConvexError("INVALID_ITEM");
  return raw.map((r) => {
    const parsed = ProjectItemSchema.safeParse(r);
    if (!parsed.success) throw new ConvexError("INVALID_ITEM");
    const item = parsed.data as unknown as ProjectItem;
    // The bars the server prices are the valid ones: anything that does not fit the piece is dropped here, never charged.
    const transoms = normalizeTransoms(item.height, item.transoms);
    // Same for the bars of a single leaf and the openings of the fields they leave (fixed glass unless a valid opening was sent).
    const sashes = item.sashes.map((s) => {
      if (s.transoms === undefined && s.fields === undefined) return s;
      const own = s.transoms === undefined ? undefined : normalizeTransoms(item.height, s.transoms);
      const bars = leafTransoms(item.height, { transoms: own }, transoms);
      return { ...s, transoms: own, fields: bars.length > 0 ? leafFieldOpenings(bars.length, s.fields) : undefined };
    });
    return { ...item, sashes, transoms: transoms.length > 0 ? transoms : undefined };
  });
}

/**
 * The catalogue's own rules for what goes with what (a profile of the chosen quality, a glazing unit the profile can hold).
 * The editors only ever offer coherent choices; this refuses what still arrives otherwise (a stale tab, a hand-made request).
 */
export function assertCoherentItems(payload: Pick<CatalogPayload, "qualityTiers" | "profileSystems">, items: ProjectItem[]): void {
  for (const item of items) {
    if (comboIssues(payload, item).length > 0) throw new ConvexError("INVALID_COMBINATION");
  }
  // Joined pieces must close a shape whose edges line up (same heights in a row, same widths in a column).
  if (assemblyIssues(items).length > 0) throw new ConvexError("INVALID_ASSEMBLY");
}

/**
 * Next per-tenant, per-year offer number ("Q-2026-0007"). Runs inside the quote
 * mutation, so the counter bump is transactional and two quotes never share one.
 */
export async function nextOfferNumber(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<string> {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  const year = new Date().getUTCFullYear();
  const n = tenant.quoteSeq?.year === year ? tenant.quoteSeq.n + 1 : 1;
  await ctx.db.patch(tenantId, { quoteSeq: { year, n } });
  return `Q-${year}-${String(n).padStart(4, "0")}`;
}
