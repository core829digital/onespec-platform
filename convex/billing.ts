import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireMembership } from "./lib/auth";
import { resolveTenantEntitlements } from "./lib/entitlements";
import {
  BILLING_PLANS,
  listPriceCents,
  resolveStripePriceId,
  planFromStripePriceId,
  type BillingCycle,
} from "./lib/billingPlans";
import { regionForCountry } from "./lib/regions";
import { createPostHogClient } from "./lib/posthog";

const STRIPE_API = "https://api.stripe.com/v1";
const stripeKey = () => process.env.STRIPE_SECRET_KEY ?? "";
const siteUrl = () => process.env.SITE_URL ?? "";

/**
 * Origin Stripe sends the customer back to. The client may ask for the origin
 * it is browsing on (custom domain vs *.vercel.app), because session cookies
 * are per-origin: returning to a different host would look like a logout. It is
 * honoured ONLY if it is in the allowlist (SITE_URL + ALLOWED_APP_ORIGINS,
 * comma-separated) — anything else falls back to SITE_URL, so this can never
 * become an open redirect.
 */
export function appOrigin(requested?: string): string {
  const norm = (u: string) => u.trim().replace(/\/+$/, "");
  const base = norm(siteUrl());
  const allowed = new Set(
    [base, ...(process.env.ALLOWED_APP_ORIGINS ?? "").split(",").map(norm)].filter(Boolean),
  );
  const asked = requested ? norm(requested) : "";
  return asked && allowed.has(asked) ? asked : base;
}

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

async function stripeGet(path: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
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
    const region = regionForCountry(tenant.country).code;
    return {
      plan: tenant.plan,
      region,
      planStatus: tenant.planStatus,
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
        priceCents: listPriceCents(p.key, region),
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
      userId: membership.userId,
      email: (await ctx.db.get(membership.userId))?.email ?? undefined,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      plan: tenant.plan,
      slug: tenant.slug,
      country: tenant.country ?? null,
      trialStartedAt: tenant.trialStartedAt ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Checkout / portal (dormant until STRIPE_SECRET_KEY is set)
// ---------------------------------------------------------------------------

export const createCheckoutSession = action({
  args: {
    tenantId: v.id("tenants"),
    plan: v.union(v.literal("base"), v.literal("pro"), v.literal("agency")),
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const planKey = args.plan;
    const cycle: BillingCycle = args.cycle ?? "monthly";

    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    const region = regionForCountry(owner.country).code;
    const priceId = resolveStripePriceId(planKey, cycle, region);
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const params: Record<string, string | undefined> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer: owner.stripeCustomerId,
      customer_email: owner.stripeCustomerId ? undefined : owner.email,
      client_reference_id: args.tenantId,
      "subscription_data[metadata][tenantId]": args.tenantId,
      "subscription_data[metadata][plan]": planKey,
      "subscription_data[metadata][cycle]": cycle,
      "subscription_data[metadata][ownerUserId]": owner.userId,
      success_url: `${appOrigin(args.origin)}/app/account/billing?status=success`,
      cancel_url: `${appOrigin(args.origin)}/app/account/billing?status=cancelled`,
      allow_promotion_codes: "true",
      ui_mode: "hosted_page",
      billing_address_collection: "required",
      "phone_number_collection[enabled]": "true",
      "automatic_tax[enabled]": "true",
      payment_method_collection: "always",
      submit_type: "auto",
      "tax_id_collection[enabled]": "true",
      "tax_id_collection[required]": "never",
      "consent_collection[terms_of_service]": "required",      "name_collection[individual][enabled]": "true",
      "name_collection[individual][optional]": "true",
      "name_collection[business][enabled]": "true",
      "name_collection[business][optional]": "true",
      "saved_payment_method_options[payment_method_save]": "enabled",
      integration_identifier: "hosted_web_0002",
      origin_context: "web",
    };

    // Pro-only 14-day trial: the card is captured up front and Stripe
    // auto-converts at trial end (no trial = immediate charge).
    if (planKey === "pro" && !owner.trialStartedAt) {
      params["subscription_data[trial_period_days]"] = "14";
      params["payment_method_collection"] = "always";
      params["subscription_data[metadata][trialPlan]"] = "pro";
    }

    const session = await stripe("/checkout/sessions", params);
    const posthog = createPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: String(owner.userId),
        event: "checkout_started",
        properties: {
          tenant_id: String(args.tenantId),
          plan: planKey,
          billing_cycle: cycle,
          region,
          includes_trial: planKey === "pro" && !owner.trialStartedAt,
        },
      });
      await posthog.shutdown();
    }
    return { url: String(session.url) };
  },
});

