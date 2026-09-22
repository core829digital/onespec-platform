import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Resend webhooks are signed by Svix, not a plain HMAC of the body: headers
// are `svix-id`/`svix-timestamp`/`svix-signature`, the signed content is
// `${id}.${timestamp}.${rawBody}`, the secret is base64 (after the `whsec_`
// prefix), and the signature is base64 — not hex. See
// https://docs.svix.com/receiving/verifying-payloads/how-manual
async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  rawBody: string,
  svixSignatureHeader: string,
): Promise<boolean> {
  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header holds space-separated "v1,<base64sig>" entries (supports secret
  // rotation) — any match is valid. Constant-time compare each candidate.
  const candidates = svixSignatureHeader.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  return candidates.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

export const resendWebhook = httpAction(async (ctx, request: Request) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (webhookSecret) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn("[email-webhook] Missing svix-* headers");
      return new Response(JSON.stringify({ error: "Missing signature headers" }), { status: 401 });
    }
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(svixTimestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_TIMESTAMP_SKEW_SECONDS) {
      console.warn("[email-webhook] Stale timestamp, possible replay");
      return new Response(JSON.stringify({ error: "Stale timestamp" }), { status: 401 });
    }
    const ok = await verifySvixSignature(webhookSecret, svixId, svixTimestamp, rawBody, svixSignature);
    if (!ok) {
      console.warn("[email-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }
  }

  if (typeof payload !== "object" || payload === null || !("type" in payload)) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  const { type, data } = payload as { type: string; data: Record<string, unknown> };

  if (type !== "email") {
    return new Response(JSON.stringify({ ok: true }));
  }

  const { email_id: resendId, event, created_at, recipient, ...detail } = data as {
    email_id: string;
    event: "delivered" | "bounced" | "complained" | "opened" | "clicked";
    created_at: string;
    recipient: string;
    [key: string]: unknown;
  };

  const emailLogs = await ctx.runQuery(internal.email.getByResendId, { resendId });
  if (!emailLogs || emailLogs.length === 0) {
    console.warn(`[email-webhook] No emailLog found for resendId: ${resendId}`);
    return new Response(JSON.stringify({ ok: true }));
  }

  const emailLog = emailLogs[0];
  const timestamp = new Date(created_at).getTime();

  await ctx.runMutation(internal.email.createDeliveryLog, {
    emailLogId: emailLog._id,
    event,
    timestamp,
    detail,
    recipient,
  });

  if (event === "bounced" || event === "complained") {
    await ctx.runMutation(internal.email.updateStatus, {
      emailLogId: emailLog._id,
      status: "failed",
      error: `${event}: ${JSON.stringify(detail)}`,
    });
  }

  return new Response(JSON.stringify({ ok: true }));
});
