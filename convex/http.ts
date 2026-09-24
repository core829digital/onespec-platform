import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { QuoteSubmissionSchema } from "../src/shared/widget-types";
import { verifyStripeSignature } from "./billing";
import { hashIp } from "./lib/ipHash";
import { resendWebhook } from "./http/resend_webhook";
import { createPostHogClient } from "./lib/posthog";

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
  path: "/api/widget/view",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

http.route({
  path: "/api/widget/view",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: { publicId?: string; viewToken?: string };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false }, 400);
    }
    if (!body.publicId) return json({ ok: false }, 400);

    const ip =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "0.0.0.0";
    const token =
      body.viewToken && /^[A-Za-z0-9_-]{8,64}$/.test(body.viewToken)
        ? body.viewToken
        : await hashIp(ip);

    const res = await ctx.runMutation(internal.widget.recordWidgetView, {
      publicId: body.publicId,
      viewToken: token,
    });
    return json({ ok: true, counted: res.counted });
  }),
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
      requestKind: body.requestKind,
      clientReportedPriceCents: body.clientReportedPriceCents,
      consentAt: Date.now(),
      consentVersion: body.consentVersion,
      sourceIpHash: ipHash,
      sourceOrigin: origin,
      userAgent,
      turnstileVerified: !!body.turnstileToken,
      flagged,
    });

    return json({ ok: true, referenceId });
  }),
});

/* -------- Phase C — public Fascicolo (QR) endpoints -------- */

http.route({
  path: "/api/passport/scan",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});
http.route({
  path: "/api/passport/intervention",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

http.route({
  path: "/api/passport/scan",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false }, 400);
    }
    if (!body.token || !/^[A-Za-z0-9]{8,32}$/.test(body.token)) return json({ ok: false }, 400);
    // Scan throttle: counted:false past the limit, never an error (page must not break).
    try {
      const ip0 =
        req.headers.get("cf-connecting-ip") ||
        (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
        "0.0.0.0";
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `scan:${body.token}:${await hashIp(ip0)}`,
        tokens: 10,
        refillMs: 60 * 60 * 1000,
      });
    } catch {
      return json({ ok: true, counted: false });
    }
    await ctx.runMutation(api.passports.recordScan, { token: body.token });
    return json({ ok: true });
  }),
});

http.route({
  path: "/api/passport/intervention",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: {
      token?: string;
      kind?: "adjustment" | "warranty" | "maintenance" | "other";
      message?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "BAD_JSON" }, 400);
    }
    if (!body.token || !/^[A-Za-z0-9]{8,32}$/.test(body.token)) {
      return json({ ok: false, error: "BAD_TOKEN" }, 400);
    }
    const kind = body.kind ?? "other";
    if (!["adjustment", "warranty", "maintenance", "other"].includes(kind)) {
      return json({ ok: false, error: "BAD_KIND" }, 400);
    }
    const ip =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "0.0.0.0";
    const ipHash = await hashIp(ip);
    // Intervention throttle: per-IP bucket + global per-passport bucket (spam fan-out guard).
    try {
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `passport:${body.token}:${ipHash}`,
        tokens: 5,
        refillMs: 10 * 60 * 1000,
      });
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `passport:${body.token}:global`,
        tokens: 20,
        refillMs: 60 * 60 * 1000,
      });
    } catch (e) {
      if (String(e instanceof Error ? e.message : e).includes("RATE_LIMITED")) {
        return json({ ok: false, error: "RATE_LIMITED" }, 429);
      }
      throw e;
    }
    try {
      await ctx.runMutation(internal.passports.recordInterventionFromHttp, {
        token: body.token,
        kind,
        message: String(body.message ?? ""),
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
        sourceIpHash: ipHash,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("MESSAGE_REQUIRED")) return json({ ok: false, error: "MESSAGE_REQUIRED" }, 400);
      if (msg.includes("PASSPORT_NOT_FOUND")) return json({ ok: false, error: "NOT_FOUND" }, 404);
      throw e;
    }
    return json({ ok: true });
  }),
});

