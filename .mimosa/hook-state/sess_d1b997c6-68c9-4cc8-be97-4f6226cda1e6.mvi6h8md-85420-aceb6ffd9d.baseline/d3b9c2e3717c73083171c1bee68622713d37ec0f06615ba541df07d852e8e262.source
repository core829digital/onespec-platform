// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { BUNDLED_VERSION, compareVersions, isVersion, versionsPageUrl } from "../src/shared/app-version";
import { GET } from "../src/app/api/version/route";

afterEach(() => vi.unstubAllGlobals());

describe("version helpers", () => {
  test("only plain x.y.z is accepted (nothing from the network is shown unchecked)", () => {
    expect(isVersion("1.15.0")).toBe(true);
    for (const bad of ["1.15", "v1.15.0", "1.15.0-beta", "<script>", "1.2.3.4", "", 5, null, undefined]) expect(isVersion(bad)).toBe(false);
    expect(isVersion(BUNDLED_VERSION)).toBe(true);
  });
  test("numeric comparison, not alphabetical", () => {
    expect(compareVersions("1.15.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.15.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
  test("link to the Versioni page follows the site's locale rule (Italian has no prefix)", () => {
    expect(versionsPageUrl("https://onespec.eu/", "it")).toBe("https://onespec.eu/versioni");
    expect(versionsPageUrl("https://onespec.eu", "de")).toBe("https://onespec.eu/de/versioni");
  });
});

describe("GET /api/version", () => {
  const answer = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

  test("returns the site's version, so a new release there reaches the platform by itself", async () => {
    vi.stubGlobal("fetch", answer({ product: "onespec", version: "1.16.0", date: "2026-10-10" }));
    expect(await (await GET()).json()).toEqual({ version: "1.16.0", source: "site" });
  });
  test.each([
    ["site error", answer({}, false)],
    ["unexpected body", answer({ version: "<b>1.0.0</b>" })],
    ["no version", answer({})],
    ["network failure", vi.fn().mockRejectedValue(new Error("down"))],
  ])("falls back to the bundled version on %s", async (_n, f) => {
    vi.stubGlobal("fetch", f);
    expect(await (await GET()).json()).toEqual({ version: BUNDLED_VERSION, source: "bundled" });
  });
});
