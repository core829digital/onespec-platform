/**
 * Fornitura: the supply process of every quote (quote -> order -> production -> delivery -> delivered), the partners
 * (factory / deliverer) and the net profit. The rules live in src/shared/supply.ts. Amounts are cents WITHOUT VAT.
 */
import { mutation, query, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission, requirePermissionOrNull, roleAtLeast } from "./lib/rbac";
import { must } from "./lib/validate";
import { lockedSafeLeadName } from "./lib/quotaLock";
import { ensureOrdered } from "./lib/supply";
import { advanceCantiereStatus, linkQuoteToCrm, type CantiereStatus } from "./lib/crmLink";
import { ensureLogisticsMirror, syncPartnerEdit } from "./lib/partnerLinks";
import { ensureDeliveryForSupply, receiveDelivery, takeBackDelivery } from "./lib/deliveryCore";
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

async function ownSupply(ctx: MutationCtx, id: Id<"supplies">, action: "supply.use" | "supply.manage" = "supply.use") {
  const s = await ctx.db.get(id);
  if (!s) throw new ConvexError("SUPPLY_NOT_FOUND");
  await requirePermission(ctx, s.tenantId, action);
  return s;
}

/** Whether the caller may revert / delete (admins and owners); the UI hides those buttons otherwise. */
export const access = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { membership } = await requirePermission(ctx, args.tenantId, "supply.use");
    return { canManage: roleAtLeast(membership.role, "admin") };
  },
});

// ── Partners ────────────────────────────────────────────────────────────────

export const listPartners = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "supply.use");
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
    const { tenant } = await requirePermission(ctx, args.tenantId, "supply.manage");
    const now = Date.now();
    const id = await ctx.db.insert("supplyPartners", { tenantId: args.tenantId, ...cleanPartner(args, tenant.country), createdAt: now, updatedAt: now });
    // The supplier is also a shipper: it appears in Logistica straight away (or is linked to the one already there).
    const created = await ctx.db.get(id);
    if (created) await ensureLogisticsMirror(ctx, created);
    return id;
  },
});

export const updatePartner = mutation({
  args: { partnerId: v.id("supplyPartners"), ...partnerFields, archived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.partnerId);
    if (!p) throw new ConvexError("SUPPLY_PARTNER_NOT_FOUND");
    const { tenant } = await requirePermission(ctx, p.tenantId, "supply.manage");
    await ctx.db.replace(args.partnerId, {
      tenantId: p.tenantId,
      ...cleanPartner(args, tenant.country),
      vatId: p.vatId,
      address: p.address,
      archived: args.archived ?? p.archived,
      createdAt: p.createdAt,
      updatedAt: Date.now(),
    });
    // Name and contacts reach Logistica and the price-source directory.
    await syncPartnerEdit(ctx, args.partnerId);
  },
});

// ── Supplies ────────────────────────────────────────────────────────────────

export const list = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "supply.use");
    const rows = await ctx.db.query("supplies").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(500);
    return rows.map((s) => ({ ...s, costCents: supplyCostCents(s), profitCents: supplyProfitCents(s) }));
  },
});

/** The supply of one quote (stage only), or null: the quote page shows it or offers to start it. */
export const forQuote = query({
  args: { quoteId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) return null;
    if (!(await requirePermissionOrNull(ctx, quote.tenantId, "supply.use"))) return null; // outside the member's area: nothing to show, nothing to start
    const s = await ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId)).first();
    return s ? { _id: s._id, status: s.status } : null;
  },
});

/** Supplies a shipment can still be linked to: past the order, not delivered, and with no live shipment yet. */
export const forShipment = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "logistics.use");
    const out: Array<{ _id: Id<"supplies">; reference: string; customerName: string }> = [];
    for (const status of ["production", "delivery"] as const) {
      const rows = await ctx.db.query("supplies").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", status)).take(200);
      for (const s of rows) {
        const shipment = await ctx.db.query("deliveries").withIndex("by_supply", (q) => q.eq("supplyId", s._id)).first();
        if (shipment && shipment.status !== "cancelled") continue;
        out.push({ _id: s._id, reference: s.reference, customerName: s.customerName });
      }
    }
    return out;
  },
});

