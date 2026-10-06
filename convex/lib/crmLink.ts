/**
 * Quote ↔ client ↔ cantiere ↔ supply: one customer, one site, everywhere.
 *
 * A quote written in the B2B page (or moved forward from the widget) must leave a customer card and a site card behind,
 * without the installer retyping them, and a change on any side must show on the others:
 *
 *   quote ──creates/finds──▶ client (by e-mail, VAT number, phone, then name)
 *   quote ──creates/finds──▶ cantiere (by client + street address)
 *   client / cantiere edits ──flow back──▶ the quotes and supplies that are still open
 *   quote status ──moves──▶ client status (lead → prospect → active) and cantiere stage (never backwards)
 *
 * Signed or closed quotes are legal documents: they keep what was agreed. Only open ones follow the edits.
 * Everything here runs inside the caller's mutation, so find-or-create can never create the same client twice.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const OPEN_QUOTE = new Set(["new", "contacted", "quoted"]);
const CANTIERE_ORDER = ["preventivo", "confermato", "in_produzione", "pronto_consegna", "in_posa", "collaudo", "chiuso"] as const;
export type CantiereStatus = (typeof CANTIERE_ORDER)[number];
const CLIENT_RANK: Record<Doc<"clients">["status"], number> = { lost: 0, inactive: 0, lead: 1, prospect: 2, active: 3 };

/** Lower-case, accent-free, punctuation-free: "Via  Roma, 12" and "via roma 12" are the same address. */
export function normText(s: string | undefined | null): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const normVat = (s: string | undefined | null) => (s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
/** Last 9 digits: "+39 333 1234567" and "3331234567" are the same phone. */
const phoneKey = (s: string | undefined | null) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
};

/** A quote whose contact details are hidden (quota / suspension) must not leak into the customer directory. */
function isHidden(q: Doc<"quoteRequests">): boolean {
  return q.quotaLocked === true || q.suspendedLocked === true;
}

export async function findClientMatch(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  q: { email?: string; phone?: string; vat?: string; name?: string; city?: string },
): Promise<Doc<"clients"> | null> {
  const email = q.email?.trim().toLowerCase();
  if (email) {
    const hit = await ctx.db
      .query("clients")
      .withIndex("by_tenant_email", (x) => x.eq("tenantId", tenantId).eq("email", email))
      .first();
    if (hit) return hit;
  }
  const all = await ctx.db.query("clients").withIndex("by_tenant", (x) => x.eq("tenantId", tenantId)).take(2000);
  const vat = normVat(q.vat);
  if (vat.length >= 6) {
    const hit = all.find((c) => normVat(c.vatNumber) === vat);
    if (hit) return hit;
  }
  const phone = phoneKey(q.phone);
  if (phone) {
    const hit = all.find((c) => phoneKey(c.phone) === phone);
    if (hit) return hit;
  }
  const name = normText(q.name);
  if (name) {
    const city = normText(q.city);
    // Same name is only the same person when nothing contradicts it: two different e-mails are two different people.
    return (
      all.find((c) => {
        if (normText(c.name) !== name) return false;
        if (email && c.email && c.email !== email) return false;
        if (city && c.siteCity && normText(c.siteCity) !== city) return false;
        return true;
      }) ?? null
    );
  }
  return null;
}

function targetClientStatus(stage: "quoted" | "won"): Doc<"clients">["status"] {
  return stage === "won" ? "active" : "prospect";
}

/** What a record (quote, survey, inspection…) knows about its customer and site: enough to find or create both. */
export interface PartyInput {
  tenantId: Id<"tenants">;
  userId: Id<"users">;
  name: string;
  email?: string;
  phone?: string;
  vat?: string;
  isBusiness?: boolean;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  source: string;
  /** "quoted" = prospect; "won" = active client. A record that is not a quote passes "quoted". */
  stage: "quoted" | "won";
  quoteId?: Id<"quoteRequests">;
  assignedUserId?: Id<"users">;
  valueCents?: number;
}

