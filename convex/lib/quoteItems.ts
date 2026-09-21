import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import type { ProjectItem } from "../../src/shared/pricing";

/**
 * Validate the pieces a client sends with a quote. `items` is `v.any()` in the
 * mutation args, so without this a browser could store (and price) anything.
 * Returns the parsed pieces (unknown keys stripped); the server prices those.
 */
export function parseQuoteItems(raw: unknown): ProjectItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ConvexError("NO_ITEMS");
  if (raw.length > 50) throw new ConvexError("INVALID_ITEM");
  return raw.map((r) => {
    const parsed = ProjectItemSchema.safeParse(r);
    if (!parsed.success) throw new ConvexError("INVALID_ITEM");
    return parsed.data as unknown as ProjectItem;
  });
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