/* -------- Phase C — App Posatore (/i/[token]) field endpoints -------- */

const INSPECTION_PATHS = [
  "/api/inspection/upload-url",
  "/api/inspection/photo",
  "/api/inspection/checks",
  "/api/inspection/sign",
];
for (const path of INSPECTION_PATHS) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
  });
}

const TOKEN_RE = /^[A-Za-z0-9]{8,32}$/;

/** Shared throttle for the 4 public inspection-write endpoints. Returns a 429 Response when exhausted, else null. */
async function checkInspectionLimit(
  runBucket: (bucketKey: string, tokens: number, refillMs: number) => Promise<unknown>,
  req: Request,
  token: string,
): Promise<Response | null> {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "0.0.0.0";
  const ipHash = await hashIp(ip);
  try {
    await runBucket(`insp:${token}:${ipHash}`, 30, 10 * 60 * 1000);
    await runBucket(`insp:${token}:global`, 100, 60 * 60 * 1000);
  } catch (e) {
    if (String(e instanceof Error ? e.message : e).includes("RATE_LIMITED")) {
      return json({ ok: false, error: "RATE_LIMITED" }, 429);
    }
    throw e;
  }
  return null;
}

http.route({
  path: "/api/inspection/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    if (!body.token || !TOKEN_RE.test(body.token)) return json({ ok: false }, 400);
    const limited = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      body.token,
    );
    if (limited) return limited;
    try {
      const url = await ctx.runMutation(internal.inspections.installerUploadUrlFromHttp, {
        token: body.token,
      });
      return json({ ok: true, url });
    } catch {
      return json({ ok: false, error: "NOT_FOUND_OR_LOCKED" }, 404);
    }
  }),
});

http.route({
  path: "/api/inspection/photo",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      photoKey?: string;
      storageId?: string;
    };
    if (!body.token || !TOKEN_RE.test(body.token) || !body.photoKey || !body.storageId) {
      return json({ ok: false }, 400);
    }
    const limitedPhoto = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      body.token,
    );
    if (limitedPhoto) return limitedPhoto;
    try {
      await ctx.runMutation(internal.inspections.setInstallerPhotoFromHttp, {
        token: body.token,
        photoKey: body.photoKey,
        storageId: body.storageId as Id<"_storage">,
      });
      return json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ ok: false, error: msg.slice(0, 80) }, 400);
    }
  }),
});

http.route({
  path: "/api/inspection/checks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      checks?: { key: string; passed: boolean }[];
      installerNotes?: string;
    };
    if (!body.token || !TOKEN_RE.test(body.token) || !Array.isArray(body.checks)) {
      return json({ ok: false }, 400);
    }
    const limitedChecks = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      body.token,
    );
    if (limitedChecks) return limitedChecks;
    try {
      await ctx.runMutation(internal.inspections.updateInstallerChecksFromHttp, {
        token: body.token,
        checks: body.checks.map((c) => ({ key: String(c.key), passed: !!c.passed })),
        installerNotes: body.installerNotes,
      });
      return json({ ok: true });
    } catch {
      return json({ ok: false }, 400);
    }
  }),
});

http.route({
  path: "/api/inspection/sign",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      signatureDataUrl?: string;
      signedByName?: string;
      clientRemarks?: string;
    };
    if (
      !body.token ||
      !TOKEN_RE.test(body.token) ||
      !body.signatureDataUrl ||
      !body.signedByName
    ) {
      return json({ ok: false, error: "BAD_REQUEST" }, 400);
    }
    const limitedSign = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      body.token,
    );
    if (limitedSign) return limitedSign;
    try {
      await ctx.runMutation(internal.inspections.signByInstallerFromHttp, {
        token: body.token,
        signatureDataUrl: body.signatureDataUrl,
        signedByName: body.signedByName,
        clientRemarks: body.clientRemarks,
      });
      return json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("PHOTOS_INCOMPLETE")) return json({ ok: false, error: "PHOTOS_INCOMPLETE" }, 400);
      if (msg.includes("ALREADY_SIGNED")) return json({ ok: false, error: "ALREADY_SIGNED" }, 409);
      return json({ ok: false, error: "SIGN_FAILED" }, 400);
    }
  }),
});

