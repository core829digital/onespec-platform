import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { currentPeriod, entitlementsFor, isWidgetPlan, resolveTenantEntitlements } from "./lib/entitlements";
import { enforceActivePlan, enforceShowroomCalculator } from "./lib/enforcement";
import { requirePermission } from "./lib/rbac";
import { consumeMetered, showroomFingerprint, type MeterResult } from "./lib/metering";

/**
 * "Accetta ma blocca" — lifting the lock. A quota-locked request becomes
 * visible when the tenant upgrades, or once the month it arrived in is over.
 * Unlocking is one-way: a downgrade never re-locks a request.
 */

const BATCH = 200;

/** Start (ms, UTC) of the calendar month `currentPeriod()` reports for `now`. */
export function periodStartMs(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Unlock every locked request of one tenant (after an upgrade). Batched, self-rescheduling. */
export const unlockTenantLockedRequests = internalMutation({
  args: { tenantId: v.id("tenants") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("quoteRequests")
      .withIndex("by_tenantId_and_quotaLocked", (q) => q.eq("tenantId", args.tenantId).eq("quotaLocked", true))
      .take(BATCH);
    for (const row of rows) await ctx.db.patch(row._id, { quotaLocked: undefined });
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.usage.unlockTenantLockedRequests, args);
    }
    if (rows.length > 0) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        actorKind: "system",
        action: "usage.quota_unlock",
        targetTable: "quoteRequests",
        meta: { reason: "upgrade", count: rows.length },
        createdAt: Date.now(),
      });
    }
    return rows.length;
  },
});

/** Daily sweep: unlock requests locked in a month that is now over. Batched, self-rescheduling. */
export const unlockPreviousPeriods = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const start = periodStartMs(Date.now());
    const rows = await ctx.db
      .query("quoteRequests")
      .withIndex("by_quotaLocked", (q) => q.eq("quotaLocked", true).lt("_creationTime", start))
      .take(BATCH);
    for (const row of rows) await ctx.db.patch(row._id, { quotaLocked: undefined });
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.usage.unlockPreviousPeriods, {});
    }
    return rows.length;
  },
});

/**
 * Call wherever `tenants.plan` changes. Moving off a widget-first plan, or to
 * one with a larger monthly allowance, unlocks that tenant's locked requests.
 */
export async function unlockOnPlanChange(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  fromPlan: string,
  toPlan: string,
): Promise<void> {
  if (fromPlan === toPlan || !isWidgetPlan(fromPlan)) return;
  const upgraded =
    !isWidgetPlan(toPlan) || entitlementsFor(toPlan).maxQuotesPerMonth > entitlementsFor(fromPlan).maxQuotesPerMonth;
  if (upgraded) {
    await ctx.scheduler.runAfter(0, internal.usage.unlockTenantLockedRequests, { tenantId });
  }
}

/* ------------------------------------------------------------------------ */
/*  Metered actions (widget-first plans; no-ops on full-platform plans)      */
/* ------------------------------------------------------------------------ */

const meterResult = v.object({ charged: v.boolean(), used: v.number(), limit: v.number() });

/** JSON can't carry Infinity: unlimited is reported as -1. */
function wire(r: MeterResult) {
  return { charged: r.charged, used: r.used, limit: Number.isFinite(r.limit) ? r.limit : -1 };
}

async function loadRequestForMetering(ctx: MutationCtx, quoteId: Id<"quoteRequests">) {
  const quote = await ctx.db.get(quoteId);
  if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
  const { userId, tenant } = await requirePermission(ctx, quote.tenantId, "quotes.use");
  await enforceActivePlan(ctx, quote.tenantId);
  // A quota-locked request has no contact details to send or print.
  if (quote.quotaLocked === true) throw new ConvexError("QUOTE_LOCKED");
  return { quote, userId, ent: resolveTenantEntitlements(tenant) };
}

/**
 * The installer downloads a request's PDF (print page + document exports).
 * Counts once per request; `quotes.getQuoteForPrint` serves the document on
 * widget-first plans only after this has succeeded.
 */
export const requestPdfExport = mutation({
  args: { quoteId: v.id("quoteRequests") },
  returns: meterResult,
  handler: async (ctx, args) => {
    const { quote, userId, ent } = await loadRequestForMetering(ctx, args.quoteId);
    const r = await consumeMetered(ctx, {
      tenantId: quote.tenantId, userId, kind: "widget_pdf", subjectKey: quote._id, limit: ent.maxPdfExportsPerMonth,
    });
    if (r.charged) await audit(ctx, quote.tenantId, userId, "usage.pdf_export", quote._id);
    return wire(r);
  },
});