/** Quotes that can still start a supply (not lost / spam, no supply yet): newest first. */
export const quotesWithoutSupply = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "supply.use");
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
    const first = await ctx.db.get(args.quoteId);
    if (!first) throw new ConvexError("QUOTE_NOT_FOUND");
    const { userId } = await requirePermission(ctx, first.tenantId, "supply.use");
    if (first.status === "lost" || first.status === "spam") throw new ConvexError("SUPPLY_QUOTE_NOT_USABLE");
    const existing = await ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId)).first();
    if (existing) throw new ConvexError("SUPPLY_ALREADY_EXISTS");
    // A supply always has its customer and its site: find or create them from the quote before the supply is written.
    await linkQuoteToCrm(ctx, { quoteId: args.quoteId, userId, stage: first.status === "won" ? "won" : "quoted" });
    const quote = (await ctx.db.get(args.quoteId)) ?? first;
    // A deal already closed (won / signed before the supply existed) starts at "Ordine", not at "Preventivo".
    if (quote.status === "won") {
      await ensureOrdered(ctx, quote);
      const created = await ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId)).first();
      return created!._id;
    }
    const now = Date.now();
    return await ctx.db.insert("supplies", {
      tenantId: quote.tenantId,
      quoteId: quote._id,
      clientId: quote.clientId,
      cantiereId: quote.cantiereId,
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
      if (quote && quote.status !== "won") {
        await ctx.db.patch(quote._id, { status: "won" });
        // Closing the deal makes the customer an active client and confirms the site (found or created if missing).
        const { userId } = await requirePermission(ctx, s.tenantId, "supply.use");
        const crm = await linkQuoteToCrm(ctx, { quoteId: quote._id, userId, stage: "won" });
        if (crm.clientId !== s.clientId || crm.cantiereId !== s.cantiereId) {
          patch.clientId = crm.clientId;
          patch.cantiereId = crm.cantiereId;
        }
      }
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
    // The two pages tell the same story: the stage "Consegna" opens the shipment in Logistica, "Consegnata" receives it into the warehouse.
    if (to === "delivery") await ensureDeliveryForSupply(ctx, { ...s, ...patch } as Doc<"supplies">);
    if (to === "delivered") {
      const shipment = await ctx.db.query("deliveries").withIndex("by_supply", (q) => q.eq("supplyId", s._id)).first();
      if (shipment && shipment.status !== "received" && shipment.status !== "cancelled") await receiveDelivery(ctx, shipment, undefined);
    }
    // The site follows the supply (never backwards: a site already in posa / collaudo / chiuso stays where it is).
    const SITE_STAGE: Partial<Record<Doc<"supplies">["status"], CantiereStatus>> = { order: "confermato", production: "in_produzione", delivery: "pronto_consegna" };
    const siteStage = SITE_STAGE[to];
    if (siteStage) await advanceCantiereStatus(ctx, patch.cantiereId ?? s.cantiereId, siteStage);
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
    const s = await ownSupply(ctx, args.supplyId, "supply.manage");
    const to = previousStage(s.status);
    if (!to) throw new ConvexError("SUPPLY_CANNOT_REVERT");
    const now = Date.now();
    // The shipment goes back with the stage (refused with a clear message if its goods already left the warehouse).
    if (s.status === "delivery" || s.status === "delivered") await takeBackDelivery(ctx, s._id, s.status);
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
    const s = await ownSupply(ctx, args.supplyId, "supply.manage");
    if (s.status !== "quote" && s.status !== "order") throw new ConvexError("SUPPLY_CANNOT_DELETE");
    await ctx.db.delete(s._id);
  },
});

// ── Net profit ──────────────────────────────────────────────────────────────

/** Net profit (without VAT, before income taxes) of the delivered supplies in every window, plus what the open ones are expected to earn. */
export const profit = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "supply.use");
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

// ── Export for the accountant ───────────────────────────────────────────────

const MAX_EXPORT_SPAN_MS = 11 * 366 * 24 * 3600 * 1000;

/** Supplies delivered between `from` and `to` (inclusive, ms), with partner names and the VAT data of their quote. */
export const exportRows = query({
  args: { tenantId: v.id("tenants"), from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "supply.use");
    if (!Number.isFinite(args.from) || !Number.isFinite(args.to) || args.from > args.to || args.to - args.from > MAX_EXPORT_SPAN_MS) {
      throw new ConvexError("INVALID_INPUT");
    }
    const rows = await ctx.db
      .query("supplies")
      .withIndex("by_tenant_delivered", (q) => q.eq("tenantId", args.tenantId).gte("deliveredAt", args.from).lte("deliveredAt", args.to))
      .take(5000);
    const names = new Map<string, string>();
    const nameOf = async (id: Id<"supplyPartners"> | undefined) => {
      if (!id) return undefined;
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.name ?? "");
      return names.get(id) || undefined;
    };
    const out = [];
    for (const s of rows) {
      if (s.deliveredAt === undefined) continue;
      const quote = await ctx.db.get(s.quoteId);
      out.push({
        reference: s.reference,
        customerName: s.customerName,
        orderedAt: s.orderedAt,
        deliveredAt: s.deliveredAt,
        producer: await nameOf(s.producerId),
        deliverer: await nameOf(s.delivererId),
        revenueExVatCents: s.revenueExVatCents,
        vatPercent: quote?.vatRatePercent ?? 0,
        vatReason: quote?.vatReason,
        factoryCostCents: s.factoryCostCents ?? 0,
        factoryPaidAt: s.factoryPaidAt,
        transportCostCents: s.transportCostCents ?? 0,
        otherCostsCents: s.otherCostsCents ?? 0,
      });
    }
    return out;
  },
});
