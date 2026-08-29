import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const RATE_LIMITS = {
  quotePerIpPer10Min: { tokens: 5, refillMs: 10 * 60 * 1000 },
  quotePerIpPerDay: { tokens: 20, refillMs: 24 * 60 * 60 * 1000 },
  quoteGlobalPerConfigurator: { tokens: 100, refillMs: 60 * 60 * 1000 },
};

async function consumeToken(
  ctx: any,
  bucketKey: string,
  config: { tokens: number; refillMs: number },
): Promise<boolean> {
  const now = Date.now();
  const bucket = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q: any) => q.eq("bucketKey", bucketKey))
    .unique();

  if (!bucket) {
    await ctx.db.insert("rateLimits", { bucketKey, tokens: config.tokens - 1, updatedAt: now });
    return true;
  }

  const elapsed = now - bucket.updatedAt;
  const refillRate = config.tokens / config.refillMs; // tokens per ms
  const refilled = Math.floor(elapsed * refillRate);
  const available = Math.min(config.tokens, bucket.tokens + refilled);

  if (available <= 0) {
    await ctx.db.patch(bucket._id, { tokens: available, updatedAt: now });
    return false;
  }

  await ctx.db.patch(bucket._id, { tokens: available - 1, updatedAt: now });
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
