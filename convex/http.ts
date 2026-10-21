import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { QuoteSubmissionSchema } from "../src/shared/widget-types";
import { verifyStripeSignature } from "./billing";
import { hashIp } from "./lib/ipHash";
import { clientIp } from "./lib/clientIp";
import { resendWebhook } from "./http/resend_webhook";
import { supportFileDownload } from "./http/support_file";
import { createPostHogClient } from "./lib/posthog";
import { checkWebhookSource } from "./lib/webhookIp";
import { cleanSourcePage } from "../src/shared/source-page";

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
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });
    // Cloudflare itself failing (5xx) must not turn every visitor away: the rate limits and the honeypot still apply.
    if (res.status >= 500) return true;
    const data = await res.json().catch(() => ({ success: false }));
    return data.success === true;
  } catch {
    // Timeout / network error reaching Cloudflare: same reasoning, an outage of the checker is not the visitor's failure.
    return true;
  }
}

// Signed, short-lived download of a ticket attachment (see convex/http/support_file.ts).
http.route({ path: "/api/support/file", method: "GET", handler: supportFileDownload });

http.route({
  path: "/api/support/contact",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

/**
 * Public "Contact us" form (for people who cannot sign in). Body capped at 16 KB; a filled honeypot gets a fake "ok" so bots learn nothing;
 * the bot challenge is checked when configured; the mutation applies per-address, per-e-mail and global limits.
 */
http.route({
  path: "/api/support/contact",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (Number(req.headers.get("content-length") ?? "0") > 16 * 1024) return json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    let raw: Record<string, unknown>;
    try {
      const text = await req.text();
      if (text.length > 16 * 1024) return json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ ok: false, error: "BAD_JSON" }, 400);
      raw = parsed as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: "BAD_JSON" }, 400);
    }
    const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
    if (str("website")) return json({ ok: true }); // honeypot
    const topic = str("topic");
    if (!["login", "billing", "info", "other"].includes(topic)) return json({ ok: false, error: "VALIDATION" }, 400);

    const ip = clientIp(req.headers);
    if (!(await verifyTurnstile(str("turnstileToken"), ip))) return json({ ok: false, error: "TURNSTILE_FAILED" }, 403);
    try {
      await ctx.runMutation(internal.supportContact.submit, {
        name: str("name"), email: str("email"), topic: topic as "login" | "billing" | "info" | "other",
        message: str("message"), locale: str("locale"), ipHash: await hashIp(ip),
      });
    } catch (e) {
      const code = e instanceof ConvexError && typeof e.data === "string" ? e.data : "ERROR";
      if (code === "RATE_LIMITED") return json({ ok: false, error: code }, 429);
      if (code === "INVALID_NAME" || code === "INVALID_EMAIL" || code === "INVALID_MESSAGE") return json({ ok: false, error: code }, 400);
      return json({ ok: false, error: "ERROR" }, 500);
    }
    return json({ ok: true });
  }),
});

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
    const body = await readJson(req);
    const publicId = field(body, "publicId", 40);
    if (!publicId) return json({ ok: false }, 400);
    const rawViewToken = field(body, "viewToken", 64, true);

    const ip = clientIp(req.headers);
    const token =
      rawViewToken && /^[A-Za-z0-9_-]{8,64}$/.test(rawViewToken)
        ? rawViewToken
        : await hashIp(ip);

    const res = await ctx.runMutation(internal.widget.recordWidgetView, {
      publicId,
      viewToken: token,
    });
    return json({ ok: true, counted: res.counted });
  }),
});

