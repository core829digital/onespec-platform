import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireMembership } from "./lib/auth";
import { isEmailLocale } from "./emails/strings";

export const viewer = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      emailVerified: !!user.emailVerificationTime,
      isPlatformAdmin: !!user.isPlatformAdmin,
      locale: user.locale ?? null,
    };
  },
});

/**
 * Remember the UI language the signed-in user works in, so every email they
 * receive (notifications, password reset, …) is written in that language.
 * Called by the app shell whenever the active locale differs from the stored one.
 */
export const setMyLocale = mutation({
  args: { locale: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (!isEmailLocale(args.locale)) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.locale === args.locale) return null;
    await ctx.db.patch(userId, { locale: args.locale });
    return null;
  },
});

/** Stored language for an email address (OTP / reset emails, sent without a session). */
export const localeForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?.locale ?? null;
  },
});

export const listUsers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const allMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const activeMemberships = allMemberships.filter((m) => m.status === "active");
    const userIds = activeMemberships.map((m) => m.userId);
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));

    return users.filter((u): u is NonNullable<typeof u> => u !== null).map((u) => ({
      _id: u._id,
      name: u.name ?? null,
      email: u.email ?? null,
    }));
  },
});
