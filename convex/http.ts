import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";
import { QuoteSubmissionSchema } from "../src/shared/widget-types";
import { verifyStripeSignature } from "./billing";

const http = httpRouter();

// Convex Auth sign-in / OAuth callback endpoints.
auth.addHttpRoutes(http);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function hashIp(ip: string): Promise<string> {
  const salt = process.env.DAILY_IP_SALT || "dev-salt";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + salt));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // disabled in dev
  const form = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({ success: false }));
  return data.success === true;
}

http.route({
  path: "/api/widget/quote",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

http.route({
  path: "/api/widget/quote",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ ok: false, error: "BAD_JSON" }, 400);
    }

    const parsed = QuoteSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        { ok: false, error: "VALIDATION", detail: parsed.error.errors.map((e) => e.message) },
        400,
      );
    }
    const body = parsed.data;

    if (body.honeypot) return json({ ok: false, error: "SPAM" }, 400);

    const fwd = req.headers.get("x-forwarded-for");
    const ip =
      req.headers.get("CF-Connecting-IP") ||
      (fwd ? fwd.split(",")[0].trim() : null) ||
      "unknown";
    const origin = req.headers.get("origin") || "";
    const userAgent = req.headers.get("user-agent") || "";
    const ipHash = await hashIp(ip);

    const configurator = await ctx.runQuery(api.widget.getPublicConfigurator, {
      publicId: body.publicId,
    });
    if (!configurator) return json({ ok: false, error: "NOT_FOUND" }, 404);

    const configuratorId = await ctx.runQuery(internal.widget.getConfiguratorIdByPublicId, {
      publicId: body.publicId,
    });
    if (!configuratorId) return json({ ok: false, error: "NOT_FOUND" }, 404);

    // Turnstile (required only when a secret is configured).
    if (process.env.TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(body.turnstileToken ?? "", ip);
      if (!ok) return json({ ok: false, error: "TURNSTILE_FAILED" }, 400);
    }

    // Rate limit (throws ConvexError("RATE_LIMITED") -> map to 429).
    try {
      await ctx.runMutation(internal.lib.ratelimit.checkAllRateLimits, {
        configuratorId,
        ipHash,
      });
    } catch (e) {
      if (String(e instanceof Error ? e.message : e).includes("RATE_LIMITED")) {
        return json({ ok: false, error: "RATE_LIMITED" }, 429);
      }
      throw e;
    }

    // Soft origin check — a mismatched origin is flagged for review, not rejected.
    const configuratorCfg = configurator.catalog?.configurator as
      | { allowedOrigins?: string[] }
      | undefined;
    const allowed = configuratorCfg?.allowedOrigins;
    const flagged =
      Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(origin);

    const referenceId = await ctx.runMutation(internal.widget.insertQuote, {
      publicId: body.publicId,
      configuratorId,
      catalogVersion: configurator.catalogVersion,
      items: body.items,
      leadName: body.leadName,
      leadEmail: body.leadEmail,
      leadPhone: body.leadPhone,
      leadCompany: body.leadCompany,
      leadMessage: body.leadMessage,
      leadLocale: body.leadLocale,
      clientReportedPriceCents: body.clientReportedPriceCents,
      sourceIpHash: ipHash,
      sourceOrigin: origin,
      userAgent,
      turnstileVerified: !!body.turnstileToken,
      flagged,
    });

    return json({ ok: true, referenceId });
  }),
});

// NOTE: a Resend delivery-tracking webhook is intentionally NOT mounted yet.
// An endpoint that doesn't verify the Svix signature is worse than none; add it
// back with `svix` verification when delivery status is actually needed.

// Stripe webhook — dormant until STRIPE_WEBHOOK_SECRET is set.
http.route({
  path: "/api/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!secret) return new Response("billing not configured", { status: 503 });

    const raw = await req.text();
    const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret);
    if (!ok) return new Response("bad signature", { status: 400 });

    let event: { id?: string; type?: string; data?: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("bad payload", { status: 400 });
    }
    if (!event.id || !event.type) return new Response("bad event", { status: 400 });

    const HANDLED = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ];
    if (HANDLED.includes(event.type)) {
      await ctx.runMutation(internal.billing.applyWebhookEvent, {
        eventId: event.id,
        type: event.type,
        data: event.data,
      });
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