// Resend delivery-tracking webhook (with signature verification if RESEND_WEBHOOK_SECRET is set).
http.route({
  path: "/api/email/webhook",
  method: "POST",
  handler: resendWebhook,
});

// Stripe webhook — dormant until STRIPE_WEBHOOK_SECRET is set. The path
// itself carries a secret token (STRIPE_WEBHOOK_PATH_TOKEN) so the endpoint
// isn't the guessable `/api/stripe/webhook` — set that env var to a random
// slug (e.g. `openssl rand -hex 16`) and use the resulting path as the
// endpoint URL in the Stripe Dashboard when billing goes live. Falls back to
// the static path if unset, so nothing breaks before that env var exists.
const STRIPE_WEBHOOK_PATH = `/api/stripe/webhook/${process.env.STRIPE_WEBHOOK_PATH_TOKEN ?? "unconfigured"}`;

// Stripe's own guidance is to treat signature verification (below) as the
// real defense and NOT hard-block on IP — their webhook-sending IP ranges
// rotate, and a stale hardcoded allowlist would silently drop real payment
// events (a worse outage than the abuse it prevents). Instead of guessing
// at IP ranges (never invent security data), fetch Stripe's own published
// list and cache it for a day; log an anomaly for later review, never
// reject on IP alone.
let stripeIpCache: { ips: Set<string>; fetchedAt: number } | null = null;
const STRIPE_IP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function flagIfUnexpectedOrigin(req: Request): Promise<string | null> {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "";
  if (!ip) return null;

  if (!stripeIpCache || Date.now() - stripeIpCache.fetchedAt > STRIPE_IP_CACHE_TTL_MS) {
    try {
      const res = await fetch("https://stripe.com/files/ips/ips_webhooks.json");
      const data = (await res.json()) as { WEBHOOKS?: string[] };
      stripeIpCache = { ips: new Set(data.WEBHOOKS ?? []), fetchedAt: Date.now() };
    } catch {
      // Fetch failed (network hiccup) — skip the check this time rather than
      // flag every request or block on a transient error.
      return null;
    }
  }

  return stripeIpCache.ips.has(ip) ? null : ip;
}

http.route({
  path: STRIPE_WEBHOOK_PATH,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!secret) return new Response("billing not configured", { status: 503 });

    const unexpectedIp = await flagIfUnexpectedOrigin(req);
    if (unexpectedIp) console.warn(`[stripe-webhook] request from outside Stripe's known IP prefixes: ${unexpectedIp}`);

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
      const result = await ctx.runMutation(internal.billing.applyWebhookEvent, {
        eventId: event.id,
        type: event.type,
        data: event.data,
      });

      if (event.type === "checkout.session.completed" && !result.duplicate) {
        const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object;
        const metadata = object?.metadata as Record<string, string> | undefined;
        const tenantId =
          (object?.client_reference_id as string | undefined) ?? metadata?.tenantId;
        const ownerUserId = metadata?.ownerUserId;
        const posthog = createPostHogClient();
        if (posthog && tenantId && ownerUserId) {
          posthog.capture({
            distinctId: ownerUserId,
            event: "subscription_activated",
            properties: {
              tenant_id: tenantId,
              plan: metadata?.plan,
              billing_cycle: metadata?.cycle,
              includes_trial: metadata?.trialPlan === "pro",
            },
          });
          await posthog.shutdown();
        }
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
