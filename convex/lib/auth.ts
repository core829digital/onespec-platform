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
  // .first() rather than .unique(): a duplicate membership row for the same
  // tenant+user (e.g. from a double-submit race in tenants.ts's invite-accept
  // flow — read-then-insert across two separate mutation calls, nothing
  // serializes them against each other) would make .unique() throw an
  // uncaught error and permanently 500 every operation for that user, instead
  // of just letting them in on the first active row found (same pattern
  // already applied to enforceConfiguratorQuota for the analogous counter
  // race in convex/lib/enforcement.ts).
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenant_user", (q) => q.eq("tenantId", tenantId).eq("userId", userId))
    .first();
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
