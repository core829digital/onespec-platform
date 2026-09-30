import { action, internalAction, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireMembership } from "./lib/auth";
import { entitlementsFor, isWidgetPlan as isWidgetPlanKey, resolveTenantEntitlements } from "./lib/entitlements";
import {
  BILLING_PLANS,
  SELF_SERVE_PLANS,
  listPriceCents,
  resolveStripePriceId,
  planFromStripePriceId,
  type BillablePlan,
  type BillingCycle,
} from "./lib/billingPlans";
import { unlockOnPlanChange, unlockOnReactivation } from "./usage";
import { regionForCountry } from "./lib/regions";
import { createPostHogClient } from "./lib/posthog";

const STRIPE_API = "https://api.stripe.com/v1";

/** Self-serve plans, both families (widget-first first). */
const selfServePlan = v.union(
  v.literal("essentials"),
  v.literal("essentials_plus"),
  v.literal("max"),
  v.literal("base"),
  v.literal("pro"),
  v.literal("agency"),
);

function isSelfServePlan(plan: unknown): plan is BillablePlan {
  return typeof plan === "string" && (SELF_SERVE_PLANS as readonly string[]).includes(plan);
}

/** Annual billing only where the plan offers it (never on the widget-first plans or Agency). */
function assertCycleAllowed(plan: BillablePlan, cycle: BillingCycle): void {
  if (cycle === "annual" && !entitlementsFor(plan).annualBilling) throw new ConvexError("ANNUAL_NOT_AVAILABLE");
}
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

async function stripeDelete(path: string, body: Record<string, string | undefined> = {}) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "DELETE",
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

/**
 * Per-tenant token bucket on every billing action: they all call the Stripe
 * API (cost + abuse surface) and are owner-only, so legitimate use is a few
 * calls per session. Throws RATE_LIMITED, which the UI already maps.
 */
const BILLING_LIMITS: Record<string, { tokens: number; refillMs: number }> = {
  checkout: { tokens: 10, refillMs: 10 * 60 * 1000 },
  portal: { tokens: 10, refillMs: 10 * 60 * 1000 },
  preview: { tokens: 20, refillMs: 10 * 60 * 1000 },
  change: { tokens: 5, refillMs: 10 * 60 * 1000 },
  cancel: { tokens: 5, refillMs: 10 * 60 * 1000 },
  sync: { tokens: 20, refillMs: 10 * 60 * 1000 },
};

async function limitBilling(ctx: ActionCtx, tenantId: string, kind: keyof typeof BILLING_LIMITS & string) {
  try {
    await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
      bucketKey: `billing:${kind}:${tenantId}`,
      ...BILLING_LIMITS[kind],
    });
  } catch {
    throw new ConvexError("RATE_LIMITED");
  }
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
      // Only Pro carries a trial (entitlements.ts trialEligible) — enforced
      // server-side in subscriptionPatch below, so planStatus === "trialing"
      // implies plan === "pro" by construction. Exposed separately from
      // `subscription` since a trial can be in flight before Stripe reports
      // a period end.
      trial:
        tenant.planStatus === "trialing" && tenant.trialStartedAt && tenant.trialEndsAt
          ? {
              startedAt: tenant.trialStartedAt,
              endsAt: tenant.trialEndsAt,
              daysElapsed: Math.max(0, Math.floor((Date.now() - tenant.trialStartedAt) / 86_400_000)),
              daysRemaining: Math.max(0, Math.ceil((tenant.trialEndsAt - Date.now()) / 86_400_000)),
            }
          : null,
      // Stripe Customer.balance mirror, Stripe's own sign convention:
      // negative = credit owed TO the tenant (e.g. a downgrade's unused-time
      // proration), positive = the tenant owes more. Normally only nonzero
      // right after a paid (non-trialing) downgrade — see the header badge.
      platformBalanceCents: tenant.stripeBalanceCents ?? 0,
      checkoutAvailable: configured,
      portalAvailable: configured && !!tenant.stripeCustomerId,
      /** The one-time Pro trial was already used (the CTA must not promise it again). */
      trialUsed: !!tenant.trialStartedAt,
      // Widget-first plans first, then the full platform (BILLING_PLANS order).
      plans: BILLING_PLANS.map((p) => ({
        key: p.key,
        name: p.name,
        family: p.family,
        priceCents: listPriceCents(p.key, region),
        annualBilling: p.key === "enterprise" ? false : entitlementsFor(p.key).annualBilling,
      })),
    };
  },
});

