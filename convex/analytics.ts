import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMembership } from "./lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCAN = 5000;

/**
 * Tenant-scoped analytics for the dashboard. Membership-gated. All figures are
 * derived from real quoteRequests rows for this tenant — never demo data.
 */
export const getOverview = query({
  args: { tenantId: v.id("tenants"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const days = Math.min(Math.max(args.days ?? 30, 7), 365);
    const cutoff = Date.now() - days * DAY_MS;

    const all = await ctx.db
      .query("quoteRequests")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(MAX_SCAN);

    const inWindow = all.filter((r) => r._creationTime >= cutoff);

    const byStatus: Record<string, number> = {};
    let wonValueCents = 0;
    let quotedValueCents = 0;
    for (const r of inWindow) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === "won") wonValueCents += r.priceCents;
      if (r.status !== "spam") quotedValueCents += r.priceCents;
    }

    const realLeads = inWindow.filter((r) => r.status !== "spam");
    const won = byStatus.won ?? 0;
    const conversionRate = realLeads.length > 0 ? won / realLeads.length : 0;
    const avgDealCents = won > 0 ? Math.round(wonValueCents / won) : 0;

    // Daily volume trend.
    const trend: Array<{ date: string; count: number; valueCents: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = Date.now() - (i + 1) * DAY_MS;
      const end = Date.now() - i * DAY_MS;
      const rows = inWindow.filter((r) => r._creationTime >= start && r._creationTime < end);
      trend.push({
        date: new Date(end).toISOString().slice(0, 10),
        count: rows.length,
        valueCents: rows.reduce((s, r) => s + r.priceCents, 0),
      });
    }

    // By configurator.
    const cfgAgg = new Map<string, { count: number; valueCents: number }>();
    for (const r of inWindow) {
      const cur = cfgAgg.get(r.configuratorId) ?? { count: 0, valueCents: 0 };
      cur.count++;
      cur.valueCents += r.priceCents;
      cfgAgg.set(r.configuratorId, cur);
    }
    const byConfigurator = await Promise.all(
      [...cfgAgg.entries()].map(async ([id, agg]) => {
        const cfg = await ctx.db.get(id as (typeof all)[number]["configuratorId"]);
        return { name: cfg?.name ?? "—", ...agg };
      }),
    );
    byConfigurator.sort((a, b) => b.count - a.count);

    // By source origin.
    const srcAgg: Record<string, number> = {};
    for (const r of inWindow) {
      let key = "diretto / sconosciuto";
      if (r.sourceOrigin) {
        try {
          key = new URL(r.sourceOrigin).host;
        } catch {
          key = r.sourceOrigin.slice(0, 60);
        }
      }
      srcAgg[key] = (srcAgg[key] ?? 0) + 1;
    }
    const bySource = Object.entries(srcAgg)
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count);

    return {
      days,
      totalRequests: inWindow.length,
      realLeads: realLeads.length,
      won,
      lost: byStatus.lost ?? 0,
      spam: byStatus.spam ?? 0,
      conversionRate,
      wonValueCents,
      pipelineValueCents: quotedValueCents,
      avgDealCents,
      byStatus,
      funnel: [
        { key: "new", count: byStatus.new ?? 0 },
        { key: "contacted", count: byStatus.contacted ?? 0 },
        { key: "quoted", count: byStatus.quoted ?? 0 },
        { key: "won", count: won },
      ],
      trend,
      byConfigurator,
      bySource,
      truncated: all.length === MAX_SCAN,
    };
  },
});
