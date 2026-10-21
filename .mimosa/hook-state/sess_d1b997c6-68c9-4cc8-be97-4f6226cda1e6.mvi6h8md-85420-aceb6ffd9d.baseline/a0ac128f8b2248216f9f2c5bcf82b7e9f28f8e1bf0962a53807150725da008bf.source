import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { sniffProblem } from "./lib/fileSniff";

const KIND = v.union(v.literal("image"), v.literal("document"), v.literal("logo"), v.literal("brandLogo"));

/**
 * Second look at an uploaded file, after it was attached: the bytes must be what the type claimed (a real JPEG/PNG/WebP/HEIC, a complete
 * PDF without scripts, no absurd pixel count). A file that fails is deleted; whatever pointed at it then simply has no file.
 */
export const sniff = internalAction({
  args: { storageId: v.id("_storage"), kind: KIND },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) return null; // already gone
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const problem = sniffProblem(bytes, args.kind);
    if (problem) await ctx.runMutation(internal.uploadsGuard.quarantine, { storageId: args.storageId, kind: args.kind, problem });
    return null;
  },
});

export const quarantine = internalMutation({
  args: { storageId: v.id("_storage"), kind: KIND, problem: v.string() },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId).catch(() => undefined);
    await ctx.db.insert("auditLog", { actorKind: "system", action: "upload.quarantined", targetTable: "_storage", targetId: args.storageId, meta: { kind: args.kind, problem: args.problem }, createdAt: Date.now() });
    return null;
  },
});
