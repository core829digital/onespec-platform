import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { regionForCountry, countryFromAcceptLanguage } from "@/convex/lib/regions";

/**
 * Best-effort country + region detection for the sign-up funnel. Reads the edge
 * geo header (Vercel / Cloudflare) with an Accept-Language fallback. The client
 * passes the result to `registerTenant`; it is advisory only — the authoritative
 * market is `tenant.country`, which an owner can change in settings.
 */
export async function GET() {
  const h = await headers();
  const c = await cookies();
  const geo =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    c.get("onespec-country")?.value ??
    null;
  const fallback = countryFromAcceptLanguage(h.get("accept-language"));
  const country = (geo || fallback || null)?.toUpperCase() ?? null;
  const region = regionForCountry(country);

  return NextResponse.json(
    {
      country,
      source: geo ? "geo" : fallback ? "accept-language" : "default",
      region: region.code,
      widgetMode: region.widgetMode,
      currency: region.currency,
    },
    { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
  );
}
