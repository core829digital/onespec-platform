import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission, requirePermissionOrNull } from "./lib/rbac";
import { assertActiveMembers } from "./lib/links";
import { isCountryCode, type CountryCode } from "../src/shared/validation";
import { LEAD_FIELDS, leadDedupeKeys, leadSearchText, normalizeLeadRow, type LeadData, type LeadField, type RawLeadRow } from "../src/shared/leads";

/** Limits of one import. They protect the workspace (and the bill) from a pasted-by-mistake file as much as from an attacker. */
export const MAX_IMPORT_ROWS = 20_000;
export const MAX_BATCH_ROWS = 200;
const MAX_CELL_CHARS = 5_000;
const MAX_IMPORTS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS = v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("discarded"));
const rowValidator = v.object({
  ...Object.fromEntries(LEAD_FIELDS.map((f) => [f, v.optional(v.string())])) as Record<LeadField, ReturnType<typeof v.optional<ReturnType<typeof v.string>>>>,
  extra: v.optional(v.record(v.string(), v.string())),
});

const defaultCountry = (tenant: Doc<"tenants">): CountryCode => (isCountryCode(tenant.country) ? tenant.country : "IT");

/** The cleaned file name: base name only, no path, no control characters, at most 120 characters. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim().slice(0, 120);
  return cleaned || "import";
}

/** True when the row's cells are within bounds (a cell of megabytes is refused before any work is done on it). */
function withinBounds(row: RawLeadRow): boolean {
  for (const [k, val] of Object.entries(row)) {
    if (k === "extra") {
      const entries = Object.entries(val as Record<string, string>);
      if (entries.length > 40 || entries.some(([a, b]) => a.length > 200 || b.length > MAX_CELL_CHARS)) return false;
    } else if (typeof val === "string" && val.length > MAX_CELL_CHARS) return false;
  }
  return true;
}

async function insertLead(ctx: MutationCtx, tenantId: Id<"tenants">, userId: Id<"users">, lead: LeadData, meta: { importId?: Id<"leadImports">; rowNumber?: number }): Promise<Id<"leads">> {
  const now = Date.now();
  return await ctx.db.insert("leads", {
    tenantId,
    ...lead,
    status: "new",
    importId: meta.importId,
    rowNumber: meta.rowNumber,
    searchText: leadSearchText(lead),
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });
}

/** Does this tenant already have a lead with the same e-mail or phone? (Each key is one indexed read.) */
async function findDuplicate(ctx: MutationCtx, tenantId: Id<"tenants">, lead: Pick<LeadData, "email" | "phone" | "phone2">): Promise<Doc<"leads"> | null> {
  if (lead.email) {
    const hit = await ctx.db.query("leads").withIndex("by_tenant_email", (q) => q.eq("tenantId", tenantId).eq("email", lead.email)).first();
    if (hit) return hit;
  }
  for (const phone of [lead.phone, lead.phone2]) {
    if (!phone) continue;
    const hit = await ctx.db.query("leads").withIndex("by_tenant_phone", (q) => q.eq("tenantId", tenantId).eq("phone", phone)).first();
    if (hit) return hit;
  }
  return null;
}

// ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const listLeads = query({
  args: { tenantId: v.id("tenants"), status: v.optional(STATUS), search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const allowed = await requirePermissionOrNull(ctx, args.tenantId, "clients.use");
    const empty = { page: [], isDone: true, continueCursor: "" };
    if (!allowed) return empty;
    const term = (args.search ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
    if (term) {
      return await ctx.db
        .query("leads")
        .withSearchIndex("search_text", (q) => {
          const base = q.search("searchText", term).eq("tenantId", args.tenantId);
          return args.status ? base.eq("status", args.status) : base;
        })
        .paginate(args.paginationOpts);
    }
    const status = args.status;
    const query = status
      ? ctx.db.query("leads").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", status))
      : ctx.db.query("leads").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
    return await query.order("desc").paginate(args.paginationOpts);
  },
});

