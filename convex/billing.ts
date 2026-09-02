import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireMembership } from "./lib/auth";
import { resolveTenantEntitlements } from "./lib/entitlements";
import {
  BILLING_PLANS,
  ALPHA_DISCOUNT_PCT,
  billingPlan,
  effectivePriceCents,
} from "./lib/billingPlans";

const STRIPE_API = "https://api.stripe.com/v1";
const stripeKey = () => process.env.STRIPE_SECRET_KEY ?? "";
const siteUrl = () => process.env.SITE_URL ?? "";

function form(data: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(data)) if (val !== undefined) p.set(k, val);
  return p.toString();
}

async function stripe(path: string, body: Record<string, string | undefined>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message ?? "STRIPE_ERROR";
    throw new ConvexError(`STRIPE: ${msg}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export const getBillingState = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    const configured = !!process.env.STRIPE_SECRET_KEY;
    return {
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      isAlpha: tenant.isAlpha,
      alphaDiscountLocked: tenant.alphaDiscountLocked,
      alphaDiscountPct: ALPHA_DISCOUNT_PCT,
      entitlements: resolveTenantEntitlements(tenant),
      subscription: tenant.stripeSubscriptionId
        ? {
            currentPeriodEnd: tenant.subscriptionCurrentPeriodEnd ?? null,
            cancelAtPeriodEnd: tenant.subscriptionCancelAtPeriodEnd ?? false,
          }
        : null,
      checkoutAvailable: configured,
      portalAvailable: configured && !!tenant.stripeCustomerId,
      plans: BILLING_PLANS.map((p) => ({
        key: p.key,
        name: p.name,
        priceCents: p.priceCents,
        yourPriceCents: effectivePriceCents(p.key, tenant.isAlpha),
      })),
    };
  },
});

export const assertOwner = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx, args.tenantId);
    if (membership.role !== "owner") throw new ConvexError("OWNER_ONLY");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    return {
      email: (await ctx.db.get(membership.userId))?.email ?? undefined,
      stripeCustomerId: tenant.stripeCustomerId,
      slug: tenant.slug,
    };
  },
});

// ---------------------------------------------------------------------------
// Checkout / portal (dormant until STRIPE_SECRET_KEY is set)
// ---------------------------------------------------------------------------

export const createCheckoutSession = action({
  args: { tenantId: v.id("tenants"), plan: v.union(v.literal("starter"), v.literal("business")) },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const plan = billingPlan(args.plan);
    const priceId = plan?.stripePriceEnv ? process.env[plan.stripePriceEnv] : undefined;
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });

    const session = await stripe("/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer: owner.stripeCustomerId,
      customer_email: owner.stripeCustomerId ? undefined : owner.email,
      client_reference_id: args.tenantId,
      "subscription_data[metadata][tenantId]": args.tenantId,
      success_url: `${siteUrl()}/app/account/billing?status=success`,
      cancel_url: `${siteUrl()}/app/account/billing?status=cancelled`,
      allow_promotion_codes: "true",
    });
    return { url: String(session.url) };
  },
});

export const createPortalSession = action({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    if (!owner.stripeCustomerId) throw new ConvexError("NO_SUBSCRIPTION");

    const session = await stripe("/billing_portal/sessions", {
      customer: owner.stripeCustomerId,
      return_url: `${siteUrl()}/app/account/billing`,
    });
    return { url: String(session.url) };
  },
});

// ---------------------------------------------------------------------------
// Webhook application
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe-Signature header without the SDK.
 * Header format: `t=<unix>,v1=<hex hmac sha256 of "t.payload">`.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  const given = parts.v1 ?? "";
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export const applyWebhookEvent = internalMutation({
  args: { eventId: v.string(), type: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query("billingEvents")
      .withIndex("by_event", (q) => q.eq("stripeEventId", args.eventId))
      .unique();
    if (seen) return { duplicate: true };

    const obj = (args.data?.object ?? {}) as Record<string, unknown>;
    const claimedTenantId =
      (obj.client_reference_id as string | undefined) ??
      ((obj.metadata as Record<string, string> | undefined)?.tenantId);

    // Resolve the tenant. A forged (but signed) event could carry a bogus
    // client_reference_id, so we only trust it when it maps to a real tenant
    // whose stripe customer matches — otherwise fall back to the customer id.
    const customerId = obj.customer as string | undefined;
    let tenantId: string | undefined;

    const byCustomer = customerId
      ? await ctx.db
          .query("tenants")
          .withIndex("by_stripeCustomer", (q) => q.eq("stripeCustomerId", customerId))
          .first()
      : null;

    if (byCustomer) {
      tenantId = byCustomer._id;
    } else if (claimedTenantId) {
      const claimed = ctx.db.normalizeId("tenants", claimedTenantId);
      if (claimed) {
        const t = await ctx.db.get(claimed);
        // First subscription for this tenant: no customer id stored yet.
        if (t && (!t.stripeCustomerId || t.stripeCustomerId === customerId)) tenantId = t._id;
      }
    }

    if (tenantId) {
      const tenant = await ctx.db.get(tenantId as never);
      if (tenant) {
        const patch: Record<string, unknown> = {};
        if (customerId) patch.stripeCustomerId = customerId;

        if (args.type === "checkout.session.completed") {
          patch.stripeSubscriptionId = obj.subscription as string;
          patch.planStatus = "active";
        }
        if (args.type.startsWith("customer.subscription")) {
          patch.stripeSubscriptionId = obj.id as string;
          const status = obj.status as string;
          patch.planStatus =
            status === "active" || status === "trialing"
              ? status
              : status === "past_due" || status === "unpaid"
                ? "past_due"
                : "suspended";
          if (typeof obj.current_period_end === "number")
            patch.subscriptionCurrentPeriodEnd = obj.current_period_end * 1000;
          patch.subscriptionCancelAtPeriodEnd = !!obj.cancel_at_period_end;

          const priceId = (
            (obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data?.[0]?.price
              ?.id
          ) as string | undefined;
          for (const p of BILLING_PLANS) {
            if (p.stripePriceEnv && priceId && process.env[p.stripePriceEnv] === priceId) {
              patch.plan = p.key;
            }
          }
          if (args.type === "customer.subscription.deleted") {
            patch.planStatus = "suspended";
          }
        }
        await ctx.db.patch(tenantId as never, patch);
      }
    }

    await ctx.db.insert("billingEvents", {
      stripeEventId: args.eventId,
      type: args.type,
      tenantId: (tenantId as never) ?? undefined,
      payloadSummary: { customer: customerId, subscription: obj.subscription ?? obj.id },
      receivedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      tenantId: (tenantId as never) ?? undefined,
      actorKind: "system",
      action: `billing.${args.type}`,
      targetTable: "tenants",
      targetId: tenantId,
      createdAt: Date.now(),
    });
    return { duplicate: false };
  },
});

/** Daily cron target — a no-op while Stripe is not configured. */
export const reconcile = internalAction({
  handler: async () => {
    if (!stripeKey()) return { skipped: "BILLING_NOT_CONFIGURED" };
    // Placeholder for a future subscription re-sync sweep.
    return { skipped: false };
  },
});
