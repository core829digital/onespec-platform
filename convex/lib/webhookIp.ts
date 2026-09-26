/**
 * Source-IP allowlists for inbound webhooks, built from each provider's own
 * published list (never hardcoded — the lists rotate):
 *   - Stripe: https://stripe.com/files/ips/ips_webhooks.json  ({ WEBHOOKS: string[] })
 *   - Svix (Resend's webhook sender): https://docs.svix.com/webhook-ips.json  ({ <region>: string[] }, IPv4/IPv6 + CIDR)
 *
 * This is defence in depth. The HMAC signature remains the authoritative check;
 * the IP check just stops non-provider traffic before any work is done. It is
 * deliberately conservative about what it blocks:
 *   - no client IP visible, or no list obtainable  -> "unverified" (not blocked)
 *   - WEBHOOK_IP_ENFORCE=0 (kill switch)           -> never blocks, still logs
 */

export type WebhookSource = "stripe" | "svix";
export type IpVerdict = "allowed" | "blocked" | "unverified";

const SOURCES: Record<WebhookSource, string> = {
  stripe: "https://stripe.com/files/ips/ips_webhooks.json",
  svix: "https://docs.svix.com/webhook-ips.json",
};
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<WebhookSource, { entries: string[]; fetchedAt: number }>();

/** Every string in the provider payload (handles `{WEBHOOKS:[..]}` and `{region:[..]}`). */
export function extractEntries(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const out: string[] = [];
  for (const v of Object.values(json as Record<string, unknown>)) {
    if (Array.isArray(v)) for (const e of v) if (typeof e === "string") out.push(e.trim());
  }
  return out;
}

function parseIp(ip: string): { bits: 32 | 128; value: bigint } | null {
  ip = ip.trim().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.some((p) => p > 255)) return null;
    return { bits: 32, value: parts.reduce((a, p) => (a << BigInt(8)) | BigInt(p), BigInt(0)) };
  }
  if (!ip.includes(":") || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  let value = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    value = (value << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return { bits: 128, value };
}

/** True when `ip` equals, or falls inside the CIDR of, any entry. */
export function ipMatches(ip: string, entries: string[]): boolean {
  const addr = parseIp(ip);
  if (!addr) return false;
  for (const entry of entries) {
    const [base, prefixStr] = entry.split("/");
    const net = parseIp(base);
    if (!net || net.bits !== addr.bits) continue;
    const prefix = prefixStr === undefined ? net.bits : Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > net.bits) continue;
    const shift = BigInt(net.bits - prefix);
    if (addr.value >> shift === net.value >> shift) return true;
  }
  return false;
}

async function loadEntries(source: WebhookSource): Promise<string[] | null> {
  const hit = cache.get(source);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.entries;
  try {
    const res = await fetch(SOURCES[source]);
    if (!res.ok) throw new Error(String(res.status));
    const entries = extractEntries(await res.json());
    if (entries.length === 0) throw new Error("empty list");
    cache.set(source, { entries, fetchedAt: Date.now() });
    return entries;
  } catch {
    return hit?.entries ?? null; // stale list beats no list
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "";
}

/** Verdict for the request's source IP, plus whether it should be rejected. */
export async function checkWebhookSource(
  req: Request,
  source: WebhookSource,
): Promise<{ verdict: IpVerdict; ip: string; reject: boolean }> {
  const ip = clientIp(req);
  if (!ip) return { verdict: "unverified", ip, reject: false };
  const entries = await loadEntries(source);
  if (!entries) return { verdict: "unverified", ip, reject: false };
  const verdict: IpVerdict = ipMatches(ip, entries) ? "allowed" : "blocked";
  const enforce = process.env.WEBHOOK_IP_ENFORCE !== "0";
  return { verdict, ip, reject: verdict === "blocked" && enforce };
}
