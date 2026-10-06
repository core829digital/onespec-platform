import { NextResponse, type NextRequest } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { widgetIdFromUrl } from "@/lib/oembed";

/**
 * oEmbed provider (https://oembed.com): a site builder or CMS that is given the link of a configurator
 * (`/c/<id>` or `/w/<id>`) asks this endpoint for the HTML to show, so the dealer only pastes a link.
 * Same-origin links only, published configurators on a plan that includes the widget only.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const json = (body: unknown, status = 200, cache = "public, max-age=300, s-maxage=3600") =>
  NextResponse.json(body, { status, headers: { "Cache-Control": status === 200 ? cache : "no-store", "Access-Control-Allow-Origin": "*" } });

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const format = searchParams.get("format");
  if (format && format !== "json") return json({ error: "Only the json format is supported" }, 501);
  const url = searchParams.get("url");
  if (!url) return json({ error: "Missing url" }, 400);
  const id = widgetIdFromUrl(url, origin);
  if (!id) return json({ error: "Not an embeddable link" }, 404);

  let policy: Awaited<ReturnType<typeof fetchQuery<typeof api.widget.getEmbedPolicy>>>;
  try {
    policy = await fetchQuery(api.widget.getEmbedPolicy, { publicId: id });
  } catch {
    return json({ error: "Temporarily unavailable" }, 503);
  }
  if (!policy.exists || !policy.active || !policy.widgetAllowed) return json({ error: "Not found" }, 404);

  const maxWidth = Number(searchParams.get("maxwidth"));
  const maxHeight = Number(searchParams.get("maxheight"));
  const width = Number.isFinite(maxWidth) && maxWidth >= 300 ? Math.min(Math.floor(maxWidth), 1200) : 800;
  const height = Number.isFinite(maxHeight) && maxHeight >= 400 ? Math.min(Math.floor(maxHeight), 2000) : 720;
  const title = policy.name || "Configuratore";
  const html = `<iframe src="${esc(`${origin}/w/${id}`)}" title="${esc(title.slice(0, 120))}" width="${width}" height="${height}" style="width:100%;max-width:${width}px;border:0" loading="lazy"></iframe>`;
  return json({
    version: "1.0",
    type: "rich",
    provider_name: "OneSpec",
    provider_url: origin,
    title,
    html,
    width,
    height,
    cache_age: 3600,
  });
}
