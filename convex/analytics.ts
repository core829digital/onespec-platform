import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMembership } from "./lib/auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_SCAN = 8000;

export const RANGE = v.union(
  v.literal("24h"),
  v.literal("3d"),
  v.literal("5d"),
  v.literal("7d"),
  v.literal("14d"),
  v.literal("1m"),
  v.literal("3m"),
  v.literal("6m"),
  v.literal("1y"),
  v.literal("3y"),
  v.literal("5y"),
  v.literal("10y"),
);
type Range = "24h" | "3d" | "5d" | "7d" | "14d" | "1m" | "3m" | "6m" | "1y" | "3y" | "5y" | "10y";

/** window length + trend bucket size + label formatter per range. */
const RANGE_SPEC: Record<Range, { windowMs: number; bucketMs: number; fmt: (d: Date) => string }> = {
  "24h": { windowMs: DAY_MS, bucketMs: HOUR_MS, fmt: (d) => `${String(d.getHours()).padStart(2, "0")}:00` },
  "3d": { windowMs: 3 * DAY_MS, bucketMs: 6 * HOUR_MS, fmt: hm },
  "5d": { windowMs: 5 * DAY_MS, bucketMs: 6 * HOUR_MS, fmt: hm },
  "7d": { windowMs: 7 * DAY_MS, bucketMs: DAY_MS, fmt: dm },
  "14d": { windowMs: 14 * DAY_MS, bucketMs: DAY_MS, fmt: dm },
  "1m": { windowMs: 30 * DAY_MS, bucketMs: DAY_MS, fmt: dm },
  "3m": { windowMs: 91 * DAY_MS, bucketMs: 7 * DAY_MS, fmt: dm },
  "6m": { windowMs: 182 * DAY_MS, bucketMs: 7 * DAY_MS, fmt: dm },
  "1y": { windowMs: 365 * DAY_MS, bucketMs: 30 * DAY_MS, fmt: my },
  "3y": { windowMs: 1095 * DAY_MS, bucketMs: 30 * DAY_MS, fmt: my },
  "5y": { windowMs: 1826 * DAY_MS, bucketMs: 91 * DAY_MS, fmt: my },
  "10y": { windowMs: 3652 * DAY_MS, bucketMs: 91 * DAY_MS, fmt: my },
};

function hm(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}h`;
}
function dm(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function my(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Tenant-scoped analytics for the dashboard. Membership-gated. All figures are
 * derived from real quoteRequests rows for this tenant — never demo data.
 */
export const getOverview = query({
  args: { tenantId: v.id("tenants"), range: v.optional(RANGE) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const range = (args.range ?? "1m") as Range;
    const spec = RANGE_SPEC[range];
    const now = Date.now();
    const cutoff = now - spec.windowMs;

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

    // Trend bucketed by the range's granularity (cap the number of buckets).
    const bucketCount = Math.min(60, Math.max(1, Math.round(spec.windowMs / spec.bucketMs)));
    const bucketMs = spec.windowMs / bucketCount;
    const trend: Array<{ label: string; count: number; valueCents: number }> = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = now - (i + 1) * bucketMs;
      const end = now - i * bucketMs;
      const rows = inWindow.filter((r) => r._creationTime >= start && r._creationTime < end);
      trend.push({
        label: spec.fmt(new Date(end)),
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

    // Widget opens — de-duplicated per-visitor counters, stored by month.
    // Monthly resolution: below one month the window overlaps a whole month, so
    // the figure is an upper bound (flagged `widgetViewsApprox`).
    const monthsInWindow = new Set<string>();
    for (let ms = cutoff; ms <= now; ms += DAY_MS) {
      monthsInWindow.add(new Date(ms).toISOString().slice(0, 7));
    }
    const counters = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const widgetViews = counters
      .filter((c) => monthsInWindow.has(c.period))
      .reduce((s, c) => s + (c.widgetViewsCount ?? 0), 0);
    const visitorConversionRate =
      widgetViews > 0 ? Math.min(1, inWindow.length / widgetViews) : 0;

    return {
      range,
      totalRequests: inWindow.length,
      widgetViews,
      widgetViewsApprox: spec.windowMs < 30 * DAY_MS,
      visitorConversionRate,
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