export const createPortalSession = action({
  args: { tenantId: v.id("tenants"), origin: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    if (!owner.stripeCustomerId) throw new ConvexError("NO_SUBSCRIPTION");

    const session = await stripe("/billing_portal/sessions", {
      customer: owner.stripeCustomerId,
      return_url: `${appOrigin(args.origin)}/app/account/billing`,
    });
    return { url: String(session.url) };
  },
});

/**
 * Resolve the current subscription's single item id — needed by Stripe to
 * swap its price. Not stored locally (it can change independently of the
 * subscription id), so this always reads it fresh from Stripe.
 */
async function currentSubscriptionItemId(subscriptionId: string): Promise<string> {
  const sub = await stripeGet(`/subscriptions/${subscriptionId}`);
  const itemId = (sub.items as { data?: Array<{ id?: string }> } | undefined)?.data?.[0]?.id;
  if (!itemId) throw new ConvexError("NO_SUBSCRIPTION_ITEM");
  return itemId;
}

/**
 * Preview the immediate, prorated charge for switching to `plan`/`cycle` —
 * Stripe computes this from the price difference and the days left in the
 * current billing period, without charging anything yet.
 */
export const previewPlanChange = action({
  args: {
    tenantId: v.id("tenants"),
    plan: v.union(v.literal("base"), v.literal("pro"), v.literal("agency")),
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (ctx, args): Promise<{ amountDueCents: number; currency: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");

    const cycle: BillingCycle = args.cycle ?? "monthly";
    const region = regionForCountry(owner.country).code;
    const priceId = resolveStripePriceId(args.plan, cycle, region);
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const itemId = await currentSubscriptionItemId(owner.stripeSubscriptionId);
    const preview = await stripeGet(
      `/invoices/upcoming?${form({
        subscription: owner.stripeSubscriptionId,
        "subscription_items[0][id]": itemId,
        "subscription_items[0][price]": priceId,
        subscription_proration_behavior: "always_invoice",
      })}`,
    );
    return {
      amountDueCents: Number(preview.amount_due ?? 0),
      currency: String(preview.currency ?? "eur").toUpperCase(),
    };
  },
});

/**
 * Switch the subscription to `plan`/`cycle` right now. `proration_behavior:
 * always_invoice` makes Stripe charge exactly the price difference prorated
 * by the days remaining in the current period — never the new plan's full
 * price — and issues the invoice immediately.
 */
export const changePlan = action({
  args: {
    tenantId: v.id("tenants"),
    plan: v.union(v.literal("base"), v.literal("pro"), v.literal("agency")),
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");

    const cycle: BillingCycle = args.cycle ?? "monthly";
    const region = regionForCountry(owner.country).code;
    const priceId = resolveStripePriceId(args.plan, cycle, region);
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const itemId = await currentSubscriptionItemId(owner.stripeSubscriptionId);
    await stripe(`/subscriptions/${owner.stripeSubscriptionId}`, {
      "items[0][id]": itemId,
      "items[0][price]": priceId,
      proration_behavior: "always_invoice",
      "metadata[plan]": args.plan,
      "metadata[cycle]": cycle,
    });
    // The webhook (customer.subscription.updated) applies the plan/cycle
    // patch to the tenant once Stripe confirms it — not done optimistically
    // here, to stay the single source of truth for entitlements.
    return { ok: true };
  },
});

/** Cancel at the end of the current billing period — access continues until then. */
export const cancelSubscription = action({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");

    await stripe(`/subscriptions/${owner.stripeSubscriptionId}`, {
      cancel_at_period_end: "true",
    });
    return { ok: true };
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
  if (!header || !secret || header.length > 1024) return false;

  // Parse `t=<unix>,v1=<sig>[,v1=<sig>...]`. Stripe sends several v1 entries
  // while a signing secret is being rolled, so collect all of them (the old
  // Object.fromEntries kept only the last). v0 (test-only) entries are ignored.
  let ts = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    if (k === "t") ts = val;
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(val)) sigs.push(val.toLowerCase());
  }
  const t = Number(ts);
  if (!/^\d{9,12}$/.test(ts) || !Number.isFinite(t) || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)),
  );
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time compare against every candidate; don't short-circuit.
  let match = false;
  for (const given of sigs) {
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
    if (diff === 0) match = true;
  }
  return match;
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
        const tenantDoc =
          "plan" in tenant ? (tenant as unknown as import("./_generated/dataModel").Doc<"tenants">) : null;
        const patch: Record<string, unknown> = {};
        if (customerId) patch.stripeCustomerId = customerId;

        if (args.type === "checkout.session.completed") {
          patch.stripeSubscriptionId = obj.subscription as string;
          patch.planStatus = "active";
          const meta = (obj.metadata ?? {}) as Record<string, string>;
          if (meta.trialPlan === "pro") {
            patch.plan = "pro";
            patch.trialPlan = "pro";
            patch.trialStartedAt = Date.now();
          }
          if (meta.cycle === "annual" || meta.cycle === "monthly") {
            patch.billingCycle = meta.cycle;
          }
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

          if (typeof obj.trial_start === "number" && !tenantDoc?.trialStartedAt) {
            patch.trialStartedAt = obj.trial_start * 1000;
          }
          if (typeof obj.trial_end === "number") {
            patch.trialEndsAt = obj.trial_end * 1000;
            patch.trialPlan = "pro";
          }
          // Trial converted: clear the countdown.
          if (status === "active") patch.trialEndsAt = undefined;

          const priceId = (
            (obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data?.[0]?.price
              ?.id
          ) as string | undefined;
          if (priceId) {
            const mapped = planFromStripePriceId(priceId);
            if (mapped && (mapped.plan === "base" || mapped.plan === "pro" || mapped.plan === "agency")) {
              patch.plan = mapped.plan;
              patch.billingCycle = mapped.cycle;
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

/**
 * Safety net for expired trials (daily cron). Stripe-managed trials convert
 * or fail via webhook; this only flips abandoned pre-Stripe rows to past_due
 * and notifies once, so a lapsed trial can never silently keep Pro access.
 */
export const trialSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const trialing = await ctx.db
      .query("tenants")
      .withIndex("by_planStatus", (q) => q.eq("planStatus", "trialing"))
      .collect();
    let swept = 0;
    for (const t of trialing) {
      if (t.stripeSubscriptionId) {
        // Stripe-owned: webhook converts or fails it. Only escalate when the
        // trial end is 3+ days stale and Stripe never reported back.
        if (t.trialEndsAt && t.trialEndsAt < now - 3 * 24 * 60 * 60 * 1000) {
          await ctx.db.patch(t._id, { planStatus: "past_due", updatedAt: Date.now() });
          await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
            tenantId: t._id,
            type: "plan_limit",
            data: { message: "Trial sync overdue — check the subscription status." },
            href: `/app/account/billing`,
          });
          swept++;
        }
        continue;
      }
      if (t.trialEndsAt && t.trialEndsAt < now) {
        await ctx.db.patch(t._id, { planStatus: "past_due", updatedAt: Date.now() });
        await ctx.db.insert("auditLog", {
          tenantId: t._id,
          actorKind: "system",
          action: "trial.expired",
          targetTable: "tenants",
          targetId: t._id,
          createdAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.notifications.fanOutToTenant, {
          tenantId: t._id,
          type: "plan_limit",
          data: { message: "Pro trial ended — choose a plan to keep Pro features." },
          href: `/app/account/billing`,
        });
        swept++;
      }
    }
    return { swept };
  },
});
