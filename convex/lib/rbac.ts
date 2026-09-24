import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { ReadCtx } from "./auth";
import { requireMembership, requirePlatformAdmin as requirePlatformAdminUser } from "./auth";
import { resolveTenantEntitlements, type BooleanEntitlementKey } from "./entitlements";

/**
 * Central RBAC model for the platform. Two independent axes, both already
 * existed (membership.role, resolveTenantEntitlements per plan) but were
 * checked separately at each call site with no shared vocabulary. This
 * module names them once:
 *
 * - Tenant role (owner > admin > member) — who inside a tenant can do what,
 *   independent of billing.
 * - Plan entitlement (base/pro/agency/enterprise, see entitlements.ts) —
 *   what the tenant's subscription actually unlocks, independent of who's
 *   asking.
 * - Platform role (users.isPlatformAdmin) — manages the whole platform
 *   across every tenant; unaffected by any tenant's role or plan.
 *
 * `PERMISSIONS` below is the one place that says, for a given action, the
 * tenant-role floor and (optionally) the plan-entitlement ceiling — i.e.
 * the "same role name means more on a higher plan" model: an "admin" on
 * Base and an "admin" on Enterprise pass the same role check, but only the
 * Enterprise one also clears an entitlement-gated action like white-label.
 * `requireTenantRole` (auth.ts) still works for role-only checks — this is
 * additive, not a replacement, and is the standard for new gated actions.
 */

export type TenantRole = "owner" | "admin" | "member";
const ROLE_RANK: Record<TenantRole, number> = { member: 0, admin: 1, owner: 2 };

export function roleAtLeast(role: string, min: TenantRole): boolean {
  const rank = ROLE_RANK[role as TenantRole];
  return rank !== undefined && rank >= ROLE_RANK[min];
}

interface PermissionSpec {
  minRole: TenantRole;
  /** When set, the tenant's plan must have this boolean entitlement on. */
  entitlement?: BooleanEntitlementKey;
}

export const PERMISSIONS = {
  "team.invite": { minRole: "admin" },
  "team.remove": { minRole: "admin" },
  "team.cancelInvite": { minRole: "admin" },
  "billing.manage": { minRole: "owner" },
  "tenant.settings": { minRole: "admin" },
  "tenant.suspend": { minRole: "owner" }, // platform-admin only in practice; see requirePlatformAdmin
  "catalog.whiteLabel": { minRole: "admin", entitlement: "whiteLabel" },
  "catalog.multiCatalog": { minRole: "member", entitlement: "multiCatalog" },
  "widget.public": { minRole: "member", entitlement: "publicWidget" },
  "suppliers.manage": { minRole: "admin", entitlement: "multiSupplierAggregator" },
  "export.data": { minRole: "member" },
} satisfies Record<string, PermissionSpec>;

export type PermissionKey = keyof typeof PERMISSIONS;

export interface PermissionResult {
  userId: Id<"users">;
  membership: Doc<"memberships">;
  tenant: Doc<"tenants">;
}

/**
 * The combined check: tenant role floor, then (if the action names one) the
 * plan entitlement ceiling. Throws INSUFFICIENT_ROLE or PLAN_UPGRADE_REQUIRED
 * — distinct codes so the client can tell "you're not allowed" apart from
 * "your plan doesn't include this", which need different UI (contact your
 * admin vs. upgrade your plan).
 */
export async function requirePermission(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
  action: PermissionKey,
): Promise<PermissionResult> {
  const { userId, membership } = await requireMembership(ctx, tenantId);
  const spec: PermissionSpec = PERMISSIONS[action];
  if (!roleAtLeast(membership.role, spec.minRole)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  if (spec.entitlement && resolveTenantEntitlements(tenant)[spec.entitlement] !== true) {
    throw new ConvexError("PLAN_UPGRADE_REQUIRED");
  }
  return { userId, membership, tenant };
}

/** Re-exported so call sites only need one RBAC import for both axes. */
export const requirePlatformAdmin = requirePlatformAdminUser;
