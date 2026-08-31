import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireTenantRole, requirePlatformAdmin } from "./lib/auth";
import { createStripeCustomer, createStripeSubscription, createStripeCheckoutSession, getStripeSubscription, cancelStripeSubscription, createStripePortalSession, listStripePaymentMethods } from "./stripe";

const TRIAL_DAYS = 14;

function planLimits(plan: string) {
  const limits: Record<string, { maxConfigurators: number; maxQuotesPerMonth: number; maxTeamMembers: number; whiteLabel: boolean; customDomain: boolean; apiAccess: boolean; prioritySupport: boolean }> = {
    freemium: { maxConfigurators: 1, maxQuotesPerMonth: 10, maxTeamMembers: 1, whiteLabel: false, customDomain: false, apiAccess: false, prioritySupport: false },
    starter: { maxConfigurators: 3, maxQuotesPerMonth: 100, maxTeamMembers: 3, whiteLabel: false, customDomain: false, apiAccess: false, prioritySupport: false },
    business: { maxConfigurators: 10, maxQuotesPerMonth: 500, maxTeamMembers: 10, whiteLabel: true, customDomain: false, apiAccess: true, prioritySupport: true },
    enterprise: { maxConfigurators: -1, maxQuotesPerMonth: -1, maxTeamMembers: -1, whiteLabel: true, customDomain: true, apiAccess: true, prioritySupport: true },
    alpha: { maxConfigurators: 10, maxQuotesPerMonth: 500, maxTeamMembers: 10, whiteLabel: true, customDomain: false, apiAccess: true, prioritySupport: true },
  };
  return limits[plan] || limits.freemium;
}

export const getMySubscription = query({
  args: { tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, args) => {
    const tenantId = args.tenantId || (await requireTenantRole(ctx, args.tenantId!, ["owner", "admin"])).membership.tenantId;
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .unique();
    return subscription;
  },
});

export const getSubscriptionPlans = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_key", (q) => q.eq("key", "freemium"))
      .collect();
  },
});

export const listAllPlans = query({
  handler: async (ctx) => {
    return await ctx.db.query("subscriptionPlans").filter((q) => q.eq(q.field("isActive"), true)).collect();
  },
});

export const createCheckoutSession = mutation({
  args: { tenantId: v.id("tenants"), planKey: v.string(), successUrl: v.string(), cancelUrl: v.string() },
  handler: async (ctx, args) => {
    const { membership } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");

    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .unique();
    if (!plan || !plan.isActive) throw new ConvexError("PLAN_NOT_FOUND");

    let stripeCustomerId = tenant.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await createStripeCustomer({ email: tenant.email || membership.userId, name: tenant.name, metadata: { tenantId: args.tenantId } });
      stripeCustomerId = customer.id;
      await ctx.db.patch(args.tenantId, { stripeCustomerId });
    }

    const priceId = plan.stripePriceIdMonthly;
    if (!priceId) throw new ConvexError("PRICE_NOT_CONFIGURED");

    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const session = await createStripeCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      successUrl: `${baseUrl}${args.successUrl}`,
      cancelUrl: `${baseUrl}${args.cancelUrl}`,
      trialDays: plan.trialDays,
      metadata: { tenantId: args.tenantId, planKey: args.planKey },
      mode: "subscription",
    });

    return { url: session.url };
  },
});

export const createPortalSession = mutation({
  args: { tenantId: v.id("tenants"), returnUrl: v.string() },
  handler: async (ctx, args) => {
    const { membership } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || !tenant.stripeCustomerId) throw new ConvexError("NO_STRIPE_CUSTOMER");

    const session = await createStripePortalSession({
      customerId: tenant.stripeCustomerId,
      returnUrl: args.returnUrl,
    });

    return { url: session.url };
  },
});

export const cancelSubscription = mutation({
  args: { tenantId: v.id("tenants"), cancelAtPeriodEnd: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { membership } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (!subscription || !subscription.stripeSubscriptionId) throw new ConvexError("NO_ACTIVE_SUBSCRIPTION");

    await cancelStripeSubscription({
      subscriptionId: subscription.stripeSubscriptionId,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? true,
    });

    if (args.cancelAtPeriodEnd === false) {
      await ctx.db.patch(subscription._id, {
        status: "canceled",
        canceledAt: Date.now(),
      });
    }
  },
});

