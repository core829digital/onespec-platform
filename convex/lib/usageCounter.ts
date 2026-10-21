/**
 * The one usageCounter upsert (#60): the read-then-patch-or-insert block was
 * open-coded in five sites (three in quotes.ts, two in widget.ts, one in
 * configurators.ts) and duplicate counter rows from exactly these sites are a
 * documented historical failure mode — the defensive `.first()` semantics now
 * live here, once.
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export interface CounterInc {
  quoteRequestsCount?: number;
  activeConfiguratorsCount?: number;
  widgetViewsCount?: number;
}

/** Patch-or-insert one counter row. `counter` may be null/undefined (first of the period). */
export async function bumpCounterRow(
  ctx: MutationCtx,
  counter: Doc<"usageCounters"> | null | undefined,
  tenantId: Id<"tenants">,
  period: string,
  inc: CounterInc,
  extraPatch?: (current: Doc<"usageCounters">) => Partial<Doc<"usageCounters">>,
): Promise<void> {
  if (counter) {
    await ctx.db.patch(counter._id, {
      ...(inc.quoteRequestsCount !== undefined
        ? { quoteRequestsCount: counter.quoteRequestsCount + inc.quoteRequestsCount }
        : {}),
      ...(inc.activeConfiguratorsCount !== undefined
        ? { activeConfiguratorsCount: counter.activeConfiguratorsCount + inc.activeConfiguratorsCount }
        : {}),
      ...(inc.widgetViewsCount !== undefined
        ? { widgetViewsCount: (counter.widgetViewsCount ?? 0) + inc.widgetViewsCount }
        : {}),
      ...(extraPatch ? extraPatch(counter) : {}),
    });
  } else {
    await ctx.db.insert("usageCounters", {
      tenantId,
      period,
      quoteRequestsCount: inc.quoteRequestsCount ?? 0,
      activeConfiguratorsCount: inc.activeConfiguratorsCount ?? 0,
      ...(inc.widgetViewsCount !== undefined ? { widgetViewsCount: inc.widgetViewsCount } : {}),
    });
  }
}

/** Read this tenant+period's counter and bump it — the common whole flow. */
export async function bumpUsageCounter(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  period: string,
  inc: CounterInc,
): Promise<void> {
  const counter = await ctx.db
    .query("usageCounters")
    .withIndex("by_tenant_period", (q) => q.eq("tenantId", tenantId).eq("period", period))
    .first();
  await bumpCounterRow(ctx, counter, tenantId, period, inc);
}
