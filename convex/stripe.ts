import { action } from "./_generated/server";
import { v } from "convex/values";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe integration disabled");
}

async function stripeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string
) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": "2024-06-20",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const formBody = body
    ? new URLSearchParams(body as Record<string, string>).toString()
    : "";

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    body: formBody,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Stripe error: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data;
}

export const createStripeCustomer = action({
  args: { email: v.string(), name: v.optional(v.string()), metadata: v.optional(v.any()) },
  handler: async (_, args) => {
    const body: Record<string, string> = { email: args.email };
    if (args.name) body.name = args.name;
    if (args.metadata) body.metadata = JSON.stringify(args.metadata);
    return stripeRequest("POST", "/customers", body);
  },
});

export const createStripeSubscription = action({
  args: {
    customerId: v.string(),
    priceId: v.string(),
    trialDays: v.optional(v.number()),
    metadata: v.optional(v.any()),
    paymentMethodId: v.optional(v.string()),
  },
  handler: async (_, args) => {
    const body: Record<string, string> = {
      customer: args.customerId,
      "items[0][price]": args.priceId,
      "payment_behavior": "default_incomplete",
      "payment_settings[save_default_payment_method]": "on_subscription",
      "expand[]": "latest_invoice.payment_intent",
    };

    if (args.trialDays && args.trialDays > 0) {
      body.trial_period_days = String(args.trialDays);
    }

    if (args.paymentMethodId) {
      body.default_payment_method = args.paymentMethodId;
    }

    if (args.metadata) {
      body.metadata = JSON.stringify(args.metadata);
    }

    return stripeRequest("POST", "/subscriptions", body);
  },
});

export const cancelStripeSubscription = action({
  args: { subscriptionId: v.string(), cancelAtPeriodEnd: v.optional(v.boolean()) },
  handler: async (_, args) => {
    if (args.cancelAtPeriodEnd) {
      return stripeRequest("POST", `/subscriptions/${args.subscriptionId}`, {
        cancel_at_period_end: "true",
      });
    }
    return stripeRequest("DELETE", `/subscriptions/${args.subscriptionId}`);
  },
});

export const updateStripeSubscription = action({
  args: {
    subscriptionId: v.string(),
    priceId: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
    prorationBehavior: v.optional(v.union(v.literal("create_prorations"), v.literal("none"), v.literal("always_invoice"))),
  },
  handler: async (_, args) => {
    const body: Record<string, string> = {};
    if (args.priceId) body["items[0][price]"] = args.priceId;
    if (args.cancelAtPeriodEnd !== undefined) body.cancel_at_period_end = String(args.cancelAtPeriodEnd);
    if (args.prorationBehavior) body.proration_behavior = args.prorationBehavior;
    if (args.metadata) body.metadata = JSON.stringify(args.metadata);
    return stripeRequest("POST", `/subscriptions/${args.subscriptionId}`, body);
  },
});

export const createStripePortalSession = action({
  args: { customerId: v.string(), returnUrl: v.string() },
  handler: async (_, args) => {
    return stripeRequest("POST", "/billing_portal/sessions", {
      customer: args.customerId,
      return_url: args.returnUrl,
    });
  },
});

export const createStripeCheckoutSession = action({
  args: {
    customerId: v.optional(v.string()),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
    trialDays: v.optional(v.number()),
    metadata: v.optional(v.any()),
    mode: v.union(v.literal("subscription"), v.literal("payment")),
  },
  handler: async (_, args) => {
    const body: Record<string, string> = {
      "line_items[0][price]": args.priceId,
      "line_items[0][quantity]": "1",
      mode: args.mode,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    };

    if (args.customerId) body.customer = args.customerId;
    if (args.trialDays && args.trialDays > 0) {
      body.subscription_data = JSON.stringify({ trial_period_days: args.trialDays });
    }
    if (args.metadata) body.metadata = JSON.stringify(args.metadata);

    return stripeRequest("POST", "/checkout/sessions", body);
  },
});

export const getStripeSubscription = action({
  args: { subscriptionId: v.string() },
  handler: async (_, args) => {
    return stripeRequest("GET", `/subscriptions/${args.subscriptionId}`);
  },
});

export const getStripeCustomer = action({
  args: { customerId: v.string() },
  handler: async (_, args) => {
    return stripeRequest("GET", `/customers/${args.customerId}`);
  },
});

export const listStripePaymentMethods = action({
  args: { customerId: v.string(), type: v.optional(v.string()) },
  handler: async (_, args) => {
    const params = new URLSearchParams({ customer: args.customerId });
    if (args.type) params.append("type", args.type);
    return stripeRequest("GET", `/payment_methods?${params.toString()}`);
  },
});

export const attachPaymentMethod = action({
  args: { paymentMethodId: v.string(), customerId: v.string() },
  handler: async (_, args) => {
    return stripeRequest("POST", `/payment_methods/${args.paymentMethodId}/attach`, {
      customer: args.customerId,
    });
  },
});

export const detachPaymentMethod = action({
  args: { paymentMethodId: v.string() },
  handler: async (_, args) => {
    return stripeRequest("POST", `/payment_methods/${args.paymentMethodId}/detach`);
  },
});

export const createSetupIntent = action({
  args: { customerId: v.string(), usage: v.optional(v.union(v.literal("on_session"), v.literal("off_session"))) },
  handler: async (_, args) => {
    const body: Record<string, string> = { customer: args.customerId };
    if (args.usage) body.usage = args.usage;
    return stripeRequest("POST", "/setup_intents", body);
  },
});

export const retrieveInvoice = action({
  args: { invoiceId: v.string() },
  handler: async (_, args) => {
    return stripeRequest("GET", `/invoices/${args.invoiceId}`);
  },
});

export const listInvoices = action({
  args: { customerId: v.string(), limit: v.optional(v.number()), status: v.optional(v.string()) },
  handler: async (_, args) => {
    const params = new URLSearchParams({ customer: args.customerId });
    if (args.limit) params.append("limit", String(args.limit));
    if (args.status) params.append("status", args.status);
    return stripeRequest("GET", `/invoices?${params.toString()}`);
  },
});