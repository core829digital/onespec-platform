/**
 * The visitor's IP as the public endpoints use it (rate-limit buckets, abuse hashes) — one rule instead of five copies.
 *
 * Headers are client-controlled unless a trusted proxy overwrites them, and this backend cannot prove which hop wrote what, so:
 *  - only a well-formed IPv4/IPv6 address is accepted (arbitrary junk would otherwise mint a new bucket per request);
 *  - `cf-connecting-ip` wins when valid, otherwise the first valid entry of `x-forwarded-for`;
 *  - anything else collapses into a single "unknown" identity.
 * A forged address can therefore only pick a different valid bucket; the per-configurator global bucket and Turnstile (TURNSTILE_SECRET)
 * are what bound abuse that rotates addresses.
 */
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:.]{2,45}$/i;

export function isIp(value: string): boolean {
  if (IPV4.test(value)) return true;
  // IPv6 (incl. ::1 and IPv4-mapped): hex groups and colons, at least two colons, no empty-run twice.
  return IPV6.test(value) && (value.match(/:/g) ?? []).length >= 2 && (value.match(/::/g) ?? []).length <= 1;
}

export function clientIp(headers: Pick<Headers, "get">): string {
  const cf = (headers.get("cf-connecting-ip") ?? "").trim();
  if (isIp(cf)) return cf.toLowerCase();
  for (const part of (headers.get("x-forwarded-for") ?? "").split(",").slice(0, 10)) {
    const candidate = part.trim();
    if (isIp(candidate)) return candidate.toLowerCase();
  }
  return "unknown";
}
