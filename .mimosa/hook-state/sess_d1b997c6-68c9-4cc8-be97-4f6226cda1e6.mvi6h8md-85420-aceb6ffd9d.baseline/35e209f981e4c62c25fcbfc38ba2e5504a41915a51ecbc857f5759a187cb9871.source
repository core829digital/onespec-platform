/**
 * Keeps a referral code between the first visit (`?ref=OS-XXXXXX`) and the moment the
 * account is created, which happens after email verification on another page. Stored
 * only in this browser (localStorage), for 30 days; no cookie, no tracking. The server
 * validates the code, so nothing here is trusted.
 */
const KEY = "onespec-ref";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SHAPE = /^[A-Za-z0-9-]{4,20}$/;

/** True for something that could be a code (cheap pre-filter; the server decides). */
export function looksLikeReferralCode(value: string | null | undefined): value is string {
  return typeof value === "string" && SHAPE.test(value.trim());
}

/** Saves `?ref=` from the current URL, if present and well-formed. */
export function captureReferralFromUrl(search: string = typeof window === "undefined" ? "" : window.location.search): void {
  try {
    const ref = new URLSearchParams(search).get("ref");
    if (looksLikeReferralCode(ref)) localStorage.setItem(KEY, JSON.stringify({ code: ref.trim(), at: Date.now() }));
  } catch {
    /* storage unavailable (private mode): the referral just won't be remembered */
  }
}

/** The remembered code, or undefined when none or older than 30 days. */
export function readStoredReferral(now: number = Date.now()): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof parsed.code !== "string" || typeof parsed.at !== "number") return undefined;
    if (now - parsed.at > MAX_AGE_MS || !looksLikeReferralCode(parsed.code)) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    return parsed.code;
  } catch {
    return undefined;
  }
}

export function clearStoredReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
