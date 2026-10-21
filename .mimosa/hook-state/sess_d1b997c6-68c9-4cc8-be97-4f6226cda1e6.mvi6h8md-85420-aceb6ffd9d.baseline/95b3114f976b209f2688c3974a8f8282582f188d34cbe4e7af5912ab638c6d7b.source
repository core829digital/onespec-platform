import type { AppLocale } from "@/i18n/routing";
import { REGIONS, type RegionCode } from "@/convex/lib/regions";

/**
 * Geo country (ISO-3166-1 alpha-2, e.g. Vercel `x-vercel-ip-country`) to the
 * platform locale that market operates in. Used for first-visit auto-redirect
 * only — the authoritative market is always the tenant's stored `country`.
 */
const COUNTRY_TO_LOCALE: Record<string, AppLocale> = {
  IT: "it",
  SM: "it",
  VA: "it",
  FR: "fr",
  MC: "fr",
  BE: "fr",
  LU: "fr",
  RO: "ro",
  DE: "de",
  AT: "de",
  NL: "nl",
};

/** Email allowed to preview every market from /app/admin. Founder-only. */
export const ADMIN_PREVIEW_EMAIL = "contact.core829@gmail.com";

export function localeForCountry(country: string | null | undefined): AppLocale | null {
  if (!country) return null;
  return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? null;
}

export function canPreviewMarkets(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === ADMIN_PREVIEW_EMAIL;
}

/** Markets the founder can preview, in rollout order. */
export function previewableRegions(): { code: RegionCode; label: string }[] {
  return (Object.keys(REGIONS) as RegionCode[]).map((code) => ({
    code,
    label: `${code} · ${REGIONS[code].primaryLocale.toUpperCase()}`,
  }));
}
