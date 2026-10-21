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
        v.literal("email"),
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

/** Read-only GET to a provider API: never throws, a network failure reads as status 0. */
const providerGet = (base: string, key: () => string): StripeGet => async (path) => {
  try {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key()}` }, signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.error(`[billing-health] network failure GET ${base}${path.split("?")[0]}:`, e instanceof Error ? e.message : String(e));
    return { ok: false, status: 0, json: {} };
  }
};
const stripeGet = providerGet(STRIPE_API, () => process.env.STRIPE_SECRET_KEY ?? "");
const resendGet = providerGet("https://api.resend.com", () => process.env.AUTH_RESEND_KEY ?? "");

/**
 * "Controllo pagamenti": is this deployment able to take payments? Platform admins only.
 * Only GET requests to Stripe and Resend; secrets are reported as present/missing, never returned.
 */
export const check = action({
  args: {},
  returns: reportValidator,
  handler: async (ctx): Promise<HealthReport> => {
    await ctx.runQuery(internal.billingHealth.assertAdmin, {});
    return await runBillingHealth(process.env, stripeGet, Date.now(), resendGet);
  },
});