/**
 * Lightweight platform-balance read for the app-wide header badge — every
 * page needs this, not just the billing page, so it skips the
 * entitlements/plans work getBillingState does. Same Stripe
 * Customer.balance mirror (negative = credit).
 */
export const getPlatformBalance = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    return {
      balanceCents: tenant.stripeBalanceCents ?? 0,
      // Whether this tenant has a real Stripe Customer at all — the
      // precondition for a balance existing in the first place. A dormant
      // (pre-Stripe / trialing / founder unlimitedAccess) tenant has none,
      // so the header badge stays hidden for those instead of showing a
      // meaningless "€0.00" — but for anyone who's actually gone through
      // checkout, the badge is always visible (even at exactly €0.00) so
      // it's discoverable instead of only appearing the one time it's
      // nonzero.
      hasBilling: !!tenant.stripeCustomerId,
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
      planStatus: tenant.planStatus,
      slug: tenant.slug,
      country: tenant.country ?? null,
      trialStartedAt: tenant.trialStartedAt ?? null,
      // Bounded: only compared against a widget-first plan's seat cap (≤ 3).
      activeMembers: (
        await ctx.db
          .query("memberships")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .filter((q) => q.eq(q.field("status"), "active"))
          .take(100)
      ).length,
    };
  },
});

/**
 * Moving INTO a widget-first plan with more active members than its seats
 * would leave the tenant over its limit: refuse and ask to remove members
 * first. (Full-platform targets keep today's behaviour.)
 */
function assertSeatsFit(plan: BillablePlan, activeMembers: number): void {
  if (!isWidgetPlanKey(plan)) return;
  if (activeMembers > entitlementsFor(plan).maxTeamMembers) throw new ConvexError("TEAM_EXCEEDS_TARGET_PLAN");
}

// ---------------------------------------------------------------------------
// Checkout / portal (dormant until STRIPE_SECRET_KEY is set)
// ---------------------------------------------------------------------------

export const createCheckoutSession = action({
  args: {
    tenantId: v.id("tenants"),
    plan: selfServePlan,
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const planKey = args.plan;
    const cycle: BillingCycle = args.cycle ?? "monthly";

    assertCycleAllowed(planKey, cycle);
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    await limitBilling(ctx, args.tenantId, "checkout");
    // A second Checkout would open a SECOND subscription (double billing):
    // a tenant with a live subscription switches plan via changePlan.
    if (owner.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(owner.planStatus)) {
      throw new ConvexError("ALREADY_SUBSCRIBED");
    }
    assertSeatsFit(planKey, owner.activeMembers);
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
      // Session-level metadata too: checkout.session.completed only carries
      // the session's own metadata, not subscription_data's.
      "metadata[tenantId]": args.tenantId,
      "metadata[plan]": planKey,
      "metadata[cycle]": cycle,
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
      params["metadata[trialPlan]"] = "pro";
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
    await limitBilling(ctx, args.tenantId, "portal");
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
    plan: selfServePlan,
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    amountDueCents: number;
    totalCents: number;
    totalExcludingTaxCents: number;
    currency: string;
    endsTrial: boolean;
  }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    await limitBilling(ctx, args.tenantId, "preview");
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");
    assertSeatsFit(args.plan, owner.activeMembers);

    const cycle: BillingCycle = args.cycle ?? "monthly";
    assertCycleAllowed(args.plan, cycle);
    const region = regionForCountry(owner.country).code;
    const priceId = resolveStripePriceId(args.plan, cycle, region);
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const itemId = await currentSubscriptionItemId(owner.stripeSubscriptionId);
    // Any plan switch during a trial ends the trial immediately (see
    // changePlan below) — preview it the same way, or the amount shown here
    // (still trial-shielded) would understate what actually gets charged.
    const endingTrial = owner.planStatus === "trialing";
    // GET /invoices/upcoming was removed by Stripe; create_preview replaces it.
    const preview = await stripe("/invoices/create_preview", {
      subscription: owner.stripeSubscriptionId,
      "subscription_details[items][0][id]": itemId,
      "subscription_details[items][0][price]": priceId,
      "subscription_details[proration_behavior]": "always_invoice",
      ...(endingTrial ? { "subscription_details[trial_end]": "now" } : {}),
    });
    return { ...previewAmounts(preview), endsTrial: endingTrial };
  },
});

