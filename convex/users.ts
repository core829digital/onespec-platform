import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireMembership } from "./lib/auth";

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
    };
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
