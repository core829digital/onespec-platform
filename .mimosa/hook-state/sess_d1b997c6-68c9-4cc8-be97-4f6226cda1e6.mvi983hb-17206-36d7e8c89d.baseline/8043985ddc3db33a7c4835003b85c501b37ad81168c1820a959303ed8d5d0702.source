import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./lib/totp";
import {
  RECOVERY_CODE_COUNT, decryptSecret, encryptSecret, generateRecoveryCodes, hashRecoveryCode, mfaKeyMaterial, normalizeRecoveryCode, safeEqual,
} from "./lib/mfaCrypto";
import { ConvexError } from "convex/values";

/**
 * Two-step verification with an authenticator app (TOTP, RFC 6238) and one-time recovery codes.
 *
 * Failures are RETURNED, not thrown: a thrown error rolls the whole mutation back, which would also undo the failed-attempt counter
 * that protects the code from guessing. Only conditions that must not be counted (not signed in, key missing) throw.
 */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const ISSUER = "OneSpec";

type Fail = "MFA_INVALID" | "MFA_LOCKED" | "MFA_UNAVAILABLE";
type Checked = { ok: true } | { ok: false; error: Fail };

async function audit(ctx: MutationCtx, userId: Id<"users">, action: string, meta?: Record<string, unknown>) {
  await ctx.db.insert("auditLog", { actorUserId: userId, actorKind: "user", action, targetTable: "userMfa", meta, createdAt: Date.now() });
}

/** Checks one typed code (6-digit TOTP or recovery code) and keeps the books: attempts, lock, single use. */
async function checkFactor(ctx: MutationCtx, row: Doc<"userMfa">, code: string, commit: boolean): Promise<Checked> {
  const now = Date.now();
  if (row.lockedUntil && row.lockedUntil > now) return { ok: false, error: "MFA_LOCKED" };
  const typed = code.replace(/\s/g, "");
  let secret: string;
  try {
    secret = await decryptSecret(row.secretEnc, row.userId);
  } catch {
    return { ok: false, error: "MFA_UNAVAILABLE" };
  }

  let good = false;
  let step: number | null = null;
  let recoveryIdx = -1;
  if (/^\d{6}$/.test(typed)) {
    step = await verifyTotp(secret, typed, now, row.lastStep ?? -1);
    good = step !== null;
  } else if (normalizeRecoveryCode(typed).length === 10) {
    const h = await hashRecoveryCode(typed, row.userId);
    // Every stored code is compared, so the time taken does not tell which one (if any) matched.
    row.recovery.forEach((r, i) => {
      if (!r.usedAt && safeEqual(r.hash, h) && recoveryIdx < 0) recoveryIdx = i;
    });
    good = recoveryIdx >= 0;
  }

  if (good) {
    if (commit) {
      const recovery = recoveryIdx >= 0 ? row.recovery.map((r, i) => (i === recoveryIdx ? { ...r, usedAt: now } : r)) : row.recovery;
      await ctx.db.patch(row._id, { failedCount: 0, lockedUntil: undefined, recovery, ...(step !== null ? { lastStep: step } : {}) });
      if (recoveryIdx >= 0) await audit(ctx, row.userId, "mfa.recovery_used", { remaining: recovery.filter((r) => !r.usedAt).length });
    }
    return { ok: true };
  }

  const failed = row.failedCount + 1;
  if (failed >= MAX_FAILS) {
    await ctx.db.patch(row._id, { failedCount: 0, lockedUntil: now + LOCK_MS });
    await audit(ctx, row.userId, "mfa.locked");
  } else {
    await ctx.db.patch(row._id, { failedCount: failed });
  }
  return { ok: false, error: "MFA_INVALID" };
}

async function rowOf(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.query("userMfa").withIndex("by_user", (q) => q.eq("userId", userId)).first();
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.query("userMfa").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    const key = process.env.MFA_ENCRYPTION_KEY;
    return {
      /** False when the deployment has no encryption key: the page then says so instead of offering a setup that cannot work. */
      available: !!key && key.length >= 32,
      enabled: !!row?.enabled,
      recoveryRemaining: row?.enabled ? row.recovery.filter((r) => !r.usedAt).length : 0,
    };
  },
});