/**
 * Pure extraction of the 3 money fields from a Stripe preview-invoice
 * response — split out from previewPlanChange so it's unit-testable without
 * a live Stripe call (see tests/convex/billing.test.ts, using the exact
 * response captured from a real downgrade preview against this platform's
 * production Stripe account on 2026-09-28).
 */
export function previewAmounts(preview: Record<string, unknown>): {
  amountDueCents: number;
  totalCents: number;
  totalExcludingTaxCents: number;
  currency: string;
} {
  return {
    // What gets charged to the card RIGHT NOW. Stripe invoices can never
    // have a negative amount_due (it floors at 0) — this field alone
    // CANNOT represent a downgrade credit, only ever "will I be charged
    // today, and how much". Verified live against Stripe: a real downgrade
    // preview on this platform returned amount_due=0 while total=-12197
    // (a real -121.97€ credit) — reading amount_due alone for the credit
    // case is the bug this fixes.
    amountDueCents: Number(preview.amount_due ?? 0),
    // Total after tax, NOT floored — negative means a net credit that
    // Stripe will move onto the Customer's balance (see `ending_balance`
    // on this same preview, which mirrors this value) instead of charging
    // anything. This is the field to branch the UI message on, not
    // amount_due.
    totalCents: Number(preview.total ?? preview.amount_due ?? 0),
    // Same as totalCents but net of VAT. The platform-balance credit shown
    // to the user (see setup-guide/header badge) is tracked net of VAT —
    // VAT is a pass-through tax collected on behalf of the tax authority,
    // not platform revenue, so it is not "service value" owed back to the
    // tenant; the gross figure (totalCents) is what Stripe actually
    // applies to the Customer balance and is used for the Stripe-side
    // bookkeeping, while this ex-VAT figure is what's communicated as
    // "credit for service".
    totalExcludingTaxCents: Number(
      preview.total_excluding_tax ?? preview.total ?? preview.amount_due ?? 0,
    ),
    currency: String(preview.currency ?? "eur").toUpperCase(),
  };
}

/**
 * Switch the subscription to `plan`/`cycle` right now. `proration_behavior:
 * always_invoice` makes Stripe charge exactly the price difference prorated
 * by the days remaining in the current period — never the new plan's full
 * price — and issues the invoice immediately.
 *
 * Trial abuse guard: only Pro carries a trial (entitlements.ts
 * `trialEligible`). Without this, a tenant on a trialing Pro subscription
 * could switch to Agency (or down to Base) mid-trial and keep the free ride
 * for whatever's left of the 14 days — the item price changes, but nothing
 * un-trials the subscription, so Stripe keeps billing nothing until the
 * original trial_end. Any plan switch while trialing now ends the trial in
 * the very same call (`trial_end: "now"`), so the new plan is billed for
 * real, immediately — the person is warned of this exact amount beforehand
 * via previewPlanChange, which mirrors this with the same flag.
 */
