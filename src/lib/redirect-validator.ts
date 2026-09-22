import { routing } from "@/i18n/routing";

const ALLOWED_PATH_PREFIXES = [
  "/app",
  "/auth",
  "/onboarding",
  "/f/",
  "/i/",
  "/w/",
  "/c/",
  "/q/",
  "/k/",
  "/legal",
  "/api/",
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