/** The installer sends a request to the customer on WhatsApp from the app. Counts once per request. */
export const requestWhatsappSend = mutation({
  args: { quoteId: v.id("quoteRequests") },
  returns: meterResult,
  handler: async (ctx, args) => {
    const { quote, userId, ent } = await loadRequestForMetering(ctx, args.quoteId);
    const r = await consumeMetered(ctx, {
      tenantId: quote.tenantId, userId, kind: "widget_whatsapp", subjectKey: quote._id, limit: ent.maxWhatsappSendsPerMonth,
    });
    if (r.charged) await audit(ctx, quote.tenantId, userId, "usage.whatsapp_send", quote._id);
    return wire(r);
  },
});

const showroomOptions = v.object({
  regionCode: v.union(v.literal("IT"), v.literal("FR"), v.literal("BE"), v.literal("NL"), v.literal("DE"), v.literal("LU")),
  buildingAge: v.number(),
  isEnergyRenovation: v.boolean(),
  deductionPercent: v.number(),
  uwAnte: v.optional(v.number()),
});

/**
 * A showroom quote leaves the showroom (document export or WhatsApp). The
 * first send of a given quote (same pieces + options) registers it against
 * the monthly showroom-quote allowance; each channel then counts once.
 * Atomic: if the channel allowance is exhausted, the quote isn't counted either.
 */
export const registerShowroomSend = mutation({
  args: {
    tenantId: v.id("tenants"),
    channel: v.union(v.literal("pdf"), v.literal("whatsapp")),
    items: v.array(v.any()),
    options: showroomOptions,
  },
  returns: v.object({ quote: meterResult, channel: meterResult }),
  handler: async (ctx, args) => {
    if (args.items.length === 0 || args.items.length > 200) throw new ConvexError("INVALID_ITEMS");
    const { userId, tenant } = await requirePermission(ctx, args.tenantId, "quotes.use");
    await enforceActivePlan(ctx, args.tenantId);
    await enforceShowroomCalculator(ctx, args.tenantId);
    const ent = resolveTenantEntitlements(tenant);
    const key = await showroomFingerprint(args.items, args.options);

    const quote = await consumeMetered(ctx, {
      tenantId: args.tenantId, userId, kind: "showroom_quote", subjectKey: key, limit: ent.maxShowroomQuotesPerMonth,
    });
    const channel = await consumeMetered(ctx, {
      tenantId: args.tenantId,
      userId,
      kind: args.channel === "pdf" ? "showroom_pdf" : "showroom_whatsapp",
      subjectKey: key,
      limit: args.channel === "pdf" ? ent.maxShowroomPdfPerMonth : ent.maxShowroomWhatsappPerMonth,
    });
    if (quote.charged) await audit(ctx, args.tenantId, userId, "usage.showroom_quote", key);
    return { quote: wire(quote), channel: wire(channel) };
  },
});

async function audit(ctx: MutationCtx, tenantId: Id<"tenants">, userId: Id<"users">, action: string, targetId: string) {
  await ctx.db.insert("auditLog", {
    tenantId,
    actorUserId: userId,
    actorKind: "user",
    action,
    targetTable: action === "usage.showroom_quote" ? "showroom" : "quoteRequests",
    targetId,
    createdAt: Date.now(),
  });
}

/** This month's metered usage vs. plan limits, for the in-app meters. `limit: -1` = unlimited. */
export const getUsage = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    period: v.string(),
    plan: v.string(),
    widgetPlan: v.boolean(),
    meters: v.array(v.object({ key: v.string(), used: v.number(), limit: v.number() })),
  }),
  handler: async (ctx, args) => {
    const { tenant } = await requirePermission(ctx, args.tenantId, "quotes.use");
    const ent = resolveTenantEntitlements(tenant);
    const period = currentPeriod();
    const c = await ctx.db
      .query("usageCounters")
      .withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId).eq("period", period))
      .first();
    const lim = (n: number) => (Number.isFinite(n) ? n : -1);
    const meters = [
      { key: "requests", used: c?.quoteRequestsCount ?? 0, limit: lim(ent.maxQuotesPerMonth) },
      { key: "pdf", used: c?.pdfExportsCount ?? 0, limit: lim(ent.maxPdfExportsPerMonth) },
      { key: "whatsapp", used: c?.whatsappSendsCount ?? 0, limit: lim(ent.maxWhatsappSendsPerMonth) },
    ];
    if (ent.showroomCalculator) {
      meters.push(
        { key: "showroomQuotes", used: c?.showroomQuotesCount ?? 0, limit: lim(ent.maxShowroomQuotesPerMonth) },
        { key: "showroomPdf", used: c?.showroomPdfCount ?? 0, limit: lim(ent.maxShowroomPdfPerMonth) },
        { key: "showroomWhatsapp", used: c?.showroomWhatsappCount ?? 0, limit: lim(ent.maxShowroomWhatsappPerMonth) },
      );
    }
    return {
      period,
      plan: tenant.plan,
      widgetPlan: tenant.unlimitedAccess !== true && isWidgetPlan(tenant.plan),
      meters,
    };
  },
});
