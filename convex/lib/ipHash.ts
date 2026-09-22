/** Salted SHA-256 of a client IP — never store/compare raw IPs. */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.DAILY_IP_SALT || "dev-salt";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + salt));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
