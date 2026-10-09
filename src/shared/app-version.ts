/**
 * The product version shown in the side menu. The marketing site (onespec.eu → /api/version, fed by its changelog) is the single source
 * of truth: publishing a new entry there changes the number here without redeploying the platform. BUNDLED_VERSION is only the
 * fallback while the site cannot be reached; tests/app-version.test.ts fails if it falls behind the site's last known release.
 */
export const BUNDLED_VERSION = "1.15.0";

/** How often an open session re-reads the version (and on returning to the tab). */
export const VERSION_REFRESH_MS = 10 * 60 * 1000;

const SEMVER = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isVersion(v: unknown): v is string {
  return typeof v === "string" && SEMVER.test(v);
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Public page that lists what changed in each version (the site's Versioni page, in the reader's language). */
export function versionsPageUrl(siteUrl: string, locale: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${locale === "it" ? "" : `/${locale}`}/versioni`;
}
