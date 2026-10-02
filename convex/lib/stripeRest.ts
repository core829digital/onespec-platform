/**
 * Minimal Stripe REST client for the referral system (same style as the helpers in
 * billing.ts, which stay untouched). Unlike those, it does not throw on a non-2xx answer:
 * the caller decides (a 404 from `GET /coupons/<id>` just means "create it").
 * Supports an Idempotency-Key so a retried write can never apply twice.
 */
const STRIPE_API = "https://api.stripe.com/v1";

export interface StripeResult {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
}

export const stripeConfigured = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY);

function form(data: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) p.set(k, v);
  return p.toString();
}

export async function stripeRest(
  method: "GET" | "POST",
  path: string,
  body: Record<string, string | undefined> = {},
  idempotencyKey?: string,
): Promise<StripeResult> {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}` };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, { method, headers, body: method === "POST" ? form(body) : undefined });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export function stripeErrorMessage(r: StripeResult): string {
  return (r.json.error as { message?: string } | undefined)?.message ?? `STRIPE_HTTP_${r.status}`;
}
