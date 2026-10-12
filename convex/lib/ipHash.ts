let warnedSalt = false;

/** Salted SHA-256 of a client IP — never store/compare raw IPs. */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.DAILY_IP_SALT || "dev-salt";
  // OWASP A02/A04: a public fallback salt makes the hashes guessable. Keep working (fail-open is deliberate for rate limiting) but make it loud.
  if (!process.env.DAILY_IP_SALT && !warnedSalt) {
    warnedSalt = true;
    console.warn("[security] DAILY_IP_SALT is not set: IP hashes use a public fallback salt. Set it on the Convex deployment.");
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + salt));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
