/**
 * One supplier, one company: the Fornitura directory (`supplyPartners`), the Logistica directory (`logisticsSuppliers`, who ships goods to
 * the warehouse) and the price-source directory of multi-supplier quotes (`catalogSuppliers`) describe the SAME real-world companies.
 *
 * The partner is the master record. Every partner has a mirror in Logistica (the factory that makes the windows is the one that ships them),
 * a supplier created in Logistica or in the price directory gets its partner, and name / contact edits flow in every direction.
 * Links are matched by VAT number, e-mail, then name, so nothing is duplicated when the same company already exists on another page.
 * Mirrors created from a partner are not counted against the plan's cap on hand-made Logistica suppliers: the cap guards the manual form only.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normText } from "./crmLink";

type Partner = Doc<"supplyPartners">;
type Logistics = Doc<"logisticsSuppliers">;
type Catalog = Doc<"catalogSuppliers">;

const sameEmail = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const sameVat = (a?: string, b?: string) => {
  const x = (a ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const y = (b ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return x.length >= 6 && x === y;
};

/** The same company, by VAT number, then e-mail, then name. */
function matches(a: { name: string; email?: string; vat?: string }, b: { name: string; email?: string; vat?: string }): boolean {
  return sameVat(a.vat, b.vat) || sameEmail(a.email, b.email) || (!!normText(a.name) && normText(a.name) === normText(b.name));
}

