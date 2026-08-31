import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

/** Any context that can read the database (query or mutation). */
export type ReadCtx = QueryCtx | MutationCtx;

export async function getUserId(ctx: ReadCtx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

export async function requireUser(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("UNAUTHENTICATED");
  return userId;
}

export async function requireVerifiedUser(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.emailVerificationTime) throw new ConvexError("EMAIL_NOT_VERIFIED");
  return userId;
}

export interface MembershipResult {
  userId: Id<"users">;
  membership: Doc<"memberships">;
}

export async function requireMembership(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
): Promise<MembershipResult> {
  const userId = await requireVerifiedUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenant_user", (q) => q.eq("tenantId", tenantId).eq("userId", userId))
    .unique();
  if (!membership || membership.status !== "active") {
    throw new ConvexError("NOT_A_MEMBER");
  }
  return { userId, membership };
}

export async function requireTenantRole(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
  roles: string[],
): Promise<MembershipResult> {
  const { userId, membership } = await requireMembership(ctx, tenantId);
  if (!roles.includes(membership.role)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  return { userId, membership };
}

export async function requirePlatformAdmin(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await requireVerifiedUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.isPlatformAdmin) throw new ConvexError("NOT_PLATFORM_ADMIN");
  return userId;
}
