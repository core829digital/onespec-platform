import { action, internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getUserId, requireMembership, requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { imageFormat, sniffProblem } from "./lib/fileSniff";
import { SUPPORT_LIMITS } from "../src/shared/support";
import { assertCustomerAccess } from "./lib/support";
import { SCAN_VERSION, scanAttachment, type ScanKind } from "./lib/malwareScan";
import { DOWNLOAD_TTL_MS, downloadGrant, sha256Hex, signAttestation, signingSecret, verifyAttestation, type Attestable } from "./lib/signing";
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
    sha256: v.string(),
    scanVersion: v.string(),
    scanVerdict: v.literal("clean"),
    scannedAt: v.number(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const taken = await ctx.db.query("supportAttachments").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).first();
    if (taken) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    return await ctx.db.insert("supportAttachments", {
      tenantId: args.tenantId, uploaderUserId: args.userId, pending: true, storageId: args.storageId, fileName: args.fileName,
      contentType: args.contentType, sizeBytes: args.sizeBytes, sha256: args.sha256, scanVersion: args.scanVersion,
      scanVerdict: args.scanVerdict, scannedAt: args.scannedAt, signature: args.signature, createdAt: Date.now(),
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
    // Anything unexpected (a runtime limit, a library failure) must not reach the browser as a bare "Server Error": the file is discarded,
    // the failing step is written to the function log (Convex dashboard → Logs) and the person gets a clear, retryable message.
    let stage = "authorize";
    try {
      let auth: { userId: Id<"users">; size: number };
      try {
        auth = await ctx.runQuery(internal.supportFiles.authorizeUpload, { tenantId: args.tenantId, storageId: args.storageId });
      } catch (e) {
        await ctx.runMutation(internal.supportFiles.discardUnattached, { storageId: args.storageId });
        throw e;
      }
      if (auth.size > SUPPORT_LIMITS.attachmentMaxBytes) return await refuse("FILE_TOO_LARGE");
      stage = "read";
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new ConvexError("ATTACHMENT_NOT_FOUND");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length > SUPPORT_LIMITS.attachmentMaxBytes) return await refuse("FILE_TOO_LARGE");
      stage = "sniff";
      const problem = sniffProblem(bytes, "document");
      if (problem) return await refuse(problem);
      const format = imageFormat(bytes);
      // HEIC passes the generic check but browsers cannot show it: not accepted here.
      const contentType = format === null ? "application/pdf" : format === "heic" ? null : MIME[format];
      if (!contentType) return await refuse("UNSUPPORTED_FILE_TYPE");
      // Antimalware screening of the real bytes (fails closed). A hit deletes the file, is logged and alerts the team.
      const kind: ScanKind = contentType === "application/pdf" ? "pdf" : (format as "png" | "jpeg" | "webp");
      stage = "scan";
      const scan = scanAttachment(bytes, kind);
      if (scan.verdict !== "clean") {
        await ctx.runMutation(internal.supportFiles.reportBlocked, { userId: auth.userId, tenantId: args.tenantId, findings: scan.findings, verdict: scan.verdict });
        return await refuse("MALWARE_DETECTED");
      }
      stage = "sign";
      const fileName = safeDocName(args.fileName, 100, contentType === "application/pdf" ? "documento.pdf" : "immagine");
      const sha256 = await sha256Hex(bytes);
      const scannedAt = Date.now();
      const attest: Attestable = { storageId: args.storageId, sha256, contentType, sizeBytes: bytes.length, scanVersion: SCAN_VERSION, scanVerdict: "clean", scannedAt, uploaderUserId: auth.userId };
      const signature = await signAttestation(attest);
      stage = "register";
      const attachmentId: Id<"supportAttachments"> = await ctx.runMutation(internal.supportFiles.registerPending, {
        tenantId: args.tenantId, userId: auth.userId, storageId: args.storageId, fileName, contentType, sizeBytes: bytes.length,
        sha256, scanVersion: SCAN_VERSION, scanVerdict: "clean", scannedAt, signature,
      });
      return { attachmentId, fileName, contentType, sizeBytes: bytes.length };
    } catch (e) {
      if (e instanceof ConvexError) throw e;
      console.error(`[finalizeUpload] stage=${stage} ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      await ctx.runMutation(internal.supportFiles.discardUnattached, { storageId: args.storageId }).catch(() => undefined);
      throw new ConvexError({ code: "UPLOAD_FAILED", stage });
    }
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

/** A blocked upload: audit trail (no file content) and an in-app alert to every platform admin. */
export const reportBlocked = internalMutation({
  args: { userId: v.id("users"), tenantId: v.optional(v.id("tenants")), findings: v.array(v.string()), verdict: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("auditLog", { tenantId: args.tenantId, actorUserId: args.userId, actorKind: "user", action: "support.attachment.blocked", targetTable: "supportAttachments", meta: { findings: args.findings.join(","), verdict: args.verdict, scanVersion: SCAN_VERSION }, createdAt: now });
    if (args.tenantId) {
      const admins = await ctx.db.query("users").withIndex("by_isPlatformAdmin", (q) => q.eq("isPlatformAdmin", true)).take(50);
      for (const a of admins) {
        await ctx.db.insert("notifications", { tenantId: args.tenantId, userId: a._id, type: "system", title: "Allegato bloccato dall'antimalware", data: { kind: "support.blocked", findings: args.findings.join(",") }, href: "/app/admin", entityTable: "supportAttachments" });
      }
    }
    return null;
  },
});

/** Builds the signed, 60-second download address of an attachment for one person. */
async function downloadUrl(attachmentId: Id<"supportAttachments">, userId: Id<"users">): Promise<string> {
  signingSecret(); // fail closed when signing is not configured
  const base = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
  const exp = Date.now() + DOWNLOAD_TTL_MS;
  const sig = await downloadGrant(attachmentId, userId, exp);
  return `${base}/api/support/file?id=${attachmentId}&u=${userId}&exp=${exp}&sig=${sig}`;
}

async function audited(ctx: MutationCtx, tenantId: Id<"tenants"> | undefined, userId: Id<"users">, kind: "user" | "admin", id: Id<"supportAttachments">) {
  await ctx.db.insert("auditLog", { tenantId, actorUserId: userId, actorKind: kind, action: "support.attachment.open", targetTable: "supportAttachments", targetId: id, createdAt: Date.now() });
}

/** A signed download link for the customer side. Same visibility rule as the ticket itself. */
export const open = mutation({
  args: { attachmentId: v.id("supportAttachments") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const a = await ctx.db.get(args.attachmentId);
    const ticket = a && !a.pending && a.ticketId ? await ctx.db.get(a.ticketId) : null;
    if (!a || !ticket) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await assertCustomerAccess(ctx, ticket, userId);
    const url = await downloadUrl(a._id, userId);
    await audited(ctx, ticket.tenantId, userId, "user", a._id);
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
    const url = await downloadUrl(a._id, adminId);
    await audited(ctx, a.tenantId, adminId, "admin", a._id);
    return { url, fileName: a.fileName };
  },
});

/** For the HTTP download endpoint: the attachment record, only if it is sent (not pending). */
export const getForDownload = internalQuery({
  args: { id: v.id("supportAttachments") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.id);
    return a && !a.pending ? a : null;
  },
});

/** Stores the attestation of a file that was uploaded before attestations existed, after the download endpoint scanned it. */
export const attestLegacy = internalMutation({
  args: { id: v.id("supportAttachments"), sha256: v.string(), scanVersion: v.string(), scannedAt: v.number(), signature: v.string() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.id);
    if (!a || a.signature) return null;
    await ctx.db.patch(a._id, { sha256: args.sha256, scanVersion: args.scanVersion, scanVerdict: "clean", scannedAt: args.scannedAt, signature: args.signature });
    return null;
  },
});

/** A file that fails its rescan is removed (record and bytes) and the event is logged. */
export const purgeInfected = internalMutation({
  args: { id: v.id("supportAttachments"), findings: v.array(v.string()) },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.id);
    if (!a) return null;
    await ctx.storage.delete(a.storageId).catch(() => undefined);
    await ctx.db.delete(a._id);
    await ctx.db.insert("auditLog", { tenantId: a.tenantId, actorKind: "system", action: "support.attachment.purged_infected", targetTable: "supportAttachments", targetId: a._id, meta: { findings: args.findings.join(","), scanVersion: SCAN_VERSION }, createdAt: Date.now() });
    return null;
  },
});

/** Admin-only authorisation for the integrity check (runs with the caller's identity inside the action). */
export const authorizeStaff = internalQuery({
  args: {},
  handler: async (ctx) => await requirePlatformAdmin(ctx),
});

/**
 * "Is everything still as we attested?" — recomputes the hash of the stored bytes, verifies the record's signature and scans the file
 * again with the current scanner. For audits and for answering "has this file been tampered with?".
 */
export const verifyIntegrity = action({
  args: { attachmentId: v.id("supportAttachments") },
  handler: async (ctx, args): Promise<{ ok: boolean; signed: boolean; hashMatches: boolean | null; signatureValid: boolean | null; rescanClean: boolean | null; scanVersion: string | null; findings: string[] }> => {
    await ctx.runQuery(internal.supportFiles.authorizeStaff, {});
    const a = await ctx.runQuery(internal.supportFiles.getForDownload, { id: args.attachmentId });
    if (!a) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    const blob = await ctx.storage.get(a.storageId);
    if (!blob) return { ok: false, signed: !!a.signature, hashMatches: null, signatureValid: null, rescanClean: null, scanVersion: a.scanVersion ?? null, findings: ["FILE_MISSING"] };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await sha256Hex(bytes);
    const kind: ScanKind = a.contentType === "application/pdf" ? "pdf" : a.contentType === "image/png" ? "png" : a.contentType === "image/jpeg" ? "jpeg" : "webp";
    const scan = scanAttachment(bytes, kind);
    const signed = !!(a.signature && a.sha256 && a.scanVersion && a.scanVerdict && a.scannedAt);
    const hashMatches = a.sha256 ? hash === a.sha256 : null;
    const signatureValid = signed
      ? await verifyAttestation({ storageId: a.storageId, sha256: a.sha256!, contentType: a.contentType, sizeBytes: a.sizeBytes, scanVersion: a.scanVersion!, scanVerdict: a.scanVerdict!, scannedAt: a.scannedAt!, uploaderUserId: a.uploaderUserId }, a.signature!)
      : null;
    const rescanClean = scan.verdict === "clean";
    return { ok: signed && hashMatches === true && signatureValid === true && rescanClean, signed, hashMatches, signatureValid, rescanClean, scanVersion: a.scanVersion ?? null, findings: scan.findings };
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