/** Counts per status, each capped (a count past the cap shows as "2000+"): no unbounded read. */
export const leadStats = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const allowed = await requirePermissionOrNull(ctx, args.tenantId, "clients.use");
    const CAP = 2000;
    const counts = { new: 0, contacted: 0, qualified: 0, converted: 0, discarded: 0 };
    if (!allowed) return { counts, capped: false };
    let capped = false;
    for (const status of Object.keys(counts) as Array<keyof typeof counts>) {
      const rows = await ctx.db.query("leads").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", status)).take(CAP + 1);
      counts[status] = Math.min(rows.length, CAP);
      if (rows.length > CAP) capped = true;
    }
    return { counts, capped };
  },
});

export const listImports = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const allowed = await requirePermissionOrNull(ctx, args.tenantId, "clients.use");
    if (!allowed) return [];
    return await ctx.db.query("leadImports").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(20);
  },
});

/** One lead with the customer and site it is tied to (for the detail row). */
export const getLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return null;
    if (!(await requirePermissionOrNull(ctx, lead.tenantId, "clients.use"))) return null;
    const client = lead.clientId ? await ctx.db.get(lead.clientId) : null;
    const cantiere = lead.cantiereId ? await ctx.db.get(lead.cantiereId) : null;
    return { lead, client: client && client.tenantId === lead.tenantId ? { _id: client._id, name: client.name } : null, cantiere: cantiere && cantiere.tenantId === lead.tenantId ? { _id: cantiere._id, name: cantiere.name } : null };
  },
});

// ── importing ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const startImport = mutation({
  args: {
    tenantId: v.id("tenants"),
    fileName: v.string(),
    fileKind: v.union(v.literal("xlsx"), v.literal("csv"), v.literal("docx")),
    totalRows: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");
    if (!Number.isInteger(args.totalRows) || args.totalRows < 1 || args.totalRows > MAX_IMPORT_ROWS) throw new ConvexError("IMPORT_TOO_MANY_ROWS");
    const recent = await ctx.db.query("leadImports").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(MAX_IMPORTS_PER_DAY);
    const now = Date.now();
    if (recent.length >= MAX_IMPORTS_PER_DAY && now - recent[MAX_IMPORTS_PER_DAY - 1].createdAt < DAY_MS) throw new ConvexError("IMPORT_RATE_LIMITED");
    return await ctx.db.insert("leadImports", {
      tenantId: args.tenantId,
      fileName: safeFileName(args.fileName),
      fileKind: args.fileKind,
      totalRows: args.totalRows,
      inserted: 0,
      duplicates: 0,
      invalid: 0,
      warnings: 0,
      status: "running",
      createdBy: userId,
      createdAt: now,
    });
  },
});

