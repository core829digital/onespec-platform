import { NextResponse } from "next/server";
import { BUNDLED_VERSION, isVersion } from "@/shared/app-version";

/**
 * The version the side menu prints. Read from the marketing site (single source of truth: its changelog), validated strictly, cached
 * for five minutes; if the site is down or answers something unexpected, the bundled version is returned instead. Never throws.
 */
// Rendered per request (never frozen at build time); the fetch below is what is cached for five minutes.
export const dynamic = "force-dynamic";

const SITE = (process.env.MARKETING_SITE_URL || "https://onespec.eu").replace(/\/+$/, "");

export async function GET() {
  let version = BUNDLED_VERSION;
  let source: "site" | "bundled" = "bundled";
  try {
    const res = await fetch(`${SITE}/api/version`, { signal: AbortSignal.timeout(3000), next: { revalidate: 300 } });
    if (res.ok) {
      const body: unknown = await res.json();
      const v = typeof body === "object" && body !== null ? (body as { version?: unknown }).version : undefined;
      if (isVersion(v)) {
        version = v;
        source = "site";
      }
    }
  } catch {
    /* site unreachable: keep the bundled number */
  }
  return NextResponse.json({ version, source }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } });
}