/** The client of this customer: found by e-mail / VAT / phone / name, or created. Null when there is no name to go by. */
async function findOrCreateClient(ctx: MutationCtx, p: PartyInput): Promise<{ client: Doc<"clients"> | null; created: boolean }> {
  const name = p.name.trim();
  if (!name) return { client: null, created: false };
  const match = await findClientMatch(ctx, p.tenantId, { email: p.email, phone: p.phone, vat: p.vat, name, city: p.city });
  if (match) return { client: match, created: false };
  const now = Date.now();
  const id = await ctx.db.insert("clients", {
    tenantId: p.tenantId,
    name: name.slice(0, 200),
    email: p.email?.trim() ? p.email.trim().toLowerCase() : undefined,
    phone: p.phone?.trim() || undefined,
    vatNumber: p.vat?.trim() || undefined,
    siteAddress: p.address?.trim() || undefined,
    siteCity: p.city?.trim() || undefined,
    sitePostalCode: p.postalCode?.trim() || undefined,
    siteCountry: p.country || undefined,
    type: p.isBusiness ? "company" : "private",
    tags: [],
    source: p.source,
    status: targetClientStatus(p.stage),
    createdAt: now,
    updatedAt: now,
  });
  const client = (await ctx.db.get(id))!;
  await ctx.db.insert("clientActivities", {
    tenantId: p.tenantId,
    clientId: id,
    userId: p.userId,
    type: "note",
    title: "Cliente creato automaticamente",
    relatedTable: p.quoteId ? "quoteRequests" : undefined,
    relatedId: p.quoteId,
    createdAt: now,
  });
  return { client, created: true };
}

/** Fills the client's empty fields from the record and moves its status forward (never backwards, never over what was typed). */
async function completeClient(ctx: MutationCtx, client: Doc<"clients">, p: PartyInput): Promise<void> {
  const fill: Partial<Doc<"clients">> = {};
  if (!client.email && p.email?.trim()) fill.email = p.email.trim().toLowerCase();
  if (!client.phone && p.phone?.trim()) fill.phone = p.phone.trim();
  if (!client.vatNumber && p.vat?.trim()) fill.vatNumber = p.vat.trim();
  if (!client.siteAddress && p.address?.trim()) fill.siteAddress = p.address.trim();
  if (!client.siteCity && p.city?.trim()) fill.siteCity = p.city.trim();
  if (!client.sitePostalCode && p.postalCode?.trim()) fill.sitePostalCode = p.postalCode.trim();
  const wanted = targetClientStatus(p.stage);
  if (CLIENT_RANK[client.status] < CLIENT_RANK[wanted]) fill.status = wanted;
  if (Object.keys(fill).length > 0) await ctx.db.patch(client._id, { ...fill, updatedAt: Date.now() });
}

/** The cantiere at this street address for this client: found (same street, same city when both known) or created. Needs an address. */
async function findOrCreateCantiere(ctx: MutationCtx, client: Doc<"clients">, p: PartyInput): Promise<{ cantiere: Doc<"cantieri"> | null; created: boolean }> {
  if (!p.address?.trim()) return { cantiere: null, created: false };
  const street = normText(p.address);
  const city = normText(p.city);
  const sites = await ctx.db.query("cantieri").withIndex("by_client", (x) => x.eq("clientId", client._id)).take(200);
  const found = sites.find((s) => normText(s.address) === street && (!city || !s.city || normText(s.city) === city));
  if (found) return { cantiere: found, created: false };
  const now = Date.now();
  const label = `${client.name} — ${p.address.trim()}${p.city?.trim() ? `, ${p.city.trim()}` : ""}`;
  const id = await ctx.db.insert("cantieri", {
    tenantId: p.tenantId,
    name: label.slice(0, 200),
    address: p.address.trim().slice(0, 300),
    city: (p.city ?? "").trim().slice(0, 120),
    postalCode: (p.postalCode ?? "").trim().slice(0, 20),
    country: (p.country ?? "").slice(0, 2) || undefined,
    clientId: client._id,
    quoteId: p.quoteId,
    status: "preventivo",
    priority: "medium",
    assignedUserIds: p.assignedUserId ? [p.assignedUserId] : [],
    valueCents: p.valueCents,
    createdAt: now,
    updatedAt: now,
  });
  return { cantiere: (await ctx.db.get(id))!, created: true };
}

/**
 * For records that are not quotes (a survey, an inspection): the same find-or-create, so a survey typed with a name and an address
 * leaves the customer card and the site behind. A client / cantiere already chosen is kept and only completed.
 */
export async function linkRecordToCrm(
  ctx: MutationCtx,
  p: Omit<PartyInput, "stage" | "quoteId" | "valueCents"> & { clientId?: Id<"clients">; cantiereId?: Id<"cantieri"> },
): Promise<{ clientId: Id<"clients"> | undefined; cantiereId: Id<"cantieri"> | undefined }> {
  const party: PartyInput = { ...p, stage: "quoted" };
  let client = p.clientId ? await ctx.db.get(p.clientId) : null;
  let cantiere = p.cantiereId ? await ctx.db.get(p.cantiereId) : null;
  if (!client && cantiere?.clientId) client = await ctx.db.get(cantiere.clientId);
  if (!client) client = (await findOrCreateClient(ctx, party)).client;
  if (client) await completeClient(ctx, client, party);
  if (!cantiere && client) cantiere = (await findOrCreateCantiere(ctx, client, party)).cantiere;
  return { clientId: client?._id, cantiereId: cantiere?._id };
}