http.route({
  path: "/api/widget/quote",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // 20 pieces + contact data fit well under 256 KB; anything bigger is abuse. The header is only a hint (a chunked upload has none),
    // so the body itself is measured as well.
    if (Number(req.headers.get("content-length") ?? "0") > 256 * 1024) {
      return json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    let raw: unknown;
    try {
      const text = await req.text();
      if (text.length > 256 * 1024) return json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
      raw = JSON.parse(text);
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

    const ip = clientIp(req.headers);
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

    // Which sites may SHOW the widget is enforced where it matters, by the `frame-ancestors` header of /w/<id> (src/proxy.ts). An
    // Origin check here would say nothing: the request is made by the widget document itself, so its Origin is always the
    // platform's, never the dealer's site. (An earlier "soft origin check" compared against a list the public payload never
    // contained, so it never flagged anything.) Abuse is stopped by Turnstile, the honeypot and the rate limits above.
    const flagged = false;

    let referenceId: string;
    try {
      referenceId = await ctx.runMutation(internal.widget.insertQuote, {
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
      clientVatPercent: body.clientVatPercent,
      clientDeductionPercent: body.clientDeductionPercent,
      consentAt: Date.now(),
      consentVersion: body.consentVersion,
      sourceIpHash: ipHash,
      sourceOrigin: origin,
      sourcePage: cleanSourcePage(body.sourcePage),
      userAgent,
      turnstileVerified: !!body.turnstileToken,
      flagged,
      });
    } catch (e) {
      // Expected refusals (bad item, unknown version…) are ConvexErrors; anything
      // else means a real visitor's quote request was lost — alert the operators.
      if (!(e instanceof ConvexError)) {
        await ctx.scheduler.runAfter(0, internal.ops.alert, {
          source: "widget-quote-submit",
          message: `Invio preventivo fallito (widget ${body.publicId}): ${e instanceof Error ? e.message : String(e)}`,
        });
      }
      throw e;
    }

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
    const body = await readJson(req);
    const token = field(body, "token", 32);
    if (!token || !TOKEN_RE.test(token)) return json({ ok: false }, 400);
    // Scan throttle: counted:false past the limit, never an error (page must not break).
    try {
      const ip0 = clientIp(req.headers);
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `scan:${token}:${await hashIp(ip0)}`,
        tokens: 10,
        refillMs: 60 * 60 * 1000,
      });
    } catch {
      return json({ ok: true, counted: false });
    }
    await ctx.runMutation(internal.passports.recordScan, { token });
    return json({ ok: true });
  }),
});

