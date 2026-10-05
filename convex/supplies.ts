/**
 * Fornitura: the supply process of every quote (quote -> order -> production -> delivery -> delivered), the partners
 * (factory / deliverer) and the net profit. The rules live in src/shared/supply.ts. Amounts are cents WITHOUT VAT.
 */
import { mutation, query, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/rbac";
import { must } from "./lib/validate";
import { lockedSafeLeadName } from "./lib/quotaLock";
import { checkEmail, checkPersonName, checkPhone, checkText, checkCompanyName, type CountryCode } from "../src/shared/validation";
import {
  PARTNER_ROLES,
  checkAmountCents,
  expectedProfit,
  nextStage,
  previousStage,
  summarizeProfit,
  supplyCostCents,
  supplyProfitCents,
  windowStart,
  type PartnerRole,
} from "../src/shared/supply";

const roleValidator = v.union(v.literal("producer"), v.literal("deliverer"));
const NOTES_MAX = 2_000;

function money(raw: number | undefined, required: boolean): number | undefined {
  if (raw === undefined) {
    if (required) throw new ConvexError("VALIDATION_REQUIRED");
    return undefined;
  }
  const r = checkAmountCents(raw);
  if (!r.ok) throw new ConvexError(r.code === "REQUIRED" ? "VALIDATION_REQUIRED" : "SUPPLY_INVALID_AMOUNT");
  return r.cents;
}

function cleanNotes(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const r = checkText(raw, { max: NOTES_MAX, multiline: true, required: false });
  return must(r) || undefined;
}

function cleanRoles(roles: PartnerRole[]): PartnerRole[] {
  const unique = PARTNER_ROLES.filter((r) => roles.includes(r));
  if (unique.length === 0) throw new ConvexError("SUPPLY_PARTNER_ROLE_REQUIRED");
  return unique;
}

async function ownPartner(ctx: MutationCtx, tenantId: Id<"tenants">, id: Id<"supplyPartners"> | undefined, role: PartnerRole) {
  if (!id) return undefined;
  const p = await ctx.db.get(id);
  if (!p || p.tenantId !== tenantId) throw new ConvexError("SUPPLY_PARTNER_NOT_FOUND");
  if (p.archived) throw new ConvexError("SUPPLY_PARTNER_ARCHIVED");
  if (!p.roles.includes(role)) throw new ConvexError("SUPPLY_PARTNER_WRONG_ROLE");
  return p._id;
}

async function ownSupply(ctx: MutationCtx, id: Id<"supplies">, action: "quotes.use" | "quotes.manage" = "quotes.use") {
  const s = await ctx.db.get(id);
  if (!s) throw new ConvexError("SUPPLY_NOT_FOUND");
  await requirePermission(ctx, s.tenantId, action);
  return s;
}

// ── Partners ────────────────────────────────────────────────────────────────

export const listPartners = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "quotes.use");
    return await ctx.db.query("supplyPartners").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").collect();
  },
});

const partnerFields = {
  name: v.string(),
  roles: v.array(roleValidator),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  notes: v.optional(v.string()),
};

function cleanPartner(a: { name: string; roles: PartnerRole[]; contactName?: string; phone?: string; email?: string; notes?: string }, country: string | undefined) {
  const phoneCountry = (country ?? "IT") as CountryCode;
  const contactName = a.contactName?.trim() ? must(checkPersonName(a.contactName)) : undefined;
  const phone = a.phone?.trim() ? must(checkPhone(phoneCountry, a.phone)) : undefined;
  const email = a.email?.trim() ? must(checkEmail(a.email)) : undefined;
  return { name: must(checkCompanyName(a.name)), roles: cleanRoles(a.roles), contactName, phone, email, notes: cleanNotes(a.notes) };
}

export const createPartner = mutation({
  args: { tenantId: v.id("tenants"), ...partnerFields },
  handler: async (ctx, args) => {
    const { tenant } = await requirePermission(ctx, args.tenantId, "quotes.manage");
    const now = Date.now();
    return await ctx.db.insert("supplyPartners", { tenantId: args.tenantId, ...cleanPartner(args, tenant.country), createdAt: now, updatedAt: now });
  },
});

