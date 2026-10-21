import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { ReadCtx } from "./auth";
import { requireMembership, requirePlatformAdmin as requirePlatformAdminUser } from "./auth";
import { resolveTenantEntitlements, type BooleanEntitlementKey } from "./entitlements";
import { gradeAllows } from "../../src/shared/grades";

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
  // multiSupplierAggregator is already enforced separately by
  // enforceForMultiSupplier at the one call site that needs it (creating a
  // supplier) — no entitlement attached here to avoid checking it twice via
  // two different code paths in the same handler.
  "suppliers.manage": { minRole: "admin" },
  "export.tenantData": { minRole: "admin" },

  // Field/CRM modules — role floor formalized 1:1 from what every call site
  // already enforced via requireTenantRole (no behavior change, this pass is
  // a refactor: name the action once instead of repeating a role array at
  // every call site). ".use" = member can read/create/edit their own tenant's
  // records; ".delete"/".manage" = admin-only destructive or configuration
  // actions, matching the pre-existing ["owner","admin"] call sites exactly.
  "branding.manage": { minRole: "admin" },
  "cantieri.use": { minRole: "member", entitlement: "moduleCantieri" },
  "cantieri.delete": { minRole: "admin", entitlement: "moduleCantieri" },
  "catalog.manage": { minRole: "admin" },
  "clients.use": { minRole: "member", entitlement: "moduleCrm" },
  "clients.delete": { minRole: "admin", entitlement: "moduleCrm" },
  "configurators.manage": { minRole: "admin" },
  "dpa.accept": { minRole: "admin" },
  "inspections.use": { minRole: "member", entitlement: "moduleFieldOps" },
  "inspections.delete": { minRole: "admin", entitlement: "moduleFieldOps" },
  "installations.use": { minRole: "member", entitlement: "moduleFieldOps" },
  "installations.delete": { minRole: "admin", entitlement: "moduleFieldOps" },
  "passports.use": { minRole: "member", entitlement: "moduleFieldOps" },
  "passports.manage": { minRole: "admin", entitlement: "moduleFieldOps" },
  // Revenue and lead statistics: the commercial side of the company.
  "analytics.use": { minRole: "member" },
  "quotes.use": { minRole: "member" },
  // Preventivi B2B (installer-created field quotes) — locked on the widget-first plans.
  "quotes.field": { minRole: "member", entitlement: "moduleFieldQuotes" },
  "quotes.manage": { minRole: "admin" },
  "surveys.use": { minRole: "member", entitlement: "moduleFieldOps" },
  "surveys.delete": { minRole: "admin", entitlement: "moduleFieldOps" },
  "logistics.use": { minRole: "member", entitlement: "moduleLogistics" },
  "logistics.manage": { minRole: "admin", entitlement: "moduleLogistics" },
  // Fornitura (supplies, partners, profit): the money side of the jobs — separate from quotes so a grade can have one without the other.
  "supply.use": { minRole: "member" },
  "supply.manage": { minRole: "admin" },
  // Module entitlements above (module*) are ON for every full-platform plan —
  // they only close on the widget-first plans (essentials / essentials_plus /
  // max), which is what renders those pages "locked" in the app.
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
  opts: { allowSuspendedRead?: boolean } = {},
): Promise<PermissionResult> {
  const { userId, membership } = await requireMembership(ctx, tenantId);
  const spec: PermissionSpec = PERMISSIONS[action];
  if (!roleAtLeast(membership.role, spec.minRole)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  // The professional grade narrows what the tier allows (a fitter does not see the prices, a salesperson does not run the warehouse).
  // The owner is never narrowed; a member with no grade (joined before grades existed) is not narrowed either.
  if (membership.role !== "owner" && !gradeAllows(membership.grade, action)) {
    throw new ConvexError("INSUFFICIENT_ROLE");
  }
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
  // No plan, no platform: every permission-checked operation (team, catalogue,
  // publishing, clients, field modules, …) is refused until a plan is active.
  // The plan step itself (plan quiz, checkout, billing state) does not go
  // through here. Founding / full-access accounts are exempt.
  if (tenant.planStatus === "pending_plan" && tenant.unlimitedAccess !== true) {
    throw new ConvexError("PLAN_SELECTION_REQUIRED");
  }
  // Subscription ended (cancelled trial/plan, deleted in Stripe): nothing
  // works — reads included, except the redacted lead list that
  // is kept on purpose (founder decision A) — until the owner subscribes again. The billing
  // flow uses requireMembership/assertOwner, so re-subscribing stays possible.
  if (tenant.planStatus === "suspended" && tenant.unlimitedAccess !== true && !opts.allowSuspendedRead) {
    throw new ConvexError("PLAN_SUSPENDED");
  }
  if (spec.entitlement && resolveTenantEntitlements(tenant)[spec.entitlement] !== true) {
    throw new ConvexError("PLAN_UPGRADE_REQUIRED");
  }
  return { userId, membership, tenant };
}

/**
 * Like `requirePermission`, but a member whose GRADE keeps them out of this area gets `null` instead of an error. For the read-only lists that
 * shared screens (dashboard, the client/site picker, the quote page) load: a fitter opening the dashboard sees an empty "quotes" box, not a crash.
 * Every other refusal (role, plan, suspension) still throws exactly as before, and writes keep using `requirePermission`.
 */
export async function requirePermissionOrNull(
  ctx: ReadCtx,
  tenantId: Id<"tenants">,
  action: PermissionKey,
  opts: { allowSuspendedRead?: boolean } = {},
): Promise<PermissionResult | null> {
  const { membership } = await requireMembership(ctx, tenantId);
  if (membership.role !== "owner" && !gradeAllows(membership.grade, action)) return null;
  return await requirePermission(ctx, tenantId, action, opts);
}

/** Re-exported so call sites only need one RBAC import for both axes. */
export const requirePlatformAdmin = requirePlatformAdminUser;