http.route({
  path: "/api/passport/intervention",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await readJson(req);
    const token = field(body, "token", 32);
    if (!token || !TOKEN_RE.test(token)) {
      return json({ ok: false, error: "BAD_TOKEN" }, 400);
    }
    const KINDS = ["adjustment", "warranty", "maintenance", "other"] as const;
    const rawKind = field(body, "kind", 20, true);
    if (rawKind !== undefined && !(KINDS as readonly string[]).includes(rawKind)) {
      return json({ ok: false, error: "BAD_KIND" }, 400);
    }
    const kind = rawKind === undefined ? "other" : (rawKind as (typeof KINDS)[number]);
    // Every field narrows off the parsed body (#67, #44): present-but-mistyped
    // is a clean 400 here, never a mutation-validator 500 downstream.
    const optContact = (key: string, max: number): string | undefined | false => {
      const v = body[key];
      if (v === undefined) return undefined;
      return typeof v === "string" && v.length <= max ? v : false;
    };
    const contactName = optContact("contactName", 80);
    const contactPhone = optContact("contactPhone", 40);
    const contactEmail = optContact("contactEmail", 120);
    if (contactName === false || contactPhone === false || contactEmail === false) {
      return json({ ok: false, error: "BAD_CONTACT" }, 400);
    }
    const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "";
    const ip = clientIp(req.headers);
    const ipHash = await hashIp(ip);
    // Intervention throttle: per-IP bucket + global per-passport bucket (spam fan-out guard).
    try {
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `passport:${token}:${ipHash}`,
        tokens: 5,
        refillMs: 10 * 60 * 1000,
      });
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `passport:${token}:global`,
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
        token,
        kind,
        message,
        contactName,
        contactPhone,
        contactEmail,
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

/**
 * Parse, don't cast (#67): the request body is unknown until narrowed. Every
 * route reads it through here and validates each field with `field`/`str` —
 * a `let body: {...} = await req.json()` annotation checked nothing at
 * runtime and forwarded mistyped values straight into the mutation validators
 * (the 500-vs-400 delta that bug #44 fixed on one route).
 */
async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** String field off a parsed body: a real string, non-empty unless allowed. */
function field(body: Record<string, unknown>, key: string, max: number, allowEmpty = false): string | undefined {
  const v = body[key];
  return typeof v === "string" && v.length <= max && (allowEmpty || v.length > 0) ? v : undefined;
}

/** Shared throttle for the 4 public inspection-write endpoints. Returns a 429 Response when exhausted, else null. */
async function checkInspectionLimit(
  runBucket: (bucketKey: string, tokens: number, refillMs: number) => Promise<unknown>,
  req: Request,
  token: string,
): Promise<Response | null> {
  const ip = clientIp(req.headers);
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
    const body = await readJson(req);
    const token = field(body, "token", 32);
    if (!token || !TOKEN_RE.test(token)) return json({ ok: false }, 400);
    const limited = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      token,
    );
    if (limited) return limited;
    try {
      const url = await ctx.runMutation(internal.inspections.installerUploadUrlFromHttp, {
        token,
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
    const body = await readJson(req);
    const token = field(body, "token", 32);
    const photoKey = field(body, "photoKey", 64);
    const storageId = field(body, "storageId", 64);
    if (!token || !TOKEN_RE.test(token) || !photoKey || !storageId) {
      return json({ ok: false }, 400);
    }
    const limitedPhoto = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      token,
    );
    if (limitedPhoto) return limitedPhoto;
    try {
      await ctx.runMutation(internal.inspections.setInstallerPhotoFromHttp, {
        token,
        photoKey,
        storageId: storageId as Id<"_storage">,
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
    const body = await readJson(req);
    const token = field(body, "token", 32);
    const rawChecks = body.checks;
    // checks entries narrow here: only {key: string, passed: boolean-ish} survive.
    const checks = Array.isArray(rawChecks)
      ? rawChecks
          .filter((c): c is { key: string } => !!c && typeof c === "object" && typeof (c as { key?: unknown }).key === "string")
          .map((c) => ({ key: c.key.slice(0, 64), passed: !!(c as { passed?: unknown }).passed }))
      : null;
    const installerNotes = field(body, "installerNotes", 5000, true);
    if (!token || !TOKEN_RE.test(token) || checks === null || checks.length > 100) {
      return json({ ok: false }, 400);
    }
    const limitedChecks = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      token,
    );
    if (limitedChecks) return limitedChecks;
    try {
      await ctx.runMutation(internal.inspections.updateInstallerChecksFromHttp, {
        token,
        checks,
        installerNotes,
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
    const body = await readJson(req);
    const token = field(body, "token", 32);
    const signatureDataUrl = field(body, "signatureDataUrl", 500_000);
    const signedByName = field(body, "signedByName", 200);
    const clientRemarks = field(body, "clientRemarks", 5000, true);
    if (
      !token ||
      !TOKEN_RE.test(token) ||
      !signatureDataUrl ||
      !signedByName ||
      !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(signatureDataUrl)
    ) {
      return json({ ok: false, error: "BAD_REQUEST" }, 400);
    }
    const limitedSign = await checkInspectionLimit(
      (bucketKey, tokens, refillMs) =>
        ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey, tokens, refillMs }),
      req,
      token,
    );
    if (limitedSign) return limitedSign;
    try {
      await ctx.runMutation(internal.inspections.signByInstallerFromHttp, {
        token,
        signatureDataUrl,
        signedByName,
        clientRemarks,
      });
      return json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("PHOTOS_INCOMPLETE")) return json({ ok: false, error: "PHOTOS_INCOMPLETE" }, 400);
      if (msg.includes("ALREADY_SIGNED")) return json({ ok: false, error: "ALREADY_SIGNED" }, 409);
      if (msg.includes("SIGNATURE_EMPTY") || msg.includes("INVALID_SIGNATURE")) return json({ ok: false, error: "SIGNATURE_EMPTY" }, 400);
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

// Stripe webhook — dormant until STRIPE_WEBHOOK_SECRET is set.
// The path deliberately contains neither "api", "stripe" nor "webhook". If the
// token is missing or too short the route is NOT registered at all (no
// guessable fallback path) — every request to it 404s.
const STRIPE_WEBHOOK_TOKEN = process.env.STRIPE_WEBHOOK_PATH_TOKEN ?? "";
const STRIPE_WEBHOOK_PATH = `/ev/${STRIPE_WEBHOOK_TOKEN}`;
const STRIPE_WEBHOOK_MAX_BYTES = 512 * 1024;

if (/^[A-Za-z0-9_-]{24,128}$/.test(STRIPE_WEBHOOK_TOKEN)) http.route({
  path: STRIPE_WEBHOOK_PATH,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!secret) return new Response("billing not configured", { status: 503 });

    // Source-IP allowlist from Stripe's published list (defence in depth; the
    // HMAC signature below stays the authoritative check).
    const src = await checkWebhookSource(req, "stripe");
    if (src.verdict !== "allowed") console.warn(`[stripe-webhook] source ip ${src.ip || "(none)"} ${src.verdict}`);
    if (src.reject) return new Response("forbidden", { status: 403 });

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > STRIPE_WEBHOOK_MAX_BYTES) return new Response("payload too large", { status: 413 });
    const raw = await req.text();
    if (raw.length > STRIPE_WEBHOOK_MAX_BYTES) return new Response("payload too large", { status: 413 });
    const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret);
    if (!ok) return new Response("bad signature", { status: 400 });

    let event: { id?: string; type?: string; data?: unknown; created?: number };
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
      // Fires whenever Stripe's Customer.balance changes — e.g. a downgrade's
      // unused-time proration lands here as a negative balance (a credit).
      // Must also be enabled on the live webhook endpoint's event list in the
      // Stripe Dashboard/API, or Stripe never sends it even though this code
      // is ready for it.
      "customer.updated",
    ];
    if (HANDLED.includes(event.type)) {
      let result: { duplicate: boolean };
      try {
        result = await ctx.runMutation(internal.billing.applyWebhookEvent, {
          eventId: event.id,
          type: event.type,
          data: event.data,
          created: typeof event.created === "number" ? event.created : undefined,
        });
      } catch (e) {
        // A payment event we could not apply: a customer may have paid without
        // getting access. Tell the operators now; Stripe will also retry (500).
        await ctx.scheduler.runAfter(0, internal.ops.alert, {
          source: "stripe-webhook",
          message: `Evento ${event.type} (${event.id}) non applicato: ${e instanceof Error ? e.message : String(e)}`,
        });
        throw e;
      }

      if (event.type === "checkout.session.completed" && !result.duplicate) {
        // Narrow step by step instead of the old double cast (#67): the SDK
        // types event.data loosely, so one object-check per hop.
        const data = typeof event.data === "object" && event.data !== null ? (event.data as { object?: unknown }) : undefined;
        const object = typeof data?.object === "object" && data.object !== null ? (data.object as Record<string, unknown>) : undefined;
        const rawMetadata = object?.metadata;
        const metadata = typeof rawMetadata === "object" && rawMetadata !== null ? (rawMetadata as Record<string, unknown>) : undefined;
        const readMeta = (k: string) => (typeof metadata?.[k] === "string" ? (metadata[k] as string) : undefined);
        const clientRef = typeof object?.client_reference_id === "string" ? object.client_reference_id : undefined;
        const tenantId = clientRef ?? readMeta("tenantId");
        const ownerUserId = readMeta("ownerUserId");
        try {
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
        } catch (err) {
          console.warn("[stripe-webhook] analytics failed (ignored)", err);
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
