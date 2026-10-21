// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

let policy: Record<string, unknown> | Error = {};
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn(async () => { if (policy instanceof Error) throw policy; return policy; }) }));

import { widgetIdFromUrl } from "../src/lib/oembed";
import { GET } from "../src/app/api/oembed/route";
import { NextRequest } from "next/server";

const ORIGIN = "https://platform.example";
const call = (qs: string) => GET(new NextRequest(`${ORIGIN}/api/oembed?${qs}`));
const ok = { exists: true, active: true, widgetAllowed: true, name: 'Rossi "Infissi" <b>', frameAncestors: [] };

beforeEach(() => { policy = ok; });

describe("widgetIdFromUrl", () => {
  it("accepts the hosted page and the widget link of this platform", () => {
    expect(widgetIdFromUrl(`${ORIGIN}/c/ABCDEF1234`, ORIGIN)).toBe("ABCDEF1234");
    expect(widgetIdFromUrl(`${ORIGIN}/w/ABCDEF1234/`, ORIGIN)).toBe("ABCDEF1234");
    expect(widgetIdFromUrl(`${ORIGIN}/c/ABCDEF1234?lang=fr`, ORIGIN)).toBe("ABCDEF1234");
  });
  it("refuses other origins, other paths and malformed ids", () => {
    for (const u of ["https://evil.example/c/ABCDEF1234", `${ORIGIN}/app/dashboard`, `${ORIGIN}/c/short`, `${ORIGIN}/c/ABC DEF 1234`, `${ORIGIN}/c/ABCDEF1234/extra`, `${ORIGIN}/c/<script>`, "not a url", `javascript:alert(1)`, `${ORIGIN}@evil.example/c/ABCDEF1234`]) {
      expect(widgetIdFromUrl(u, ORIGIN), u).toBeNull();
    }
  });
});

describe("GET /api/oembed", () => {
  it("returns a rich embed with an iframe on this platform, attributes escaped", async () => {
    const res = await call(`format=json&url=${encodeURIComponent(`${ORIGIN}/c/ABCDEF1234`)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ version: "1.0", type: "rich", provider_name: "OneSpec", provider_url: ORIGIN, cache_age: 3600 });
    expect(body.html).toContain(`src="${ORIGIN}/w/ABCDEF1234"`);
    expect(body.html).toContain('loading="lazy"');
    expect(body.html).not.toMatch(/<script|<b>|"Infissi"/); // the dealer's name cannot break out of the attribute
    expect(body.html).toContain("&quot;Infissi&quot;");
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });
  it("clamps the requested size", async () => {
    const body = await (await call(`url=${encodeURIComponent(`${ORIGIN}/w/ABCDEF1234`)}&maxwidth=99999&maxheight=1`)).json();
    expect(body.width).toBe(1200);
    expect(body.height).toBe(720);
  });
  it("only json; a url is required", async () => {
    expect((await call(`format=xml&url=${encodeURIComponent(`${ORIGIN}/c/ABCDEF1234`)}`)).status).toBe(501);
    expect((await call("format=json")).status).toBe(400);
  });
  it("404 for foreign or malformed links, unknown, unpublished or not-on-the-plan widgets", async () => {
    expect((await call(`url=${encodeURIComponent("https://evil.example/c/ABCDEF1234")}`)).status).toBe(404);
    for (const p of [{ ...ok, exists: false }, { ...ok, active: false }, { ...ok, widgetAllowed: false }]) {
      policy = p;
      expect((await call(`url=${encodeURIComponent(`${ORIGIN}/c/ABCDEF1234`)}`)).status).toBe(404);
    }
  });
  it("503 (never a crash) when the backend is unreachable, and errors are never cached", async () => {
    policy = new Error("down");
    const res = await call(`url=${encodeURIComponent(`${ORIGIN}/c/ABCDEF1234`)}`);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