export interface CrmLinkResult {
  clientId: Id<"clients"> | undefined;
  cantiereId: Id<"cantieri"> | undefined;
  clientCreated: boolean;
  cantiereCreated: boolean;
}

/**
 * Makes sure the quote has its client and its cantiere, creating or finding them, and moves their status with the quote.
 * Explicit choices win: a client / cantiere picked by the installer is never replaced, only completed.
 * `stage` "quoted" = the quote exists; "won" = the customer said yes.
 */
export async function linkQuoteToCrm(
  ctx: MutationCtx,
  args: { quoteId: Id<"quoteRequests">; userId: Id<"users">; stage: "quoted" | "won" },
): Promise<CrmLinkResult> {
  const quote = await ctx.db.get(args.quoteId);
  const none: CrmLinkResult = { clientId: undefined, cantiereId: undefined, clientCreated: false, cantiereCreated: false };
  if (!quote) return none;
  if (isHidden(quote) || quote.status === "spam") return { ...none, clientId: quote.clientId, cantiereId: quote.cantiereId };

  let cantiere = quote.cantiereId ? await ctx.db.get(quote.cantiereId) : null;
  let client = quote.clientId ? await ctx.db.get(quote.clientId) : null;
  if (!client && cantiere?.clientId) client = await ctx.db.get(cantiere.clientId);
  if (client && client.tenantId !== quote.tenantId) client = null;
  if (cantiere && cantiere.tenantId !== quote.tenantId) cantiere = null;
  let clientCreated = false;
  let cantiereCreated = false;

  // ── client + cantiere: found, or created from the quote's data ─────────────────────────────────────────────
  const party: PartyInput = {
    tenantId: quote.tenantId,
    userId: args.userId,
    name: quote.leadName,
    email: quote.leadEmail,
    phone: quote.leadPhone,
    vat: quote.buyerVatId,
    isBusiness: quote.buyerIsBusiness,
    address: quote.customerAddress,
    city: quote.customerCity,
    postalCode: quote.customerPostalCode,
    country: quote.regionCode || quote.buyerCountry,
    source: quote.channel === "widget" ? "widget" : "preventivo",
    stage: args.stage,
    quoteId: quote._id,
    assignedUserId: quote.assignedToUserId,
    valueCents: quote.priceExVatCents,
  };
  if (!client) {
    const r = await findOrCreateClient(ctx, party);
    client = r.client;
    clientCreated = r.created;
  }
  if (client) await completeClient(ctx, client, party);
  if (!cantiere && client) {
    const r = await findOrCreateCantiere(ctx, client, party);
    cantiere = r.cantiere;
    cantiereCreated = r.created;
  }

  // ── write the links on the quote, and the cantiere's side of them ───────────────────────────────────────────
  const clientId = client?._id;
  const cantiereId = cantiere?._id;
  if (clientId !== quote.clientId || cantiereId !== quote.cantiereId) {
    await ctx.db.patch(quote._id, { clientId, cantiereId });
  }
  if (cantiere) {
    const patch: Partial<Doc<"cantieri">> = {};
    if (!cantiere.quoteId) patch.quoteId = quote._id;
    if (!cantiere.clientId && clientId) patch.clientId = clientId;
    if (Object.keys(patch).length > 0) await ctx.db.patch(cantiere._id, { ...patch, updatedAt: Date.now() });
    if (args.stage === "won") await advanceCantiereStatus(ctx, cantiere._id, "confermato");
    await recomputeCantiereValue(ctx, cantiere._id);
  }
  return { clientId, cantiereId, clientCreated, cantiereCreated };
}

/** Moves a cantiere forward to `target`; a site already further along (in posa, collaudo, chiuso…) is never pulled back. */
export async function advanceCantiereStatus(ctx: MutationCtx, cantiereId: Id<"cantieri"> | undefined, target: CantiereStatus): Promise<void> {
  if (!cantiereId) return;
  const c = await ctx.db.get(cantiereId);
  if (!c) return;
  if (CANTIERE_ORDER.indexOf(target) > CANTIERE_ORDER.indexOf(c.status)) {
    await ctx.db.patch(cantiereId, { status: target, updatedAt: Date.now() });
  }
}

