import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { currentPeriod } from "./entitlements";

/** The per-period counters a usage event bumps by one. */
export type UsageCounterField =
  | "quoteRequestsCount"
  | "activeConfiguratorsCount"
  | "widgetViewsCount"
  | "pdfExportsCount"
  | "whatsappSendsCount"
  | "showroomQuotesCount"
  | "showroomPdfCount"
  | "showroomWhatsappCount";

/**
 * The tenant's counter row for a period. `.first()`, never `.unique()`: a duplicate row left by an old
 * read-then-insert race must not make every later read throw (see analytics.getPlanUsage).
 */
export async function findUsageCounter(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  period: string = currentPeriod(),
): Promise<Doc<"usageCounters"> | null> {
  return await ctx.db
    .query("usageCounters")
    .withIndex("by_tenant_period", (q) => q.eq("tenantId", tenantId).eq("period", period))
    .first();
}

/**
 * Adds one to `field` for the tenant's period, creating the row when there is none (issue #60: this upsert
 * used to be open-coded at six sites). Pass `counter` when the caller already read the row; `patchExtra`
 * is written alongside the bump on an existing row only.
 */
export async function bumpUsageCounter(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  field: UsageCounterField,
  opts: { period?: string; counter?: Doc<"usageCounters"> | null; patchExtra?: Partial<Doc<"usageCounters">> } = {},
): Promise<void> {
  const period = opts.period ?? currentPeriod();
  const counter = opts.counter !== undefined ? opts.counter : await findUsageCounter(ctx, tenantId, period);
  if (counter) {
    await ctx.db.patch(counter._id, { [field]: (counter[field] ?? 0) + 1, ...opts.patchExtra });
  } else {
    await ctx.db.insert("usageCounters", {
      tenantId,
      period,
      quoteRequestsCount: 0,
      activeConfiguratorsCount: 0,
      [field]: 1,
    });
  }
}