/** A Logistica supplier that is already the same company (by e-mail or name): creating it again would duplicate it. */
export async function findLogisticsMatch(ctx: MutationCtx, tenantId: Id<"tenants">, c: { name: string; email?: string }): Promise<Logistics | null> {
  const all = await ctx.db.query("logisticsSuppliers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(1000);
  return all.find((l) => matches({ name: l.name, email: l.email }, c)) ?? null;
}

async function partnersOf(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<Partner[]> {
  return await ctx.db.query("supplyPartners").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(1000);
}

/** The Logistica entry of a partner: updated if it exists, adopted if the same company is already there unlinked, created otherwise. */
export async function ensureLogisticsMirror(ctx: MutationCtx, partner: Partner): Promise<Id<"logisticsSuppliers">> {
  const now = Date.now();
  const fields = {
    name: partner.name,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    address: partner.address,
  };
  const linked = await ctx.db.query("logisticsSuppliers").withIndex("by_partner", (q) => q.eq("partnerId", partner._id)).first();
  if (linked) {
    if (linked.name !== fields.name || linked.contactName !== fields.contactName || linked.phone !== fields.phone || linked.email !== fields.email || linked.address !== fields.address) {
      await ctx.db.patch(linked._id, { ...fields, updatedAt: now });
    }
    return linked._id;
  }
  const loose = (await ctx.db.query("logisticsSuppliers").withIndex("by_tenant", (q) => q.eq("tenantId", partner.tenantId)).take(1000)).find(
    (l) => !l.partnerId && matches({ name: l.name, email: l.email }, { name: partner.name, email: partner.email, vat: partner.vatId }),
  );
  if (loose) {
    await ctx.db.patch(loose._id, { partnerId: partner._id, updatedAt: now });
    return loose._id;
  }
  return await ctx.db.insert("logisticsSuppliers", { tenantId: partner.tenantId, ...fields, partnerId: partner._id, createdAt: now, updatedAt: now });
}

/** The partner of a Logistica supplier (a company that ships goods is a "deliverer"): linked, adopted by name / e-mail, or created. */
export async function ensurePartnerForLogistics(ctx: MutationCtx, ls: Logistics): Promise<Id<"supplyPartners">> {
  const now = Date.now();
  if (ls.partnerId) {
    const p = await ctx.db.get(ls.partnerId);
    if (p && p.tenantId === ls.tenantId) return p._id;
  }
  const found = (await partnersOf(ctx, ls.tenantId)).find((p) => matches({ name: ls.name, email: ls.email }, { name: p.name, email: p.email, vat: p.vatId }));
  const partnerId =
    found?._id ??
    (await ctx.db.insert("supplyPartners", {
      tenantId: ls.tenantId,
      name: ls.name,
      roles: ["deliverer"],
      contactName: ls.contactName,
      phone: ls.phone,
      email: ls.email,
      address: ls.address,
      notes: ls.notes,
      createdAt: now,
      updatedAt: now,
    }));
  if (found && !found.roles.includes("deliverer")) await ctx.db.patch(found._id, { roles: [...found.roles, "deliverer"], updatedAt: now });
  await ctx.db.patch(ls._id, { partnerId, updatedAt: now });
  return partnerId;
}

/** The partner of a price-source supplier (it supplies goods: a "producer"). */
export async function ensurePartnerForCatalog(ctx: MutationCtx, cs: Catalog): Promise<Id<"supplyPartners">> {
  const now = Date.now();
  if (cs.partnerId) {
    const p = await ctx.db.get(cs.partnerId);
    if (p && p.tenantId === cs.tenantId) return p._id;
  }
  const found = (await partnersOf(ctx, cs.tenantId)).find((p) => matches({ name: cs.name, email: cs.email, vat: cs.vatNumber }, { name: p.name, email: p.email, vat: p.vatId }));
  const partnerId =
    found?._id ??
    (await ctx.db.insert("supplyPartners", {
      tenantId: cs.tenantId,
      name: cs.name,
      roles: ["producer"],
      phone: cs.phone,
      email: cs.email,
      address: cs.address,
      vatId: cs.vatNumber,
      createdAt: now,
      updatedAt: now,
    }));
  if (found && !found.roles.includes("producer")) await ctx.db.patch(found._id, { roles: [...found.roles, "producer"], updatedAt: now });
  await ctx.db.patch(cs._id, { partnerId, updatedAt: now });
  const created = await ctx.db.get(partnerId);
  if (created) await ensureLogisticsMirror(ctx, created);
  return partnerId;
}

/** A partner was edited: its Logistica entry and its price-source entries show the same name and contacts. */
export async function syncPartnerEdit(ctx: MutationCtx, partnerId: Id<"supplyPartners">): Promise<void> {
  const partner = await ctx.db.get(partnerId);
  if (!partner) return;
  await ensureLogisticsMirror(ctx, partner);
  const catalog = await ctx.db.query("catalogSuppliers").withIndex("by_partner", (q) => q.eq("partnerId", partnerId)).take(20);
  for (const c of catalog) {
    if (c.name !== partner.name || c.email !== partner.email || c.phone !== partner.phone) {
      await ctx.db.patch(c._id, { name: partner.name, email: partner.email, phone: partner.phone, updatedAt: Date.now() });
    }
  }
}

/** A Logistica supplier was edited: its partner shows the same name and contacts (and from there the price-source entries). */
export async function syncLogisticsEdit(ctx: MutationCtx, logisticsId: Id<"logisticsSuppliers">): Promise<void> {
  const ls = await ctx.db.get(logisticsId);
  if (!ls) return;
  const partnerId = await ensurePartnerForLogistics(ctx, ls);
  const partner = await ctx.db.get(partnerId);
  if (!partner) return;
  const patch: Partial<Partner> = {};
  if (partner.name !== ls.name) patch.name = ls.name;
  if (ls.contactName !== undefined && partner.contactName !== ls.contactName) patch.contactName = ls.contactName;
  if (ls.phone !== undefined && partner.phone !== ls.phone) patch.phone = ls.phone;
  if (ls.email !== undefined && partner.email !== ls.email) patch.email = ls.email;
  if (ls.address !== undefined && partner.address !== ls.address) patch.address = ls.address;
  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(partnerId, { ...patch, updatedAt: Date.now() });
    await syncPartnerEdit(ctx, partnerId);
  }
}

/** Idempotent clean-up for accounts that already had the three directories apart: links what matches, mirrors the rest. */
export async function reconcileDirectories(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<{ linked: number }> {
  let linked = 0;
  const logistics = await ctx.db.query("logisticsSuppliers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(1000);
  for (const l of logistics) {
    if (!l.partnerId) {
      await ensurePartnerForLogistics(ctx, l);
      linked++;
    }
  }
  const catalog = await ctx.db.query("catalogSuppliers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(1000);
  for (const c of catalog) {
    if (!c.partnerId) {
      await ensurePartnerForCatalog(ctx, c);
      linked++;
    }
  }
  for (const p of await partnersOf(ctx, tenantId)) {
    if (p.archived) continue;
    const has = await ctx.db.query("logisticsSuppliers").withIndex("by_partner", (q) => q.eq("partnerId", p._id)).first();
    if (!has) {
      await ensureLogisticsMirror(ctx, p);
      linked++;
    }
  }
  return { linked };
}
