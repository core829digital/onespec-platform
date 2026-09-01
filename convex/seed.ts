import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Idempotent bootstrap for the `appSettings` singleton. Safe to run repeatedly.
 * Run with: `npx convex run seed:run`
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    if (existing) {
      return { created: false, settingsId: existing._id };
    }

    const settingsId = await ctx.db.insert("appSettings", {
      key: "global",
      registrationOpen: false,
      alphaSeatCap: 250,
      alphaSeatsClaimed: 0,
      resendMode: "noop",
      updatedAt: Date.now(),
    });

    return { created: true, settingsId };
  },
});

/**
 * Grant platform-admin to a user by email. Run with:
 * `npx convex run seed:makeAdmin '{"email":"you@example.com"}'`
 */
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    if (!user) throw new Error(`No user with email ${args.email}`);
    await ctx.db.patch(user._id, { isPlatformAdmin: true });
    return { userId: user._id };
  },
});
