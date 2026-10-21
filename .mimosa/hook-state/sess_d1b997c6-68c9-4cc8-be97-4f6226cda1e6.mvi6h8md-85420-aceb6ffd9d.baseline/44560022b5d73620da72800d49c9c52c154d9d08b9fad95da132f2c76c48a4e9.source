import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { consumeToken } from "./ratelimit";

/**
 * `generateUploadUrl` hands out an unrestricted upload slot — the content type
 * and size the client announces are only a claim. Every place that ATTACHES an
 * uploaded file to a record must therefore check what was actually stored.
 */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const DOC_MAX_BYTES = 25 * 1024 * 1024;

/** Pure check of a stored file's metadata → error code, or null when acceptable. */
export function storedFileProblem(
  meta: { contentType?: string; size: number } | null,
  kind: "image" | "document",
): "UNSUPPORTED_FILE_TYPE" | "FILE_TOO_LARGE" | null {
  const allowed = kind === "image" ? IMAGE_TYPES : DOC_TYPES;
  const max = kind === "image" ? PHOTO_MAX_BYTES : DOC_MAX_BYTES;
  if (!meta || !meta.contentType || !allowed.includes(meta.contentType.toLowerCase())) return "UNSUPPORTED_FILE_TYPE";
  if (meta.size > max) return "FILE_TOO_LARGE";
  return null;
}

/**
 * Hands out an upload slot only at a sane rate: 40 an hour per person per workspace. A slot is cheap to ask for, but every file uploaded
 * through one sits in storage (and behind a public address) until something attaches it.
 */
export async function consumeUploadSlot(ctx: MutationCtx, tenantId: Id<"tenants">, userId: Id<"users">): Promise<void> {
  if (!(await consumeToken(ctx, `upload:${tenantId}:${userId}`, { tokens: 40, refillMs: 60 * 60 * 1000 }))) throw new ConvexError("RATE_LIMITED");
}

/** Asks for a second look at the bytes of an attached file (see convex/uploadsGuard.ts). */
export async function scheduleSniff(ctx: MutationCtx, storageId: Id<"_storage">, kind: "image" | "document" | "logo" | "brandLogo"): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.uploadsGuard.sniff, { storageId, kind });
}

export async function assertStoredFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  opts: { kind: "image" | "document"; purgeIfInvalid?: boolean },
): Promise<void> {
  const meta = await ctx.db.system.get(storageId);
  const problem = storedFileProblem(meta, opts.kind);
  if (!problem) {
    await scheduleSniff(ctx, storageId, opts.kind);
    return;
  }
  // A freshly uploaded file that fails the check is useless — don't leave it in storage.
  if (meta && opts.purgeIfInvalid) await ctx.storage.delete(storageId).catch(() => {});
  throw new ConvexError(problem);
}