export const updatePartner = mutation({
  args: { partnerId: v.id("supplyPartners"), ...partnerFields, archived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.partnerId);
    if (!p) throw new ConvexError("SUPPLY_PARTNER_NOT_FOUND");
    const { tenant } = await requirePermission(ctx, p.tenantId, "quotes.manage");
    await ctx.db.replace(args.partnerId, {
      tenantId: p.tenantId,
      ...cleanPartner(args, tenant.country),
      vatId: p.vatId,
      archived: args.archived ?? p.archived,
      createdAt: p.createdAt,
      updatedAt: Date.now(),
    });
  },
});

// ── Supplies ────────────────────────────────────────────────────────────────

export const list = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "quotes.use");
    const rows = await ctx.db.query("supplies").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(500);
    return rows.map((s) => ({ ...s, costCents: supplyCostCents(s), profitCents: supplyProfitCents(s) }));
  },
});

/** Quotes that can still start a supply (not lost / spam, no supply yet): newest first. */
export const quotesWithoutSupply = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "quotes.use");
    const recent = await ctx.db.query("quoteRequests").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(100);
    const out: Array<{ _id: Id<"quoteRequests">; reference: string; customerName: string; priceExVatCents: number; status: string }> = [];
    for (const q of recent) {
      if (q.status === "lost" || q.status === "spam") continue;
      const has = await ctx.db.query("supplies").withIndex("by_quote", (x) => x.eq("quoteId", q._id)).first();
      if (has) continue;
      out.push({ _id: q._id, reference: q.offerNumber ?? String(q._id), customerName: lockedSafeLeadName(q), priceExVatCents: q.priceExVatCents, status: q.status });
      if (out.length >= 50) break;
    }
    return out;
  },
});

