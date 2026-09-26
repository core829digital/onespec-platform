/**
 * Server-side Cloudflare Turnstile verification for the auth front door
 * (signup / login / password reset). Same contract as the widget endpoint in
 * convex/http.ts: permissive while TURNSTILE_SECRET is unset, strict once set.
 *
 * Tokens are single-use by Cloudflare's design: siteverify rejects a token it
 * has already validated ("timeout-or-duplicate"), so no local replay table is
 * needed.
 */

/** Raw siteverify call. False on any failure (network, bad secret, bad token). */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // disabled until configured
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  let result: { success?: boolean; hostname?: string };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    if (!res.ok) return false;
    result = (await res.json()) as { success?: boolean; hostname?: string };
  } catch {
    return false;
  }
  if (result.success !== true) return false;
  // Optional hostname allowlist (comma-separated). Unset = accept any
  // hostname Cloudflare reports (the widget may serve several front doors).
  const allowed = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && (!result.hostname || !allowed.includes(result.hostname.toLowerCase()))) {
    return false;
  }
  return true;
}