export const importLeadBatch = mutation({
  args: {
    tenantId: v.id("tenants"),
    importId: v.id("leadImports"),
    /** Row number (1-based, in the file) of the first row of this batch — for the error report. */
    startRow: v.number(),
    rows: v.array(rowValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");
    const run = await ctx.db.get(args.importId);
    if (!run || run.tenantId !== args.tenantId) throw new ConvexError("IMPORT_NOT_FOUND");
    if (run.status !== "running") throw new ConvexError("IMPORT_CLOSED");
    if (run.createdBy !== userId) throw new ConvexError("INSUFFICIENT_ROLE");
    if (args.rows.length === 0 || args.rows.length > MAX_BATCH_ROWS) throw new ConvexError("INVALID_INPUT");
    if (!Number.isInteger(args.startRow) || args.startRow < 1 || args.startRow > MAX_IMPORT_ROWS + 1) throw new ConvexError("INVALID_INPUT");
    if (run.inserted + run.duplicates + run.invalid + args.rows.length > run.totalRows) throw new ConvexError("IMPORT_TOO_MANY_ROWS");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const country = defaultCountry(tenant);

    let inserted = 0;
    let duplicates = 0;
    let warnings = 0;
    const invalid: Array<{ row: number; code: string }> = [];
    const seen = new Set<string>(); // keys already taken in this very batch (inserts of this transaction are also visible to the index reads, but this saves the reads)
    for (let i = 0; i < args.rows.length; i++) {
      const rowNumber = args.startRow + i;
      const raw = args.rows[i] as RawLeadRow;
      if (!withinBounds(raw)) { invalid.push({ row: rowNumber, code: "TOO_LONG" }); continue; }
      const checked = normalizeLeadRow(raw, country);
      if (!checked.ok) { invalid.push({ row: rowNumber, code: checked.code }); continue; }
      const keys = leadDedupeKeys(checked.lead);
      if (keys.some((k) => seen.has(k)) || (await findDuplicate(ctx, args.tenantId, checked.lead))) { duplicates++; continue; }
      keys.forEach((k) => seen.add(k));
      await insertLead(ctx, args.tenantId, userId, checked.lead, { importId: args.importId, rowNumber });
      inserted++;
      warnings += checked.warnings.length;
    }
    await ctx.db.patch(args.importId, {
      inserted: run.inserted + inserted,
      duplicates: run.duplicates + duplicates,
      invalid: run.invalid + invalid.length,
      warnings: run.warnings + warnings,
    });
    // Only the first 50 problems travel back to the browser; the counters carry the rest.
    return { inserted, duplicates, warnings, invalid: invalid.slice(0, 50), invalidCount: invalid.length };
  },
});

export const finishImport = mutation({
  args: { importId: v.id("leadImports") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.importId);
    if (!run) throw new ConvexError("IMPORT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, run.tenantId, "clients.use");
    if (run.status === "running") {
      await ctx.db.patch(args.importId, { status: "done", finishedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        tenantId: run.tenantId, actorUserId: userId, actorKind: "user", action: "leads.import",
        targetTable: "leadImports", targetId: args.importId,
        meta: { fileName: run.fileName, inserted: run.inserted, duplicates: run.duplicates, invalid: run.invalid }, createdAt: Date.now(),
      });
    }
    return { inserted: run.inserted, duplicates: run.duplicates, invalid: run.invalid, warnings: run.warnings };
  },
});

/** Removes the leads of one import (those already turned into customers stay). Works in blocks, so a large import is undone in the background. */
export const undoImport = mutation({
  args: { importId: v.id("leadImports") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.importId);
    if (!run) throw new ConvexError("IMPORT_NOT_FOUND");
    await requirePermission(ctx, run.tenantId, "clients.delete");
    await ctx.db.patch(args.importId, { status: "cancelled", finishedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.leads.purgeImportBlock, { importId: args.importId });
    return null;
  },
});

export const purgeImportBlock = internalMutation({
  args: { importId: v.id("leadImports") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("leads")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .filter((q) => q.and(q.eq(q.field("clientId"), undefined), q.eq(q.field("cantiereId"), undefined)))
      .take(300);
    for (const lead of rows) await ctx.db.delete(lead._id);
    if (rows.length === 300) await ctx.scheduler.runAfter(0, internal.leads.purgeImportBlock, args);
    return null;
  },
});

// ── single leads ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const manualFields = Object.fromEntries(LEAD_FIELDS.map((f) => [f, v.optional(v.string())])) as Record<LeadField, ReturnType<typeof v.optional<ReturnType<typeof v.string>>>>;

export const createLead = mutation({
  args: { tenantId: v.id("tenants"), ...manualFields },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const { tenantId, ...raw } = args;
    void tenantId;
    if (!withinBounds(raw as RawLeadRow)) throw new ConvexError("INVALID_INPUT");
    const checked = normalizeLeadRow(raw as RawLeadRow, defaultCountry(tenant));
    if (!checked.ok) throw new ConvexError(`LEAD_${checked.code}`);
    if (await findDuplicate(ctx, args.tenantId, checked.lead)) throw new ConvexError("LEAD_DUPLICATE");
    const id = await insertLead(ctx, args.tenantId, userId, checked.lead, {});
    return { leadId: id, warnings: checked.warnings };
  },
});