export const createFromQuote = mutation({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new ConvexError("QUOTE_NOT_FOUND");
    await requirePermission(ctx, quote.tenantId, "quotes.use");
    if (quote.status === "lost" || quote.status === "spam") throw new ConvexError("SUPPLY_QUOTE_NOT_USABLE");
    const existing = await ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId)).first();
    if (existing) throw new ConvexError("SUPPLY_ALREADY_EXISTS");
    const now = Date.now();
    return await ctx.db.insert("supplies", {
      tenantId: quote.tenantId,
      quoteId: quote._id,
      reference: quote.offerNumber ?? String(quote._id),
      customerName: lockedSafeLeadName(quote),
      status: "quote",
      revenueExVatCents: quote.priceExVatCents,
      quotedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Moves the supply one stage forward.
 *  - order: the customer paid and the deal is closed (the quote becomes "won").
 *  - production: needs the price the installer pays the factory (and optionally the factory).
 *  - delivery: needs the transport price (and optionally the deliverer).
 *  - delivered: closes the supply; from now on it counts in the net profit.
 */
export const advance = mutation({
  args: {
    supplyId: v.id("supplies"),
    factoryCostCents: v.optional(v.number()),
    producerId: v.optional(v.id("supplyPartners")),
    transportCostCents: v.optional(v.number()),
    delivererId: v.optional(v.id("supplyPartners")),
  },
  handler: async (ctx, args) => {
    const s = await ownSupply(ctx, args.supplyId);
    const to = nextStage(s.status);
    if (!to) throw new ConvexError("SUPPLY_ALREADY_DELIVERED");
    const now = Date.now();
    const patch: Partial<Doc<"supplies">> = { status: to, updatedAt: now };
    if (to === "order") {
      patch.orderedAt = now;
      const quote = await ctx.db.get(s.quoteId);
      if (quote && quote.status !== "won") await ctx.db.patch(quote._id, { status: "won" });
    } else if (to === "production") {
      patch.factoryCostCents = money(args.factoryCostCents, true);
      patch.producerId = await ownPartner(ctx, s.tenantId, args.producerId, "producer");
      patch.productionAt = now;
    } else if (to === "delivery") {
      patch.transportCostCents = money(args.transportCostCents ?? 0, true);
      patch.delivererId = await ownPartner(ctx, s.tenantId, args.delivererId, "deliverer");
      patch.deliveryAt = now;
    } else {
      patch.deliveredAt = now;
    }
    await ctx.db.patch(s._id, patch);
    await ctx.db.insert("auditLog", {
      tenantId: s.tenantId,
      actorKind: "user",
      action: "supply.advance",
      targetTable: "supplies",
      targetId: s._id,
      meta: { from: s.status, to },
      createdAt: now,
    });
  },
});

/** One stage back (admins only): clears what that stage had recorded so it can be entered again. */
export const revert = mutation({
  args: { supplyId: v.id("supplies") },
  handler: async (ctx, args) => {
    const s = await ownSupply(ctx, args.supplyId, "quotes.manage");
    const to = previousStage(s.status);
    if (!to) throw new ConvexError("SUPPLY_CANNOT_REVERT");
    const now = Date.now();
    const clear: Record<string, undefined> = {};
    if (s.status === "order") clear.orderedAt = undefined;
    if (s.status === "production") Object.assign(clear, { productionAt: undefined, factoryCostCents: undefined, factoryPaidAt: undefined, producerId: undefined });
    if (s.status === "delivery") Object.assign(clear, { deliveryAt: undefined, transportCostCents: undefined, delivererId: undefined });
    if (s.status === "delivered") clear.deliveredAt = undefined;
    await ctx.db.patch(s._id, { ...clear, status: to, updatedAt: now });
    await ctx.db.insert("auditLog", { tenantId: s.tenantId, actorKind: "user", action: "supply.revert", targetTable: "supplies", targetId: s._id, meta: { from: s.status, to }, createdAt: now });
  },
});

/** Costs and notes that can be edited while the supply is open (the factory cost only from production on). */
export const updateCosts = mutation({
  args: {
    supplyId: v.id("supplies"),
    factoryCostCents: v.optional(v.number()),
    transportCostCents: v.optional(v.number()),
    otherCostsCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await ownSupply(ctx, args.supplyId);
    const idx = ["quote", "order", "production", "delivery", "delivered"].indexOf(s.status);
    const patch: Partial<Doc<"supplies">> = { updatedAt: Date.now() };
    if (args.factoryCostCents !== undefined) {
      if (idx < 2) throw new ConvexError("SUPPLY_STAGE_TOO_EARLY");
      patch.factoryCostCents = money(args.factoryCostCents, true);
    }
    if (args.transportCostCents !== undefined) {
      if (idx < 3) throw new ConvexError("SUPPLY_STAGE_TOO_EARLY");
      patch.transportCostCents = money(args.transportCostCents, true);
    }
    if (args.otherCostsCents !== undefined) patch.otherCostsCents = money(args.otherCostsCents, true);
    if (args.notes !== undefined) patch.notes = cleanNotes(args.notes);
    await ctx.db.patch(s._id, patch);
  },
});

/** The installer paid the factory (or undoes it). */
export const setFactoryPaid = mutation({
  args: { supplyId: v.id("supplies"), paid: v.boolean() },
  handler: async (ctx, args) => {
    const s = await ownSupply(ctx, args.supplyId);
    if (s.status !== "production" && s.status !== "delivery" && s.status !== "delivered") throw new ConvexError("SUPPLY_STAGE_TOO_EARLY");
    await ctx.db.patch(s._id, { factoryPaidAt: args.paid ? Date.now() : undefined, updatedAt: Date.now() });
  },
});

/** Only before the customer pays (stages quote / order); admins only. */
export const remove = mutation({
  args: { supplyId: v.id("supplies") },
  handler: async (ctx, args) => {
    const s = await ownSupply(ctx, args.supplyId, "quotes.manage");
    if (s.status !== "quote" && s.status !== "order") throw new ConvexError("SUPPLY_CANNOT_DELETE");
    await ctx.db.delete(s._id);
  },
});

// ── Net profit ──────────────────────────────────────────────────────────────

/** Net profit (without VAT, before income taxes) of the delivered supplies in every window, plus what the open ones are expected to earn. */
export const profit = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "quotes.use");
    const now = Date.now();
    const since = windowStart(now, 120);
    const delivered = (
      await ctx.db
        .query("supplies")
        .withIndex("by_tenant_delivered", (q) => q.eq("tenantId", args.tenantId).gt("deliveredAt", since))
        .take(5000)
    ).flatMap((s) => (s.deliveredAt !== undefined ? [{ ...s, deliveredAt: s.deliveredAt }] : []));
    const open: Doc<"supplies">[] = [];
    for (const status of ["order", "production", "delivery"] as const) {
      open.push(...(await ctx.db.query("supplies").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", status)).take(2000)));
    }
    return { now, windows: summarizeProfit(delivered, now), expected: expectedProfit(open) };
  },
});