export const changePlan = action({
  args: {
    tenantId: v.id("tenants"),
    plan: selfServePlan,
    cycle: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    await limitBilling(ctx, args.tenantId, "change");
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");
    assertSeatsFit(args.plan, owner.activeMembers);

    const cycle: BillingCycle = args.cycle ?? "monthly";
    assertCycleAllowed(args.plan, cycle);
    const region = regionForCountry(owner.country).code;
    const priceId = resolveStripePriceId(args.plan, cycle, region);
    if (!priceId) throw new ConvexError("BILLING_PRICE_NOT_CONFIGURED");

    const itemId = await currentSubscriptionItemId(owner.stripeSubscriptionId);
    await stripe(`/subscriptions/${owner.stripeSubscriptionId}`, {
      "items[0][id]": itemId,
      "items[0][price]": priceId,
      proration_behavior: "always_invoice",
      ...(owner.planStatus === "trialing" ? { trial_end: "now" } : {}),
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
    await limitBilling(ctx, args.tenantId, "cancel");
    if (!owner.stripeSubscriptionId) throw new ConvexError("NO_SUBSCRIPTION");

    const current = await stripeGet(`/subscriptions/${owner.stripeSubscriptionId}`);
    if (current.status === "canceled") {
      // Already ended in Stripe (double click, retry, or a lost webhook): just
      // bring the tenant in line with it.
      await ctx.runMutation(internal.billing.applySubscriptionSync, {
        tenantId: args.tenantId,
        subscription: current,
      });
      return { ok: true };
    }
    if (current.status === "trialing") {
      // Cancelling during the free trial ends access NOW. Nothing was paid, so
      // there is no "already paid period" to honour — keeping access until the
      // trial end would let anyone chain free trials across accounts.
      const ended = await stripeDelete(`/subscriptions/${owner.stripeSubscriptionId}`);
      try {
        await ctx.runMutation(internal.billing.applySubscriptionSync, {
          tenantId: args.tenantId,
          subscription: ended,
        });
      } catch (e) {
        // The customer.subscription.deleted webhook applies the same state.
        console.error("cancelSubscription: immediate sync failed", e instanceof Error ? e.message : e);
      }
      return { ok: true };
    }

    // Paid subscription: access stays until the end of the period already paid.
    await stripe(`/subscriptions/${owner.stripeSubscriptionId}`, {
      cancel_at_period_end: "true",
    });
    return { ok: true };
  },
});

/**
 * Re-read the tenant's subscription from Stripe and apply it. Safety net for
 * webhook delay/loss and the instant path after checkout / plan change: the
 * UI calls it on return from Stripe so the plan is correct without waiting.
 * Owner-only; only ever applies a subscription that is already linked to this
 * tenant (stored id) or stamped with this tenant's id in its metadata.
 */
export const syncSubscription = action({
  args: { tenantId: v.id("tenants") },
  handler: async (
    ctx,
    args,
  ): Promise<{ found: boolean; plan?: string; planStatus?: string }> => {
    if (!stripeKey()) throw new ConvexError("BILLING_NOT_CONFIGURED");
    const owner = await ctx.runQuery(internal.billing.assertOwner, { tenantId: args.tenantId });
    await limitBilling(ctx, args.tenantId, "sync");

    let sub: Record<string, unknown> | null = null;
    if (owner.stripeSubscriptionId) {
      sub = await stripeGet(`/subscriptions/${owner.stripeSubscriptionId}`);
    } else {
      // Webhook hasn't linked the subscription yet: find it by the tenant id we
      // stamped in its metadata at checkout.
      const query = encodeURIComponent(`metadata['tenantId']:'${args.tenantId}'`);
      const found = await stripeGet(`/subscriptions/search?query=${query}&limit=5`);
      const list = ((found.data as Array<Record<string, unknown>> | undefined) ?? []);
      const live = ["trialing", "active", "past_due"];
      sub = list.find((x) => live.includes(String(x.status))) ?? list[0] ?? null;
    }
    if (!sub) return { found: false };

    // Balance sync piggybacks on this same safety-net sweep — same
    // reasoning as the subscription fields above: the `customer.updated`
    // webhook is the primary path, this is the backstop for delay/loss. One
    // extra GET, only on the explicit "re-check with Stripe" path (rate
    // limited the same as the rest of this action), never on every render.
    const customerId = typeof sub.customer === "string" ? sub.customer : owner.stripeCustomerId;
    let balanceCents: number | undefined;
    if (customerId) {
      try {
        const customer = await stripeGet(`/customers/${customerId}`);
        if (typeof customer.balance === "number") balanceCents = customer.balance;
      } catch {
        /* non-fatal: balance sync is a nice-to-have, subscription sync above is the real safety net */
      }
    }

    const applied = await ctx.runMutation(internal.billing.applySubscriptionSync, {
      tenantId: args.tenantId,
      subscription: sub,
      balanceCents,
    });
    return { found: true, ...applied };
  },
});

export const applySubscriptionSync = internalMutation({
  args: { tenantId: v.id("tenants"), subscription: v.any(), balanceCents: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ plan: string; planStatus: string }> => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const sub = (args.subscription ?? {}) as Record<string, unknown>;
    const meta = (sub.metadata ?? {}) as Record<string, string>;
    const customer = typeof sub.customer === "string" ? sub.customer : undefined;
    const ownedById = !!tenant.stripeSubscriptionId && tenant.stripeSubscriptionId === sub.id;
    const ownedByMeta = meta.tenantId === String(tenant._id);
    if (!ownedById && !ownedByMeta) throw new ConvexError("SUBSCRIPTION_MISMATCH");
    if (tenant.stripeCustomerId && customer && tenant.stripeCustomerId !== customer) {
      throw new ConvexError("SUBSCRIPTION_MISMATCH");
    }
    const patch = subscriptionPatch(sub, tenant, sub.status === "canceled");
    if (customer) patch.stripeCustomerId = customer;
    if (typeof args.balanceCents === "number") patch.stripeBalanceCents = args.balanceCents;
    // This is Stripe's CURRENT state: any webhook created before now is older.
    patch.stripeLastEventCreated = Math.floor(Date.now() / 1000);
    patch.updatedAt = Date.now();
    await ctx.db.patch(tenant._id, patch as never);
    if (typeof patch.plan === "string") await unlockOnPlanChange(ctx, tenant._id, tenant.plan, patch.plan);
    if (patch.planStatus !== undefined) await unlockOnReactivation(ctx, tenant._id, tenant.planStatus, patch.planStatus);
    await ctx.db.insert("auditLog", {
      tenantId: tenant._id,
      actorKind: "system",
      action: "billing.sync",
      targetTable: "tenants",
      targetId: tenant._id,
      createdAt: Date.now(),
    });
    return {
      plan: String(patch.plan ?? tenant.plan),
      planStatus: String(patch.planStatus ?? tenant.planStatus),
    };
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

/**
 * Tenant fields derived from a Stripe Subscription object. Single source of
 * truth for both the webhook and the manual sync, so the two can never
 * disagree about what a subscription means.
 */
export function subscriptionPatch(
  obj: Record<string, unknown>,
  tenantDoc: { trialStartedAt?: number } | null,
  deleted = false,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  patch.stripeSubscriptionId = obj.id as string;
  const status = obj.status as string;
  patch.planStatus =
    status === "active" || status === "trialing"
      ? status
      : status === "past_due" || status === "unpaid"
        ? "past_due"
        : "suspended";

  const items = obj.items as
    | { data?: Array<{ price?: { id?: string }; current_period_end?: number }> }
    | undefined;
  const item = items?.data?.[0];
  // Newer Stripe API versions moved current_period_end from the subscription
  // onto its items; accept either.
  const periodEnd =
    typeof obj.current_period_end === "number" ? obj.current_period_end : item?.current_period_end;
  if (typeof periodEnd === "number") patch.subscriptionCurrentPeriodEnd = periodEnd * 1000;
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

  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const mapped = item?.price?.id ? planFromStripePriceId(item.price.id) : null;
  if (mapped && isSelfServePlan(mapped.plan)) {
    patch.plan = mapped.plan;
    patch.billingCycle = mapped.cycle;
  } else if (isSelfServePlan(meta.plan)) {
    // Price not recognised (env mismatch): fall back to the plan we stamped on
    // the subscription ourselves at checkout / plan change.
    patch.plan = meta.plan;
    if (meta.cycle === "monthly" || meta.cycle === "annual") patch.billingCycle = meta.cycle;
  }
  if (deleted) patch.planStatus = "suspended";

  // Invariant: only Pro carries a trial (entitlements.ts trialEligible).
  // changePlan ends the trial the instant a trialing tenant switches plan
  // (see changePlan above), but this is the backstop for anything that
  // reaches this function another way (a manual Dashboard price change on a
  // still-trialing subscription, a future code path, replaying an old
  // webhook) — Stripe reporting "trialing" always means plan "pro" here,
  // regardless of what price the subscription is actually attached to.
  if (patch.planStatus === "trialing") patch.plan = "pro";

  return patch;
}

export const applyWebhookEvent = internalMutation({
  args: { eventId: v.string(), type: v.string(), data: v.any(), created: v.optional(v.number()) },
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
    // `customer.updated`'s object IS the Customer itself (its id is `obj.id`,
    // not `obj.customer` like every other event here whose object references
    // a customer).
    const customerId =
      args.type === "customer.updated" ? (obj.id as string | undefined) : (obj.customer as string | undefined);
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

        // Stripe does not guarantee delivery order: a late, OLDER subscription
        // event must not overwrite a newer state (e.g. revert an upgrade).
        const planEvent = args.type === "checkout.session.completed" || args.type.startsWith("customer.subscription");
        // A deletion is terminal: it is applied even if a newer-stamped manual
        // sync ran in between, so an ended subscription can never stay live.
        const stale =
          planEvent &&
          args.type !== "customer.subscription.deleted" &&
          typeof args.created === "number" &&
          typeof tenantDoc?.stripeLastEventCreated === "number" &&
          args.created < tenantDoc.stripeLastEventCreated;
        if (planEvent && typeof args.created === "number" && !stale) patch.stripeLastEventCreated = args.created;

        if (args.type === "checkout.session.completed" && !stale) {
          patch.stripeSubscriptionId = obj.subscription as string;
          if (tenantDoc?.planStatus !== "trialing" && tenantDoc?.planStatus !== "active") {
            patch.planStatus = "active";
          }
          const meta = (obj.metadata ?? {}) as Record<string, string>;
          // The plan that was actually paid for — otherwise the tenant would
          // sit on its previous plan (e.g. the signup default) until the
          // subscription event lands.
          if (isSelfServePlan(meta.plan)) patch.plan = meta.plan;
          if (meta.trialPlan === "pro") {
            patch.plan = "pro";
            patch.trialPlan = "pro";
            patch.trialStartedAt = Date.now();
            if (typeof obj.subscription === "string") {
              await ctx.scheduler.runAfter(0, internal.billing.enforceTrialOncePerCard, {
                tenantId: tenantDoc!._id,
                subscriptionId: obj.subscription,
              });
            }
          }
          if (meta.cycle === "annual" || meta.cycle === "monthly") {
            patch.billingCycle = meta.cycle;
          }
        }
        if (args.type.startsWith("customer.subscription") && !stale) {
          Object.assign(patch, subscriptionPatch(obj, tenantDoc, args.type === "customer.subscription.deleted"));
        }
        if (args.type === "customer.updated" && typeof obj.balance === "number") {
          patch.stripeBalanceCents = obj.balance;
        }
        await ctx.db.patch(tenantId as never, patch);
        if (tenantDoc && typeof patch.plan === "string") {
          await unlockOnPlanChange(ctx, tenantDoc._id, tenantDoc.plan, patch.plan);
        }
        if (tenantDoc && patch.planStatus !== undefined) {
          await unlockOnReactivation(ctx, tenantDoc._id, tenantDoc.planStatus, patch.planStatus);
        }
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

/** Records a trial card; `reused` when another tenant already trialled with it. */
export const claimTrialFingerprint = internalMutation({
  args: { fingerprint: v.string(), tenantId: v.id("tenants") },
  handler: async (ctx, args): Promise<{ reused: boolean }> => {
    const rows = await ctx.db
      .query("trialFingerprints")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", args.fingerprint))
      .take(5);
    if (rows.some((r) => r.tenantId !== args.tenantId)) {
      await ctx.db.insert("auditLog", {
        tenantId: args.tenantId,
        actorKind: "system",
        action: "billing.trial_card_reused",
        targetTable: "tenants",
        targetId: args.tenantId,
        createdAt: Date.now(),
      });
      return { reused: true };
    }
    if (rows.length === 0) {
      await ctx.db.insert("trialFingerprints", {
        fingerprint: args.fingerprint,
        tenantId: args.tenantId,
        createdAt: Date.now(),
      });
    }
    return { reused: false };
  },
});

/**
 * One free trial per physical card: if the card behind a new trial already
 * started a trial for another account, the trial ends now (the first period
 * is charged to that card). Best-effort — a Stripe hiccup never blocks signup.
 */
export const enforceTrialOncePerCard = internalAction({
  args: { tenantId: v.id("tenants"), subscriptionId: v.string() },
  handler: async (ctx, args) => {
    if (!stripeKey()) return;
    try {
      const sub = await stripeGet(
        `/subscriptions/${args.subscriptionId}?expand[]=default_payment_method&expand[]=customer.invoice_settings.default_payment_method`,
      );
      type Pm = { card?: { fingerprint?: string } };
      const customer = sub.customer as { invoice_settings?: { default_payment_method?: Pm } } | string;
      const pm =
        (sub.default_payment_method as Pm | null) ??
        (typeof customer === "object" ? customer.invoice_settings?.default_payment_method : undefined);
      const fingerprint = pm?.card?.fingerprint;
      if (!fingerprint) return;
      const { reused } = await ctx.runMutation(internal.billing.claimTrialFingerprint, {
        fingerprint,
        tenantId: args.tenantId,
      });
      if (!reused || sub.status !== "trialing") return;
      const updated = await stripe(`/subscriptions/${args.subscriptionId}`, { trial_end: "now" });
      await ctx.runMutation(internal.billing.applySubscriptionSync, {
        tenantId: args.tenantId,
        subscription: updated,
      });
    } catch (e) {
      console.error("enforceTrialOncePerCard failed", e instanceof Error ? e.message : e);
    }
  },
});

/** Active/trialing tenants that own a Stripe subscription, one page at a time. */
export const listForReconcile = internalQuery({
  args: {
    status: v.union(v.literal("trialing"), v.literal("active")),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tenants")
      .withIndex("by_planStatus", (q) => q.eq("planStatus", args.status))
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
    return {
      tenants: page.page
        .filter((t) => t.stripeSubscriptionId && t.unlimitedAccess !== true)
        .map((t) => ({ id: t._id, subscriptionId: t.stripeSubscriptionId as string })),
      next: page.isDone ? null : page.continueCursor,
    };
  },
});

/**
 * Re-reads every live subscription from Stripe and applies what Stripe says,
 * so a missed, ignored or delayed webhook can never leave an ended
 * subscription with platform access. Pages itself; a no-op without Stripe.
 */
export const reconcile = internalAction({
  args: {
    status: v.optional(v.union(v.literal("trialing"), v.literal("active"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    if (!stripeKey()) return { skipped: "BILLING_NOT_CONFIGURED" };
    const status = args.status ?? "trialing";
    const page = await ctx.runQuery(internal.billing.listForReconcile, { status, cursor: args.cursor });
    let fixed = 0;
    for (const t of page.tenants) {
      try {
        const sub = await stripeGet(`/subscriptions/${t.subscriptionId}`);
        const mapped = sub.status === "active" || sub.status === "trialing" ? sub.status : null;
        if (mapped === status) continue; // already consistent
        await ctx.runMutation(internal.billing.applySubscriptionSync, { tenantId: t.id, subscription: sub });
        fixed++;
      } catch (e) {
        console.error("reconcile failed for a tenant", e instanceof Error ? e.message : e);
      }
    }
    if (page.next) await ctx.scheduler.runAfter(0, internal.billing.reconcile, { status, cursor: page.next });
    return { fixed };
  },
});

/**
 * Safety net for expired trials (daily cron). Stripe-managed trials convert
 * or fail via webhook; this only flips abandoned pre-Stripe rows to past_due
 * and notifies once, so a lapsed trial can never silently keep Pro access.
 */
export const trialSweep = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Paginated: thousands of trialing tenants must not exceed one
    // transaction's read/write limits. Each page schedules the next.
    const page = await ctx.db
      .query("tenants")
      .withIndex("by_planStatus", (q) => q.eq("planStatus", "trialing"))
      .paginate({ numItems: 200, cursor: args.cursor ?? null });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.billing.trialSweep, { cursor: page.continueCursor });
    }
    const trialing = page.page;
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
