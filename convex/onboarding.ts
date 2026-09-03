import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUser, type ReadCtx } from "./lib/auth";
import { resolveTenantEntitlements } from "./lib/entitlements";
import { regionForCountry } from "./lib/regions";

/** Ordered wizard steps. `billing` is skipped when payment isn't required. */
export const ONBOARDING_STEPS = ["welcome", "billing", "team", "configurator"] as const;
type Step = (typeof ONBOARDING_STEPS)[number];

async function tenantOf(ctx: ReadCtx, userId: Id<"users">) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!membership) return null;
  const tenant = await ctx.db.get(membership.tenantId);
  return tenant ? { tenant, role: membership.role } : null;
}

export const getState = query({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) return { hasTenant: false as const };

    const { tenant, role } = found;
    const ent = resolveTenantEntitlements(tenant);
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const activeSub = tenant.planStatus === "active" || tenant.planStatus === "trialing";
    // Payment is required only for a paying (non-Alpha) tenant, once Stripe is live.
    const needsBilling = stripeConfigured && !tenant.isAlpha && !activeSub;

    const configurators = (
      await ctx.db
        .query("configurators")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    ).filter((c) => c.status !== "archived");

    return {
      hasTenant: true as const,
      completed: !!tenant.onboardingCompletedAt,
      step: (tenant.onboardingStep as Step | undefined) ?? "welcome",
      needsBilling,
      stripeConfigured,
      role,
      isAlpha: tenant.isAlpha,
      alphaSeatNumber: tenant.alphaSeatNumber ?? null,
      plan: tenant.plan,
      region: regionForCountry(tenant.country).code,
      entitlements: {
        maxConfigurators: ent.maxConfigurators,
        maxQuotesPerMonth: ent.maxQuotesPerMonth,
        maxTeamMembers: ent.maxTeamMembers,
        whiteLabel: ent.whiteLabel,
        advancedPricingRules: ent.advancedPricingRules,
        multiCatalog: ent.multiCatalog,
        analytics: ent.analytics,
      },
      configuratorCount: configurators.length,
      firstPublicId: configurators[0]?.publicId ?? null,
    };
  },
});

export const advance = mutation({
  args: { step: v.union(...ONBOARDING_STEPS.map((s) => v.literal(s))) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) throw new ConvexError("NO_TENANT");
    if (found.tenant.onboardingCompletedAt) return;
    await ctx.db.patch(found.tenant._id, { onboardingStep: args.step, updatedAt: Date.now() });
  },
});

export const complete = mutation({
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const found = await tenantOf(ctx, userId);
    if (!found) throw new ConvexError("NO_TENANT");
    if (found.tenant.onboardingCompletedAt) return;
    await ctx.db.patch(found.tenant._id, {
      onboardingCompletedAt: Date.now(),
      onboardingStep: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      tenantId: found.tenant._id,
      actorUserId: userId,
      actorKind: "user",
      action: "onboarding.complete",
      targetTable: "tenants",
      targetId: found.tenant._id,
      createdAt: Date.now(),
    });
  },
});
