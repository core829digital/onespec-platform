import { routing } from "@/i18n/routing";

// No trailing slashes — isAllowedPath below matches `checkPath === prefix ||
// checkPath.startsWith(prefix + "/")`, so a prefix that already ends in "/"
// makes that second check look for "//..." and never match anything. Every
// entry here used to be written without a trailing slash except the six
// guest-link ones (/f/, /i/, /w/, /c/, /q/, /k/) and the /invite/ entry added
// for the fix below — both silently never matched a single real path (found
// while root-causing the 2026-09-29 invite-redirect bug: the underlying
// double-slash bug in the match logic long predates this file's current
// entries, it just happened to never get exercised because nothing had
// generated a `?redirect=` into those guest-link routes yet).
const ALLOWED_PATH_PREFIXES = [
  "/app",
  "/auth",
  "/onboarding",
  "/f",
  "/i",
  "/w",
  "/c",
  "/q",
  "/k",
  // Team-invite acceptance (/invite/[token]) — was missing entirely, which
  // is why an invited person registering or logging in via the invite
  // page's ?redirect param always silently fell back to /auth/onboarding or
  // /app/dashboard instead of landing back on the invite to actually accept
  // it: they'd get asked to name a company and pick a country as if signing
  // up fresh, despite already being invited to a real one (2026-09-29 bug
  // report).
  "/invite",
  "/legal",
  "/api",
  "/monitoring",
];

const ALLOWED_LOCALE_PREFIXES = routing.locales.map((l) => `/${l}`);

function isAllowedPath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;

  if (pathname.startsWith("//")) return false;

  const hasLocalePrefix = ALLOWED_LOCALE_PREFIXES.some((p) => pathname.startsWith(p));
  const checkPath = hasLocalePrefix ? pathname.slice(pathname.indexOf("/", 1)) : pathname;

  return ALLOWED_PATH_PREFIXES.some((prefix) => checkPath === prefix || checkPath.startsWith(prefix + "/"));
}

export function validateRedirect(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, "http://localhost");
    const pathname = parsed.pathname;

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.host !== "localhost" && parsed.hostname !== "") return null;

    if (!isAllowedPath(pathname)) return null;

    return pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}

/** Returns a safe redirect URL, or the fallback if the URL is invalid/malicious. */
export function getSafeRedirect(url: string | null, fallback: string): string {
  return validateRedirect(url) ?? fallback;
}

/** Returns a safe redirect URL, or null if the URL is invalid and no fallback is provided. */
export function getOptionalRedirect(url: string | null): string | null {
  return validateRedirect(url);
}