import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requirePlatformAdmin } from "./lib/auth";
import { runBillingHealth, type HealthReport, type StripeGet } from "./lib/billingHealth";

const STRIPE_API = "https://api.stripe.com/v1";

const status = v.union(v.literal("ok"), v.literal("warn"), v.literal("error"), v.literal("info"));
const reportValidator = v.object({
  checkedAt: v.number(),
  mode: v.union(v.literal("live"), v.literal("test"), v.literal("missing")),
  overall: v.union(v.literal("ok"), v.literal("warn"), v.literal("error")),
  sections: v.array(
    v.object({
      key: v.union(
        v.literal("keys"),
        v.literal("account"),
        v.literal("prices"),
        v.literal("webhook"),
        v.literal("tax"),
        v.literal("portal"),
        v.literal("secrets"),
      ),
      items: v.array(v.object({ id: v.string(), check: v.string(), status, params: v.record(v.string(), v.string()) })),
    }),
  ),
});

export const assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    return null;
  },
});

/** Read-only Stripe GET: never throws, a network failure reads as status 0. */
const stripeGet: StripeGet = async (path) => {
  try {
    const res = await fetch(`${STRIPE_API}${path}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.error(`[billing-health] network failure GET ${path.split("?")[0]}:`, e instanceof Error ? e.message : String(e));
    return { ok: false, status: 0, json: {} };
  }
};

/**
 * "Controllo pagamenti": is this deployment able to take payments? Platform admins only.
 * Only GET requests to Stripe; secrets are reported as present/missing, never returned.
 */
export const check = action({
  args: {},
  returns: reportValidator,
  handler: async (ctx): Promise<HealthReport> => {
    await ctx.runQuery(internal.billingHealth.assertAdmin, {});
    return await runBillingHealth(process.env, stripeGet, Date.now());
  },
});