/** A cantiere's value is what its live quotes add up to (net of VAT); a cantiere with no quote keeps the value typed by hand. */
export async function recomputeCantiereValue(ctx: MutationCtx, cantiereId: Id<"cantieri"> | undefined): Promise<void> {
  if (!cantiereId) return;
  const c = await ctx.db.get(cantiereId);
  if (!c) return;
  const quotes = await ctx.db.query("quoteRequests").withIndex("by_cantiere", (x) => x.eq("cantiereId", cantiereId)).take(200);
  const live = quotes.filter((q) => q.status !== "lost" && q.status !== "spam");
  if (live.length === 0) return;
  const total = live.reduce((sum, q) => sum + q.priceExVatCents, 0);
  if (total !== c.valueCents) await ctx.db.patch(cantiereId, { valueCents: total, updatedAt: Date.now() });
}

const isOpen = (q: Doc<"quoteRequests">) => OPEN_QUOTE.has(q.status) && q.signedAt === undefined && !isHidden(q);

/** The client card changed: the quotes still open and the supplies not yet delivered show the new name and contacts. */
export async function propagateClientEdit(ctx: MutationCtx, clientId: Id<"clients">): Promise<void> {
  const client = await ctx.db.get(clientId);
  if (!client) return;
  const quotes = await ctx.db.query("quoteRequests").withIndex("by_client", (x) => x.eq("clientId", clientId)).take(200);
  for (const q of quotes) {
    if (!isOpen(q)) continue;
    const patch: Partial<Doc<"quoteRequests">> = { leadName: client.name };
    if (client.email) patch.leadEmail = client.email;
    if (client.phone) patch.leadPhone = client.phone;
    // The site address comes from the cantiere when the quote has one, otherwise from the client's site fields.
    if (!q.cantiereId) {
      if (client.siteAddress) patch.customerAddress = client.siteAddress;
      if (client.siteCity) patch.customerCity = client.siteCity;
      if (client.sitePostalCode) patch.customerPostalCode = client.sitePostalCode;
    }
    await ctx.db.patch(q._id, patch);
  }
  const supplies = await ctx.db.query("supplies").withIndex("by_client", (x) => x.eq("clientId", clientId)).take(200);
  for (const s of supplies) {
    if (s.status !== "delivered" && s.customerName !== client.name) await ctx.db.patch(s._id, { customerName: client.name, updatedAt: Date.now() });
  }
}

/**
 * The cantiere changed (address, or it was handed to another client): its open quotes show the new site, and its quotes and
 * supplies follow the client. Closed/signed quotes keep the address they were signed with.
 */
export async function propagateCantiereEdit(ctx: MutationCtx, cantiereId: Id<"cantieri">): Promise<void> {
  const c = await ctx.db.get(cantiereId);
  if (!c) return;
  const quotes = await ctx.db.query("quoteRequests").withIndex("by_cantiere", (x) => x.eq("cantiereId", cantiereId)).take(200);
  for (const q of quotes) {
    const patch: Partial<Doc<"quoteRequests">> = {};
    if (c.clientId && q.clientId !== c.clientId && q.status !== "lost") patch.clientId = c.clientId;
    if (isOpen(q)) {
      if (c.address) patch.customerAddress = c.address;
      if (c.city) patch.customerCity = c.city;
      if (c.postalCode) patch.customerPostalCode = c.postalCode;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(q._id, patch);
  }
  const supplies = await ctx.db.query("supplies").withIndex("by_cantiere", (x) => x.eq("cantiereId", cantiereId)).take(200);
  const owner = c.clientId ? await ctx.db.get(c.clientId) : null;
  for (const s of supplies) {
    if (s.status === "delivered") continue;
    const patch: Partial<Doc<"supplies">> = {};
    if (c.clientId && s.clientId !== c.clientId) patch.clientId = c.clientId;
    if (owner && s.customerName !== owner.name) patch.customerName = owner.name;
    if (Object.keys(patch).length > 0) await ctx.db.patch(s._id, { ...patch, updatedAt: Date.now() });
  }
}

/** Another cantiere / client was just set on a quote by hand: keep the cantiere's own quote pointer and value in step. */
export async function syncQuoteCantiere(ctx: MutationCtx, quoteId: Id<"quoteRequests">): Promise<void> {
  const q = await ctx.db.get(quoteId);
  if (!q?.cantiereId) return;
  const c = await ctx.db.get(q.cantiereId);
  if (!c) return;
  if (!c.quoteId) await ctx.db.patch(c._id, { quoteId: q._id, updatedAt: Date.now() });
  await recomputeCantiereValue(ctx, c._id);
}
