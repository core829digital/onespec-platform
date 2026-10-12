import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getUserId, requireMembership, requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { imageFormat, sniffProblem } from "./lib/fileSniff";
import { SUPPORT_LIMITS } from "../src/shared/support";
import { assertCustomerAccess } from "./lib/support";
import { safeDocName } from "./clientDocuments";

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;

/** Who is uploading: a customer (member of `tenantId`) or, with no tenant, a platform admin. */
async function uploader(ctx: Parameters<typeof requireMembership>[0], tenantId: Id<"tenants"> | undefined): Promise<Id<"users">> {
  return tenantId ? (await requireMembership(ctx, tenantId)).userId : await requirePlatformAdmin(ctx);
}

/** Step 1: an upload slot, only at a sane rate and while few unsent files are waiting. */
export const generateUploadUrl = mutation({
  args: { tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, args) => {
    const userId = await uploader(ctx, args.tenantId);
    if (!(await consumeToken(ctx, `support:upload:${userId}`, { tokens: SUPPORT_LIMITS.uploadsPerHour, refillMs: 60 * 60 * 1000 }))) throw new ConvexError("RATE_LIMITED");
    const pending = await ctx.db.query("supportAttachments").withIndex("by_uploaderUserId_and_pending", (q) => q.eq("uploaderUserId", userId).eq("pending", true)).take(SUPPORT_LIMITS.pendingAttachmentsPerUser);
    if (pending.length >= SUPPORT_LIMITS.pendingAttachmentsPerUser) throw new ConvexError("TOO_MANY_ATTACHMENTS");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Runs with the caller's identity inside the action: may this person upload, and is the file free? */
export const authorizeUpload = internalQuery({
  args: { tenantId: v.optional(v.id("tenants")), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await uploader(ctx, args.tenantId);
    const taken = await ctx.db.query("supportAttachments").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).first();
    if (taken) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    const meta = await ctx.db.system.get(args.storageId);
    return { userId, size: meta?.size ?? 0 };
  },
});

/** Deletes an uploaded file only while no attachment points at it. */
export const discardUnattached = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const used = await ctx.db.query("supportAttachments").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).first();
    if (!used) await ctx.storage.delete(args.storageId).catch(() => undefined);
    return null;
  },
});

export const registerPending = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.union(v.literal("image/png"), v.literal("image/jpeg"), v.literal("image/webp"), v.literal("application/pdf")),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const taken = await ctx.db.query("supportAttachments").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).first();
    if (taken) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    return await ctx.db.insert("supportAttachments", {
      tenantId: args.tenantId, uploaderUserId: args.userId, pending: true, storageId: args.storageId, fileName: args.fileName,
      contentType: args.contentType, sizeBytes: args.sizeBytes, createdAt: Date.now(),
    });
  },
});

/**
 * Step 2 (an ACTION, because only actions can read a stored file): checks who is uploading, then reads the bytes and accepts only a real
 * PNG / JPEG / WebP picture or a clean PDF. Anything else is deleted from storage. The type is taken from the bytes, never from the browser.
 */
export const finalizeUpload = action({
  args: { storageId: v.id("_storage"), tenantId: v.optional(v.id("tenants")), fileName: v.string() },
  handler: async (ctx, args): Promise<{ attachmentId: Id<"supportAttachments">; fileName: string; contentType: string; sizeBytes: number }> => {
    const refuse = async (code: string): Promise<never> => {
      await ctx.runMutation(internal.supportFiles.discardUnattached, { storageId: args.storageId });
      throw new ConvexError(code);
    };
    let auth: { userId: Id<"users">; size: number };
    try {
      auth = await ctx.runQuery(internal.supportFiles.authorizeUpload, { tenantId: args.tenantId, storageId: args.storageId });
    } catch (e) {
      await ctx.runMutation(internal.supportFiles.discardUnattached, { storageId: args.storageId });
      throw e;
    }
    if (auth.size > SUPPORT_LIMITS.attachmentMaxBytes) return await refuse("FILE_TOO_LARGE");
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > SUPPORT_LIMITS.attachmentMaxBytes) return await refuse("FILE_TOO_LARGE");
    const problem = sniffProblem(bytes, "document");
    if (problem) return await refuse(problem);
    const format = imageFormat(bytes);
    // HEIC passes the generic check but browsers cannot show it: not accepted here.
    const contentType = format === null ? "application/pdf" : format === "heic" ? null : MIME[format];
    if (!contentType) return await refuse("UNSUPPORTED_FILE_TYPE");
    const fileName = safeDocName(args.fileName, 100, contentType === "application/pdf" ? "documento.pdf" : "immagine");
    const attachmentId: Id<"supportAttachments"> = await ctx.runMutation(internal.supportFiles.registerPending, {
      tenantId: args.tenantId, userId: auth.userId, storageId: args.storageId, fileName, contentType, sizeBytes: bytes.length,
    });
    return { attachmentId, fileName, contentType, sizeBytes: bytes.length };
  },
});

/** The uploader takes back a file they have not sent yet. */
export const discardPending = mutation({
  args: { attachmentId: v.id("supportAttachments") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const a = await ctx.db.get(args.attachmentId);
    if (!a || !a.pending || a.uploaderUserId !== userId) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await ctx.storage.delete(a.storageId).catch(() => undefined);
    await ctx.db.delete(a._id);
  },
});

/** A fresh, short-lived link for the customer side. Same visibility rule as the ticket itself. */
export const open = mutation({
  args: { attachmentId: v.id("supportAttachments") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const a = await ctx.db.get(args.attachmentId);
    const ticket = a && !a.pending && a.ticketId ? await ctx.db.get(a.ticketId) : null;
    if (!a || !ticket) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await assertCustomerAccess(ctx, ticket, userId);
    const url = await ctx.storage.getUrl(a.storageId);
    if (!url) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await ctx.db.insert("auditLog", { tenantId: ticket.tenantId, actorUserId: userId, actorKind: "user", action: "support.attachment.open", targetTable: "supportAttachments", targetId: a._id, createdAt: Date.now() });
    return { url, fileName: a.fileName };
  },
});

/** Same for platform admins. */
export const openAsStaff = mutation({
  args: { attachmentId: v.id("supportAttachments") },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const a = await ctx.db.get(args.attachmentId);
    if (!a || a.pending) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    const url = await ctx.storage.getUrl(a.storageId);
    if (!url) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await ctx.db.insert("auditLog", { tenantId: a.tenantId, actorUserId: adminId, actorKind: "admin", action: "support.attachment.open", targetTable: "supportAttachments", targetId: a._id, createdAt: Date.now() });
    return { url, fileName: a.fileName };
  },
});

/** Cron: files uploaded but never sent are removed after 24 h. */
export const purgePending = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 3_600_000;
    const rows = await ctx.db.query("supportAttachments").withIndex("by_pending_and_createdAt", (q) => q.eq("pending", true).lt("createdAt", cutoff)).take(100);
    for (const a of rows) {
      await ctx.storage.delete(a.storageId).catch(() => undefined);
      await ctx.db.delete(a._id);
    }
    return rows.length;
  },
});
