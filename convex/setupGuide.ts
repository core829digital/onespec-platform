import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMembership } from "./lib/auth";

/**
 * Floating setup-guide widget (backlog item, dictated 2026-09-28): a
 * Stripe-style bottom-right checklist that walks a tenant through initial
 * platform setup, plan-aware (different steps show for Base vs Pro/Agency+).
 *
 * Deliberately NOT backed by a stored "progress" table. Every step here is
 * derived live from the same rows the rest of the app already treats as the
 * source of truth (configurators, branding, memberships, clients, cantieri,
 * Stripe fields on the tenant) — this is the "real server-side verification"
 * the backlog explicitly asked for, and it can never drift out of sync with
 * reality the way a client-ticked or cached progress row could. A step is
 * "done" if and only if the underlying row actually exists right now.
 */
export const getProgress = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    const configurators = await ctx.db
      .query("configurators")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const hasConfigurator = configurators.length > 0;
    const hasPublishedCatalog = configurators.some((c) => c.publishedCatalogVersion != null);

    const branding = await ctx.db
      .query("branding")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    const hasBranding = branding != null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const activeMembers = memberships.filter((m) => m.status === "active").length;
    const hasInvitedTeam = activeMembers > 1;

    const firstClient = await ctx.db
      .query("clients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    const hasClient = firstClient != null;

    const firstCantiere = await ctx.db
      .query("cantieri")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    const hasCantiere = firstCantiere != null;

    const hasBilling = tenant.stripeCustomerId != null;

    // Steps every plan sees, in the order they're meant to be done.
    const steps = [
      { key: "configurator", done: hasConfigurator },
      { key: "branding", done: hasBranding },
      { key: "catalog", done: hasPublishedCatalog },
      { key: "client", done: hasClient },
      { key: "cantiere", done: hasCantiere },
      { key: "team", done: hasInvitedTeam },
      // Base has no billing step of its own (nothing to set up beyond the
      // free tier); Pro/Agency/Enterprise must have an active Stripe
      // customer, which `hasBilling` already encodes.
      ...(tenant.plan === "base" ? [] : [{ key: "billing", done: hasBilling }]),
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const totalCount = steps.length;

    return {
      plan: tenant.plan,
      steps,
      doneCount,
      totalCount,
      completed: doneCount === totalCount,
    };
  },
});