export const updateLead = mutation({
  args: { leadId: v.id("leads"), status: v.optional(STATUS), notes: v.optional(v.string()), assignedNote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new ConvexError("LEAD_NOT_FOUND");
    await requirePermission(ctx, lead.tenantId, "clients.use");
    const patch: Partial<Doc<"leads">> = { updatedAt: Date.now() };
    if (args.status !== undefined) {
      if (lead.status === "converted" && args.status !== "converted") throw new ConvexError("LEAD_ALREADY_CONVERTED");
      patch.status = args.status;
    }
    if (args.notes !== undefined) {
      const res = normalizeLeadRow({ name: lead.name, notes: args.notes }, "IT");
      if (!res.ok) throw new ConvexError(`LEAD_${res.code}`);
      patch.notes = res.lead.notes;
    }
    await ctx.db.patch(args.leadId, patch);
    return null;
  },
});

export const deleteLeads = mutation({
  args: { tenantId: v.id("tenants"), leadIds: v.array(v.id("leads")) },
  handler: async (ctx, args) => {
    if (args.leadIds.length === 0 || args.leadIds.length > 100) throw new ConvexError("INVALID_INPUT");
    // One lead: any member of the sales area. Many at once: an admin (a stray "select all" must not wipe a list).
    const { userId } = await requirePermission(ctx, args.tenantId, args.leadIds.length > 10 ? "clients.delete" : "clients.use");
    let deleted = 0;
    for (const id of new Set(args.leadIds)) {
      const lead = await ctx.db.get(id);
      if (!lead || lead.tenantId !== args.tenantId) continue; // another workspace's id is simply not found
      await ctx.db.delete(id);
      deleted++;
    }
    await ctx.db.insert("auditLog", { tenantId: args.tenantId, actorUserId: userId, actorKind: "user", action: "leads.delete", meta: { count: deleted }, createdAt: Date.now() });
    return { deleted };
  },
});

// ── from lead to customer / site ─────────────────────────────────────────────────────────────────────────────────────────────

