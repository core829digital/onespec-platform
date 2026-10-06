import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";

/** Longest refill window above (1 day): a bucket idle for longer is full again. */
const MAX_REFILL_MS = 24 * 60 * 60 * 1000;

export const RATE_LIMITS = {
  quotePerIpPer10Min: { tokens: 5, refillMs: 10 * 60 * 1000 },
  quotePerIpPerDay: { tokens: 20, refillMs: 24 * 60 * 60 * 1000 },
  quoteGlobalPerConfigurator: { tokens: 100, refillMs: 60 * 60 * 1000 },
  exportPerTenantPerHour: { tokens: 10, refillMs: 60 * 60 * 1000 },
  guestPinPerIpPer10Min: { tokens: 10, refillMs: 10 * 60 * 1000 },
  guestPinPerPinPerIpPer10Min: { tokens: 5, refillMs: 10 * 60 * 1000 },
  passportInterventionPerIpPer10Min: { tokens: 5, refillMs: 10 * 60 * 1000 },
  passportInterventionGlobalPerHour: { tokens: 20, refillMs: 60 * 60 * 1000 },
  passportScanPerIpPerHour: { tokens: 10, refillMs: 60 * 60 * 1000 },
  inspectionPerTokenIpPer10Min: { tokens: 30, refillMs: 10 * 60 * 1000 },
  inspectionGlobalPerHour: { tokens: 100, refillMs: 60 * 60 * 1000 },
};

/**
 * Consume one token from a named bucket. Returns false when the bucket is
 * exhausted. Exported so authenticated mutations (e.g. data export) can reuse
 * the same token-bucket store as the widget rate limiter.
 */
export async function consumeToken(
  ctx: MutationCtx,
  bucketKey: string,
  config: { tokens: number; refillMs: number },
): Promise<boolean> {
  const now = Date.now();
  // .first() rather than .unique(): a race between two concurrent requests on
  // the same bucketKey's first-ever insert (both read !bucket, both insert)
  // would leave a duplicate row and make .unique() throw an uncaught error on
  // every future request against that key — see convex/lib/auth.ts for the
  // same pattern on membership lookups.
  const bucket = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("bucketKey", bucketKey))
    .first();

  if (!bucket) {
    await ctx.db.insert("rateLimits", { bucketKey, tokens: config.tokens - 1, updatedAt: now });
    return true;
  }

  const elapsed = now - bucket.updatedAt;
  const refillRate = config.tokens / config.refillMs; // tokens per ms
  const refilled = Math.floor(elapsed * refillRate);
  const available = Math.min(config.tokens, bucket.tokens + refilled);

  // A refused request writes nothing: the callers throw on `false`, which rolls the transaction back anyway, and a write here
  // would only add contention on a bucket that is already hot.
  if (available <= 0) return false;

  // The refill clock moves forward only by the tokens actually handed back. Resetting it to `now` on every use threw away the
  // fraction of a token earned since the last request, so a visitor who kept retrying every minute or two never regained one.
  const clock = available >= config.tokens ? now : bucket.updatedAt + refilled / refillRate;
  await ctx.db.patch(bucket._id, { tokens: available - 1, updatedAt: clock });
  return true;
}

/**
 * Token-bucket rate limit for widget quote submissions. Runs 3 buckets:
 * per-IP/10min, per-IP/day, per-configurator/hour. Throws RATE_LIMITED if any
 * bucket is exhausted. Registered as an internalMutation so the HTTP action can
 * call it via ctx.runMutation.
 */
export const checkAllRateLimits = internalMutation({
  args: { configuratorId: v.id("configurators"), ipHash: v.string() },
  handler: async (ctx, args) => {
    const ipBucket = `${args.configuratorId}:${args.ipHash}`;
    const ok10m = await consumeToken(ctx, `${ipBucket}:10m`, RATE_LIMITS.quotePerIpPer10Min);
    const okDay = await consumeToken(ctx, `${ipBucket}:day`, RATE_LIMITS.quotePerIpPerDay);
    const okGlobal = await consumeToken(
      ctx,
      `${args.configuratorId}:global`,
      RATE_LIMITS.quoteGlobalPerConfigurator,
    );
    if (!ok10m || !okDay || !okGlobal) {
      throw new ConvexError("RATE_LIMITED");
    }
    return true;
  },
});

/**
 * Generic single-bucket check for HTTP actions (passport scan/intervention,
 * inspection writes, guest PIN). Throws RATE_LIMITED when exhausted —
 * callers map it to 429 (or counted:false for scan).
 */
export const checkBucket = internalMutation({
  args: {
    bucketKey: v.string(),
    tokens: v.number(),
    refillMs: v.number(),
  },
  handler: async (ctx, args) => {
    const ok = await consumeToken(
      ctx,
      args.bucketKey,
      { tokens: args.tokens, refillMs: args.refillMs },
    );
    if (!ok) throw new ConvexError("RATE_LIMITED");
    return true;
  },
});

/**
 * Daily cron: delete buckets idle for more than 2× the longest refill window.
 * Such a bucket is back to full capacity, so deleting it changes nothing for
 * the next request (a missing bucket starts full) — it only stops the table
 * growing by one row per visitor IP × configurator forever. Batched.
 */
export const purgeIdleBuckets = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * MAX_REFILL_MS;
    const rows = await ctx.db
      .query("rateLimits")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", cutoff))
      .take(1000);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === 1000) await ctx.scheduler.runAfter(0, internal.lib.ratelimit.purgeIdleBuckets, {});
    return rows.length;
  },
});