export const syncStripeSubscription = internalMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();

    if (!subscription?.stripeSubscriptionId) return;

    const stripeSub = await getStripeSubscription({ subscriptionId: subscription.stripeSubscriptionId });
    if (!stripeSub) return;

    const plan = await ctx.db
      .query("subscriptionPlans")
      .filter((q) => q.eq(q.field("stripePriceIdMonthly"), stripeSub.items.data[0]?.price.id))
      .unique();

    await ctx.db.patch(subscription._id, {
      stripePriceId: stripeSub.items.data[0]?.price.id,
      plan: plan?.key || "freemium",
      status: stripeSub.status,
      currentPeriodStart: stripeSub.current_period_start * 1000,
      currentPeriodEnd: stripeSub.current_period_end * 1000,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt: stripeSub.canceled_at ? stripeSub.canceled_at * 1000 : undefined,
      trialStart: stripeSub.trial_start ? stripeSub.trial_start * 1000 : undefined,
      trialEnd: stripeSub.trial_end ? stripeSub.trial_end * 1000 : undefined,
      metadata: stripeSub.metadata,
    });

    // Update tenant plan
    await ctx.db.patch(args.tenantId, { plan: plan?.key || "freemium" });
  },
});

export const handleStripeWebhook = internalMutation({
  args: { eventId: v.string(), type: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    // Check if already processed
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_stripe_event", (q) => q.eq("stripeEventId", args.eventId))
      .unique();
    if (existing?.processed) return { alreadyProcessed: true };

    await ctx.db.insert("webhookEvents", {
      stripeEventId: args.eventId,
      type: args.type,
      processed: false,
      payload: args.payload,
      receivedAt: Date.now(),
    });

    try {
      switch (args.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleSubscriptionEvent(ctx, args.payload);
          break;
        case "invoice.created":
        case "invoice.updated":
        case "invoice.paid":
        case "invoice.payment_failed":
          await handleInvoiceEvent(ctx, args.payload);
          break;
        case "customer.subscription.trial_will_end":
          await handleTrialEnding(ctx, args.payload);
          break;
        case "payment_method.attached":
        case "payment_method.detached":
          await handlePaymentMethodEvent(ctx, args.type, args.payload);
          break;
      }

      await ctx.db.patch(
        (await ctx.db.query("webhookEvents").withIndex("by_stripe_event", (q) => q.eq("stripeEventId", args.eventId)).unique())!._id,
        { processed: true, processedAt: Date.now() }
      );
    } catch (error) {
      await ctx.db.patch(
        (await ctx.db.query("webhookEvents").withIndex("by_stripe_event", (q) => q.eq("stripeEventId", args.eventId)).unique())!._id,
        { processed: false, error: String(error) }
      );
      throw error;
    }
  },
});

interface StripeSubscriptionPayload {
  id: string;
  customer: string;
  items: { data: Array<{ price: { id: string } }> };
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_start: number | null;
  trial_end: number | null;
  metadata: Record<string, string>;
}

async function handleSubscriptionEvent(ctx: any, payload: StripeSubscriptionPayload) {
  const stripeSub = payload;
  const customerId = stripeSub.customer;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", customerId))
    .unique();

  const plan = await ctx.db
    .query("subscriptionPlans")
    .filter((q) => q.eq(q.field("stripePriceIdMonthly"), stripeSub.items?.data[0]?.price.id))
    .unique();

  const tenant = await ctx.db
    .query("tenants")
    .filter((q) => q.eq(q.field("stripeCustomerId"), customerId))
    .unique();

  if (!tenant) return;

  const updateData: Record<string, unknown> = {
    stripeSubscriptionId: stripeSub.id,
    stripePriceId: stripeSub.items?.data[0]?.price.id,
    plan: plan?.key || "freemium",
    status: stripeSub.status,
    currentPeriodStart: stripeSub.current_period_start * 1000,
    currentPeriodEnd: stripeSub.current_period_end * 1000,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    canceledAt: stripeSub.canceled_at ? stripeSub.canceled_at * 1000 : undefined,
    trialStart: stripeSub.trial_start ? stripeSub.trial_start * 1000 : undefined,
    trialEnd: stripeSub.trial_end ? stripeSub.trial_end * 1000 : undefined,
    metadata: stripeSub.metadata,
  };

  if (subscription) {
    await ctx.db.patch(subscription._id, updateData);
  } else {
    await ctx.db.insert("subscriptions", {
      tenantId: tenant._id,
      stripeCustomerId: customerId,
      ...updateData,
    });
  }

  // Update tenant plan
  await ctx.db.patch(tenant._id, { plan: plan?.key || "freemium" });
}

interface StripeInvoicePayload {
  id: string;
  subscription: string | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: number;
  period_end: number;
  due_date: number | null;
  metadata: Record<string, string>;
}