/** The customer for a lead: the one it already has, one with the same e-mail, or a new one. Marks the lead as converted. */
async function ensureClient(ctx: MutationCtx, lead: Doc<"leads">, userId: Id<"users">, assignedToUserId?: Id<"users">): Promise<{ clientId: Id<"clients">; created: boolean }> {
  if (lead.clientId) {
    const existing = await ctx.db.get(lead.clientId);
    if (existing && existing.tenantId === lead.tenantId) return { clientId: lead.clientId, created: false };
  }
  const now = Date.now();
  if (lead.email) {
    const same = await ctx.db.query("clients").withIndex("by_tenant_email", (q) => q.eq("tenantId", lead.tenantId).eq("email", lead.email)).first();
    if (same) {
      await ctx.db.patch(lead._id, { clientId: same._id, status: "converted", updatedAt: now });
      return { clientId: same._id, created: false };
    }
  }
  if (assignedToUserId) await assertActiveMembers(ctx, lead.tenantId, [assignedToUserId]);
  const extraText = lead.extra ? Object.entries(lead.extra).map(([k, val]) => `${k}: ${val}`).join("\n") : "";
  const notes = [lead.notes, extraText].filter(Boolean).join("\n\n").slice(0, 10_000) || undefined;
  const clientId = await ctx.db.insert("clients", {
    tenantId: lead.tenantId,
    name: lead.name,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone ?? lead.phone2,
    billingAddress: lead.address,
    billingCity: lead.city,
    billingPostalCode: lead.postalCode,
    billingCountry: lead.country,
    vatNumber: lead.vatNumber,
    fiscalCode: lead.fiscalCode,
    type: lead.company || lead.vatNumber ? "company" : "private",
    tags: lead.tags,
    source: lead.source ?? "lead_import",
    notes,
    assignedToUserId,
    status: "prospect",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("clientActivities", { tenantId: lead.tenantId, clientId, userId, type: "note", title: "Cliente creato da lead", description: `Da lead «${lead.name}»`, createdAt: now });
  await ctx.db.insert("auditLog", { tenantId: lead.tenantId, actorUserId: userId, actorKind: "user", action: "leads.convert", targetTable: "clients", targetId: clientId, meta: { leadId: lead._id }, createdAt: now });
  await ctx.db.patch(lead._id, { clientId, status: "converted", updatedAt: now });
  return { clientId, created: true };
}

export const convertLeadToClient = mutation({
  args: { leadId: v.id("leads"), assignedToUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new ConvexError("LEAD_NOT_FOUND");
    const { userId } = await requirePermission(ctx, lead.tenantId, "clients.use");
    return await ensureClient(ctx, lead, userId, args.assignedToUserId);
  },
});

export const convertLeadsToClients = mutation({
  args: { tenantId: v.id("tenants"), leadIds: v.array(v.id("leads")) },
  handler: async (ctx, args) => {
    if (args.leadIds.length === 0 || args.leadIds.length > 50) throw new ConvexError("INVALID_INPUT");
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");
    let created = 0;
    let linked = 0;
    for (const id of new Set(args.leadIds)) {
      const lead = await ctx.db.get(id);
      if (!lead || lead.tenantId !== args.tenantId) continue;
      const r = await ensureClient(ctx, lead, userId);
      if (r.created) created++; else linked++;
    }
    return { created, linked };
  },
});

/** Ties a lead to a building site: an existing one, or a new one named after the lead. The lead becomes a customer first when it is not yet. */
export const linkLeadToCantiere = mutation({
  args: { leadId: v.id("leads"), cantiereId: v.optional(v.id("cantieri")), newCantiereName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new ConvexError("LEAD_NOT_FOUND");
    const { userId } = await requirePermission(ctx, lead.tenantId, "clients.use");
    await requirePermission(ctx, lead.tenantId, "cantieri.use");
    if ((args.cantiereId === undefined) === (args.newCantiereName === undefined)) throw new ConvexError("INVALID_INPUT");
    const { clientId } = await ensureClient(ctx, lead, userId);
    const now = Date.now();
    let cantiereId: Id<"cantieri">;
    if (args.cantiereId) {
      const cantiere = await ctx.db.get(args.cantiereId);
      if (!cantiere || cantiere.tenantId !== lead.tenantId) throw new ConvexError("CANTIERE_NOT_FOUND");
      if (cantiere.clientId && cantiere.clientId !== clientId) throw new ConvexError("CANTIERE_ALREADY_LINKED");
      if (!cantiere.clientId) await ctx.db.patch(cantiere._id, { clientId, updatedAt: now });
      cantiereId = cantiere._id;
    } else {
      const name = (args.newCantiereName ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f<>`{}\\|^~]/g, "").trim().slice(0, 200);
      if (!name) throw new ConvexError("INVALID_NAME");
      cantiereId = await ctx.db.insert("cantieri", {
        tenantId: lead.tenantId,
        name,
        address: lead.address ?? "—",
        city: lead.city ?? "—",
        postalCode: lead.postalCode ?? "—",
        country: lead.country,
        clientId,
        status: "preventivo",
        priority: "medium",
        assignedUserIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(lead._id, { cantiereId, updatedAt: now });
    await ctx.db.insert("auditLog", { tenantId: lead.tenantId, actorUserId: userId, actorKind: "user", action: "leads.link_cantiere", targetTable: "cantieri", targetId: cantiereId, meta: { leadId: lead._id, clientId }, createdAt: now });
    return { clientId, cantiereId };
  },
});
