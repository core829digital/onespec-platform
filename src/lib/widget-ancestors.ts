/**
 * Which sites may frame a widget (the `frame-ancestors` list), looked up per widget and cached in the memory of the server instance.
 *
 * The rule the dealers depend on: a hiccup of the database must never lock their customers out. So a failed lookup
 *  - is retried once, with a time limit (a slow answer is a failure too),
 *  - falls back to the last policy that WAS read for that widget, however old (a dealer's domain list changes rarely),
 *  - and only when nothing was ever read answers "this site only" (the safe side) for a few seconds, never for minutes: the next visitor
 *    asks again instead of inheriting the failure.
 * A policy that was read fine is kept for a minute, so a dealer who adds a domain sees it work almost at once.
 */
export interface EmbedPolicy {
  frameAncestors: string[];
}

export interface AncestorsDeps {
  fetchPolicy: (publicId: string) => Promise<EmbedPolicy>;
  now?: () => number;
  /** Development: an empty list means "anywhere" (production never does that). */
  dev?: boolean;
}

export const GOOD_TTL_MS = 60_000;
export const FAILURE_TTL_MS = 5_000;
export const STALE_MAX_MS = 24 * 3_600_000;
export const LOOKUP_TIMEOUT_MS = 3_500;
const CACHE_MAX = 5_000;

interface Entry {
  ancestors: string;
  /** Fresh until this time. */
  expires: number;
  /** True when it came from a real read (usable as a fallback later), false for a safe-side answer after a failure. */
  good: boolean;
  readAt: number;
}

const cache = new Map<string, Entry>();

export function clearAncestorsCache(): void {
  cache.clear();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function remember(publicId: string, e: Entry): void {
  // Bounded: random valid-looking ids must not grow the cache without limit (a Map iterates oldest first).
  if (cache.size >= CACHE_MAX && !cache.has(publicId)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(publicId, e);
}

export async function widgetAncestors(publicId: string, deps: AncestorsDeps): Promise<string> {
  const now = deps.now ?? Date.now;
  const hit = cache.get(publicId);
  if (hit && hit.expires > now()) return hit.ancestors;

  let policy: EmbedPolicy | null = null;
  for (let attempt = 0; attempt < 2 && !policy; attempt++) {
    try {
      policy = await withTimeout(deps.fetchPolicy(publicId), LOOKUP_TIMEOUT_MS);
    } catch {
      policy = null;
    }
  }

  if (policy) {
    const ancestors = policy.frameAncestors.length > 0 ? `'self' ${policy.frameAncestors.join(" ")}` : deps.dev ? "*" : "'self'";
    remember(publicId, { ancestors, expires: now() + GOOD_TTL_MS, good: true, readAt: now() });
    return ancestors;
  }

  // The lookup failed twice: the last good policy, however old, beats locking the dealer's visitors out.
  if (hit?.good && now() - hit.readAt < STALE_MAX_MS) {
    remember(publicId, { ...hit, expires: now() + FAILURE_TTL_MS });
    return hit.ancestors;
  }
  const safe = deps.dev ? "*" : "'self'";
  remember(publicId, { ancestors: safe, expires: now() + FAILURE_TTL_MS, good: false, readAt: now() });
  return safe;
}