/** Step 1: a fresh secret (replaces an unfinished earlier one). Shown once, as text and as the QR code's link. */
export const beginSetup = mutation({
  args: {},
  handler: async (ctx): Promise<{ ok: true; secret: string; uri: string } | { ok: false; error: "RATE_LIMITED" }> => {
    const userId = await requireUser(ctx);
    mfaKeyMaterial();
    const existing = await rowOf(ctx, userId);
    if (existing?.enabled) throw new ConvexError("MFA_ALREADY_ENABLED");
    if (!(await consumeToken(ctx, `mfa-setup:${userId}`, { tokens: 10, refillMs: 60 * 60 * 1000 }))) return { ok: false, error: "RATE_LIMITED" };
    const secret = generateTotpSecret();
    const secretEnc = await encryptSecret(secret, userId);
    if (existing) await ctx.db.patch(existing._id, { secretEnc, createdAt: Date.now(), failedCount: 0, lockedUntil: undefined, lastStep: undefined });
    else await ctx.db.insert("userMfa", { userId, secretEnc, enabled: false, createdAt: Date.now(), failedCount: 0, recovery: [] });
    const user = await ctx.db.get(userId);
    return { ok: true, secret, uri: otpauthUri(ISSUER, user?.email ?? String(userId), secret) };
  },
});

/** Step 2: the first valid code proves the app is set up; only then it turns on, and the recovery codes are shown (once). */
export const confirmSetup = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: Fail }> => {
    const userId = await requireUser(ctx);
    const row = await rowOf(ctx, userId);
    if (!row) throw new ConvexError("MFA_SETUP_NOT_FOUND");
    if (row.enabled) throw new ConvexError("MFA_ALREADY_ENABLED");
    if (args.code.length > 32) return { ok: false, error: "MFA_INVALID" };
    const checked = await checkFactor(ctx, row, args.code, true);
    if (!checked.ok) return checked;
    const recoveryCodes = generateRecoveryCodes();
    const recovery = await Promise.all(recoveryCodes.map(async (c) => ({ hash: await hashRecoveryCode(c, userId) })));
    await ctx.db.patch(row._id, { enabled: true, enabledAt: Date.now(), recovery });
    await audit(ctx, userId, "mfa.enabled");
    return { ok: true, recoveryCodes };
  },
});

/** Turning it off needs a current code (or a recovery code): a stolen open session alone cannot remove the protection. */
export const disable = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; error: Fail }> => {
    const userId = await requireUser(ctx);
    const row = await rowOf(ctx, userId);
    if (!row?.enabled) throw new ConvexError("MFA_NOT_ENABLED");
    if (args.code.length > 32) return { ok: false, error: "MFA_INVALID" };
    const checked = await checkFactor(ctx, row, args.code, true);
    if (!checked.ok) return checked;
    await ctx.db.delete(row._id);
    await audit(ctx, userId, "mfa.disabled");
    return { ok: true };
  },
});

export const regenerateRecoveryCodes = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: Fail }> => {
    const userId = await requireUser(ctx);
    const row = await rowOf(ctx, userId);
    if (!row?.enabled) throw new ConvexError("MFA_NOT_ENABLED");
    if (args.code.length > 32) return { ok: false, error: "MFA_INVALID" };
    const checked = await checkFactor(ctx, row, args.code, true);
    if (!checked.ok) return checked;
    const fresh = await rowOf(ctx, userId);
    const recoveryCodes = generateRecoveryCodes();
    const recovery = await Promise.all(recoveryCodes.map(async (c) => ({ hash: await hashRecoveryCode(c, userId) })));
    await ctx.db.patch((fresh ?? row)._id, { recovery });
    await audit(ctx, userId, "mfa.recovery_regenerated", { count: RECOVERY_CODE_COUNT });
    return { ok: true, recoveryCodes };
  },
});

type LoginCheck = { enabled: false } | { enabled: true; ok: true } | { enabled: true; ok: false; error: Fail | "MFA_REQUIRED" };

async function loginCheck(ctx: MutationCtx, userId: Id<"users">, code: string, commit: boolean): Promise<LoginCheck> {
  const row = await rowOf(ctx, userId);
  if (!row?.enabled) return { enabled: false };
  if (code.trim() === "") return { enabled: true, ok: false, error: "MFA_REQUIRED" };
  if (code.length > 32) return { enabled: true, ok: false, error: "MFA_INVALID" };
  const checked = await checkFactor(ctx, row, code, commit);
  return { enabled: true, ...checked } as LoginCheck;
}

/** Called by the sign-in guard (convex/auth.ts) once the password was accepted. */
export const verifyLogin = internalMutation({
  args: { userId: v.id("users"), code: v.string(), commit: v.boolean() },
  handler: async (ctx, args): Promise<LoginCheck> => await loginCheck(ctx, args.userId, args.code, args.commit),
});

/** Same for the password reset, where the account is known only by its e-mail. */
export const verifyByEmail = internalMutation({
  args: { email: v.string(), code: v.string(), commit: v.boolean() },
  handler: async (ctx, args): Promise<LoginCheck> => {
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", args.email)).first();
    if (!user) return { enabled: false };
    return await loginCheck(ctx, user._id, args.code, args.commit);
  },
});

/** Account erasure: the factor goes with the account. */
export const eraseForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const rows = await ctx.db.query("userMfa").withIndex("by_user", (q) => q.eq("userId", args.userId)).take(5);
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

