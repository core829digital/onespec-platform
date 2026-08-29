import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export async function getUserId(ctx: any) {
  return await getAuthUserId(ctx);
}

export async function requireUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("UNAUTHENTICATED");
  return userId;
}

export async function requireVerifiedUser(ctx: any) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.emailVerificationTime) throw new ConvexError("EMAIL_NOT_VERIFIED");
  return userId;
}

export async function requireMembership(ctx: any, tenantId: any) {
  const userId = await requireVerifiedUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenant_user", q => q.eq("tenantId", tenantId).eq("userId", userId))
    .unique();
  if (!membership || membership.status !== "active") {
    throw new ConvexError("NOT_A_MEMBER");
  }
  return { userId, membership };
}

export async function requireTenantRole(ctx: any, tenantId: any, roles: string[]) {
  const { userId, membership } = await requireMembership(ctx, tenantId);
  if (!roles.includes(membership.role)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  return { userId, membership };
}

export async function requirePlatformAdmin(ctx: any) {
  const userId = await requireVerifiedUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.isPlatformAdmin) throw new ConvexError("NOT_PLATFORM_ADMIN");
  return userId;
}