async function handleInvoiceEvent(ctx: any, payload: StripeInvoicePayload) {
  const invoice = payload;
  const subscriptionId = invoice.subscription;

  const subscription = subscriptionId
    ? await ctx.db.query("subscriptions").withIndex("by_stripe_subscription", (q) => q.eq("stripeSubscriptionId", subscriptionId)).unique()
    : null;

  if (!subscription) return;

  const invoiceData = {
    tenantId: subscription.tenantId,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: subscriptionId,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    currency: invoice.currency,
    status: invoice.status,
    invoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    periodStart: invoice.period_start * 1000,
    periodEnd: invoice.period_end * 1000,
    dueDate: invoice.due_date ? invoice.due_date * 1000 : undefined,
    paidAt: invoice.status === "paid" ? Date.now() : undefined,
    metadata: invoice.metadata,
  };

  const existing = await ctx.db
    .query("invoices")
    .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", invoice.id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, invoiceData);
  } else {
    await ctx.db.insert("invoices", invoiceData);
  }
}

interface StripeTrialEndingPayload {
  customer: string;
}

async function handleTrialEnding(ctx: any, payload: StripeTrialEndingPayload) {
  const subscription = payload;
  const customerId = subscription.customer;

  const tenant = await ctx.db
    .query("tenants")
    .filter((q) => q.eq(q.field("stripeCustomerId"), customerId))
    .unique();

  if (!tenant) return;

  // Send trial ending email
  await ctx.scheduler.runAfter(0, internal.email.send, {
    template: "trial_ending",
    to: tenant.email || "",
    locale: tenant.locale || "it",
    data: { companyName: tenant.name, daysLeft: 3 },
    tenantId: tenant._id,
  });
}

interface StripePaymentMethodPayload {
  id: string;
  customer: string;
  type: string;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
  metadata: Record<string, string>;
}

async function handlePaymentMethodEvent(ctx: any, eventType: string, payload: StripePaymentMethodPayload) {
  const pm = payload;
  const customerId = pm.customer;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", customerId))
    .unique();

  if (!subscription) return;

  if (eventType === "payment_method.attached") {
    const existing = await ctx.db
      .query("paymentMethods")
      .withIndex("by_stripe_pm", (q) => q.eq("stripePaymentMethodId", pm.id))
      .unique();

    await ctx.db.insert("paymentMethods", {
      tenantId: subscription.tenantId,
      stripePaymentMethodId: pm.id,
      type: pm.type,
      cardBrand: pm.card?.brand,
      cardLast4: pm.card?.last4,
      cardExpMonth: pm.card?.exp_month,
      cardExpYear: pm.card?.exp_year,
      isDefault: false,
      metadata: pm.metadata,
    });
  } else if (eventType === "payment_method.detached") {
    await ctx.db
      .query("paymentMethods")
      .withIndex("by_stripe_pm", (q) => q.eq("stripePaymentMethodId", pm.id))
      .unique()
      .then((pm) => pm && ctx.db.delete(pm._id));
  }
}

export const getPaymentMethods = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    return await ctx.db
      .query("paymentMethods")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

export const setDefaultPaymentMethod = mutation({
  args: { tenantId: v.id("tenants"), paymentMethodId: v.string() },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    
    // Reset all to non-default
    const methods = await ctx.db
      .query("paymentMethods")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    for (const pm of methods) {
      await ctx.db.patch(pm._id, { isDefault: pm._id === args.paymentMethodId });
    }
  },
});

export const checkPlanLimits = query({
  args: { tenantId: v.id("tenants"), feature: v.union(v.literal("configurators"), v.literal("quotes"), v.literal("team_members"), v.literal("white_label"), v.literal("custom_domain"), v.literal("api_access"), v.literal("priority_support")) },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();

    const plan = subscription?.plan || "freemium";
    const limits = planLimits(plan);

    let current = 0;
    let limit = 0;

    switch (args.feature) {
      case "configurators":
        current = await ctx.db.query("configurators").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).filter((q) => q.neq(q.field("status"), "archived")).collect().then((r) => r.length);
        limit = limits.maxConfigurators;
        break;
      case "quotes":
        const period = new Date().toISOString().slice(0, 7);
        const counter = await ctx.db.query("usageCounters").withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId).eq("period", period)).unique();
        current = counter?.quoteRequestsCount || 0;
        limit = limits.maxQuotesPerMonth;
        break;
      case "team_members":
        current = await ctx.db.query("memberships").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).filter((q) => q.eq(q.field("status"), "active")).collect().then((r) => r.length);
        limit = limits.maxTeamMembers;
        break;
      case "white_label":
        return { allowed: limits.whiteLabel, limit: limits.whiteLabel ? 1 : 0, current: 0 };
      case "custom_domain":
        return { allowed: limits.customDomain, limit: limits.customDomain ? 1 : 0, current: 0 };
      case "api_access":
        return { allowed: limits.apiAccess, limit: limits.apiAccess ? 1 : 0, current: 0 };
      case "priority_support":
        return { allowed: limits.prioritySupport, limit: limits.prioritySupport ? 1 : 0, current: 0 };
    }

    return {
      allowed: limit === -1 || current < limit,
      limit,
      current,
    };
  },
});