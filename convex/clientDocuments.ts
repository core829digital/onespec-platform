import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requirePermission, requirePermissionOrNull } from "./lib/rbac";
import { consumeToken } from "./lib/ratelimit";
import { pdfProblem } from "./lib/pdfSniff";
import { cleanText } from "../src/shared/validation";

export const MAX_DOC_BYTES = 15 * 1024 * 1024;
export const MAX_DOCS_PER_CLIENT = 200;
const UPLOADS_PER_HOUR = { tokens: 40, refillMs: 60 * 60 * 1000 };
const KIND = v.union(v.literal("final_quote"), v.literal("other"));
const OUTCOME = v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"));

/** A title: cleaned, no markup characters, bounded. Empty after cleaning → fallback. */
export function safeTitle(raw: string, max: number, fallback: string): string {
  const s = cleanText(raw).replace(/[<>`{}\\|^~"*?]/g, "").slice(0, max).trim();
  return s || fallback;
}

/** A file name: the base name only (no path), no markup characters, bounded. */
export function safeDocName(raw: string, max: number, fallback: string): string {
  return safeTitle(raw.split(/[\\/]/).pop() ?? "", max, fallback).replace(/:/g, "");
}

// ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The documents of a customer (optionally only those of one site); newest first, bounded. */
export const listDocuments = query({
  args: { clientId: v.id("clients"), cantiereId: v.optional(v.id("cantieri")) },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client || !(await requirePermissionOrNull(ctx, client.tenantId, "clients.use"))) return [];
    const q = args.cantiereId
      ? ctx.db.query("clientDocuments").withIndex("by_cantiere", (x) => x.eq("cantiereId", args.cantiereId))
      : ctx.db.query("clientDocuments").withIndex("by_client", (x) => x.eq("clientId", args.clientId));
    const docs = await q.order("desc").take(MAX_DOCS_PER_CLIENT);
    return docs.filter((d) => d.tenantId === client.tenantId && d.clientId === args.clientId);
  },
});

/** A fresh, short-lived download link — only for someone who may see the customer. The link is never stored. */
export const openDocument = mutation({
  args: { documentId: v.id("clientDocuments") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("DOCUMENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, doc.tenantId, "clients.use");
    const url = await ctx.storage.getUrl(doc.storageId);
    if (!url) throw new ConvexError("DOCUMENT_NOT_FOUND");
    await ctx.db.insert("auditLog", { tenantId: doc.tenantId, actorUserId: userId, actorKind: "user", action: "document.open", targetTable: "clientDocuments", targetId: doc._id, createdAt: Date.now() });
    return { url, fileName: doc.fileName };
  },
});

// ── uploading: slot → file → verification by an action that reads the bytes → record ───────────────────────────────────────

export const generateUploadUrl = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new ConvexError("CLIENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, client.tenantId, "clients.use");
    if (!(await consumeToken(ctx, `docUpload:${client.tenantId}:${userId}`, UPLOADS_PER_HOUR))) throw new ConvexError("RATE_LIMITED");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Who is asking, and are the things they link to really theirs? (Runs inside the action's own call, with the caller's identity.) */
export const authorizeUpload = internalQuery({
  args: { clientId: v.id("clients"), cantiereId: v.optional(v.id("cantieri")), quoteId: v.optional(v.id("quoteRequests")), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new ConvexError("CLIENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, client.tenantId, "clients.use");
    if (args.cantiereId) {
      const c = await ctx.db.get(args.cantiereId);
      if (!c || c.tenantId !== client.tenantId || (c.clientId && c.clientId !== client._id)) throw new ConvexError("CANTIERE_NOT_FOUND");
    }
    if (args.quoteId) {
      const q = await ctx.db.get(args.quoteId);
      if (!q || q.tenantId !== client.tenantId) throw new ConvexError("QUOTE_NOT_FOUND");
    }
    const taken = await ctx.db.query("clientDocuments").withIndex("by_storage", (x) => x.eq("storageId", args.storageId)).first();
    if (taken) throw new ConvexError("DOCUMENT_ALREADY_ATTACHED");
    const count = (await ctx.db.query("clientDocuments").withIndex("by_client", (x) => x.eq("clientId", args.clientId)).take(MAX_DOCS_PER_CLIENT + 1)).length;
    if (count > MAX_DOCS_PER_CLIENT) throw new ConvexError("DOCUMENT_LIMIT");
    const meta = await ctx.db.system.get(args.storageId);
    return { tenantId: client.tenantId, userId, size: meta?.size ?? 0, sha256: meta?.sha256 ?? "" };
  },
});

/** Deletes an uploaded file ONLY while no document points at it (a replay must never remove the file of a real document). */
export const discardUnattached = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const used = await ctx.db.query("clientDocuments").withIndex("by_storage", (x) => x.eq("storageId", args.storageId)).first();
    if (!used) await ctx.storage.delete(args.storageId).catch(() => undefined);
    return null;
  },
});

export const registerDocument = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    clientId: v.id("clients"),
    cantiereId: v.optional(v.id("cantieri")),
    quoteId: v.optional(v.id("quoteRequests")),
    kind: KIND,
    title: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
    contentSha256: v.string(),
    amountCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const taken = await ctx.db.query("clientDocuments").withIndex("by_storage", (x) => x.eq("storageId", args.storageId)).first();
    if (taken) throw new ConvexError("DOCUMENT_ALREADY_ATTACHED");
    const now = Date.now();
    const id = await ctx.db.insert("clientDocuments", {
      tenantId: args.tenantId, clientId: args.clientId, cantiereId: args.cantiereId, quoteId: args.quoteId, kind: args.kind,
      title: args.title, fileName: args.fileName, storageId: args.storageId, sizeBytes: args.sizeBytes, contentSha256: args.contentSha256,
      outcome: "pending", amountCents: args.amountCents, uploadedBy: args.userId, createdAt: now,
    });
    await ctx.db.insert("clientActivities", { tenantId: args.tenantId, clientId: args.clientId, userId: args.userId, type: "note", title: args.kind === "final_quote" ? "Preventivo finale caricato" : "Documento caricato", description: args.title, createdAt: now });
    await ctx.db.insert("auditLog", { tenantId: args.tenantId, actorUserId: args.userId, actorKind: "user", action: "document.upload", targetTable: "clientDocuments", targetId: id, meta: { kind: args.kind, sizeBytes: args.sizeBytes }, createdAt: now });
    return id;
  },
});

/**
 * Step 3 of an upload. An ACTION, because only actions can read a stored file: it checks permissions and links first, then reads the bytes
 * and refuses anything that is not a clean PDF (the file is deleted from storage when refused), and only then records it.
 */
export const finalizeUpload = action({
  args: {
    storageId: v.id("_storage"),
    clientId: v.id("clients"),
    cantiereId: v.optional(v.id("cantieri")),
    quoteId: v.optional(v.id("quoteRequests")),
    kind: KIND,
    title: v.string(),
    fileName: v.string(),
    amountCents: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"clientDocuments">> => {
    const refuse = async (code: string): Promise<never> => {
      await ctx.runMutation(internal.clientDocuments.discardUnattached, { storageId: args.storageId });
      throw new ConvexError(code);
    };
    let auth: { tenantId: Id<"tenants">; userId: Id<"users">; size: number; sha256: string };
    try {
      auth = await ctx.runQuery(internal.clientDocuments.authorizeUpload, { clientId: args.clientId, cantiereId: args.cantiereId, quoteId: args.quoteId, storageId: args.storageId });
    } catch (e) {
      // Not allowed (or not found): the freshly uploaded file must not linger as an orphan.
      await ctx.runMutation(internal.clientDocuments.discardUnattached, { storageId: args.storageId });
      throw e;
    }
    if (args.amountCents !== undefined && (!Number.isInteger(args.amountCents) || args.amountCents < 0 || args.amountCents > 100_000_000_000)) return await refuse("INVALID_INPUT");
    if (auth.size > MAX_DOC_BYTES) return await refuse("DOCUMENT_TOO_LARGE");
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new ConvexError("DOCUMENT_NOT_FOUND");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > MAX_DOC_BYTES) return await refuse("DOCUMENT_TOO_LARGE");
    const problem = pdfProblem(bytes);
    if (problem) return await refuse(problem);
    return await ctx.runMutation(internal.clientDocuments.registerDocument, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      clientId: args.clientId,
      cantiereId: args.cantiereId,
      quoteId: args.quoteId,
      kind: args.kind,
      title: safeTitle(args.title, 120, safeDocName(args.fileName, 120, "Preventivo")),
      fileName: safeDocName(args.fileName, 120, "documento.pdf"),
      storageId: args.storageId,
      sizeBytes: bytes.length,
      contentSha256: auth.sha256,
      amountCents: args.amountCents,
    });
  },
});

// ── changing / removing ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const updateDocument = mutation({
  args: { documentId: v.id("clientDocuments"), outcome: v.optional(OUTCOME), title: v.optional(v.string()), cantiereId: v.optional(v.id("cantieri")), quoteId: v.optional(v.id("quoteRequests")) },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("DOCUMENT_NOT_FOUND");
    await requirePermission(ctx, doc.tenantId, "clients.use");
    const patch: Record<string, unknown> = {};
    if (args.outcome) patch.outcome = args.outcome;
    if (args.title !== undefined) patch.title = safeTitle(args.title, 120, doc.title);
    if (args.cantiereId) {
      const c = await ctx.db.get(args.cantiereId);
      if (!c || c.tenantId !== doc.tenantId || (c.clientId && c.clientId !== doc.clientId)) throw new ConvexError("CANTIERE_NOT_FOUND");
      patch.cantiereId = args.cantiereId;
    }
    if (args.quoteId) {
      const q = await ctx.db.get(args.quoteId);
      if (!q || q.tenantId !== doc.tenantId) throw new ConvexError("QUOTE_NOT_FOUND");
      patch.quoteId = args.quoteId;
    }
    await ctx.db.patch(doc._id, patch);
    return null;
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("clientDocuments") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    const { userId } = await requirePermission(ctx, doc.tenantId, "clients.delete");
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(doc._id);
    await ctx.db.insert("auditLog", { tenantId: doc.tenantId, actorUserId: userId, actorKind: "user", action: "document.delete", targetTable: "clientDocuments", targetId: doc._id, createdAt: Date.now() });
    return null;
  },
});
