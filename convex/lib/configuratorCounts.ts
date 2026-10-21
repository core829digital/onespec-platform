/**
 * The configurator counters (#59): one module owns how "configurators against
 * the plan" is counted. Since #38 both consumers — the dashboard's plan-usage
 * meter and the creation quota gate — use the same LIVE count (draft +
 * published), so the meter can never understate what the gate enforces; a
 * published-only variant would be a third semantics and has deliberately not
 * been added.
 */
import type { ReadCtx } from "./auth";
import type { Id } from "../_generated/dataModel";

/** Draft + published configurators, counted up to `cap` (bounded reads). */
export async function countLiveConfigurators(ctx: ReadCtx, tenantId: Id<"tenants">, cap: number): Promise<number> {
  const take = Math.max(0, Math.min(cap, 1000));
  const [drafts, published] = await Promise.all([
    ctx.db.query("configurators").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "draft")).take(take),
    ctx.db.query("configurators").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "published")).take(take),
  ]);
  return drafts.length + published.length;
}
