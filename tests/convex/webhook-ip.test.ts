import { describe, expect, test } from "vitest";
import { extractEntries, ipMatches } from "../../convex/lib/webhookIp";

describe("webhook source IP matching", () => {
  test("extracts entries from Stripe and Svix payload shapes", () => {
    expect(extractEntries({ WEBHOOKS: ["3.18.12.63"] })).toEqual(["3.18.12.63"]);
    expect(extractEntries({ us: ["1.2.3.4"], eu: ["2a05:d028:17:8000::/56"] })).toEqual(["1.2.3.4", "2a05:d028:17:8000::/56"]);
    expect(extractEntries(null)).toEqual([]);
    expect(extractEntries({ a: "x" })).toEqual([]);
  });

  test("IPv4 exact and CIDR", () => {
    expect(ipMatches("3.18.12.63", ["3.18.12.63"])).toBe(true);
    expect(ipMatches("3.18.12.64", ["3.18.12.63"])).toBe(false);
    expect(ipMatches("10.1.2.3", ["10.1.0.0/16"])).toBe(true);
    expect(ipMatches("10.2.2.3", ["10.1.0.0/16"])).toBe(false);
  });

  test("IPv6 exact, compressed and /56 CIDR", () => {
    expect(ipMatches("2600:1f24:64:8000::1", ["2600:1f24:64:8000::/56"])).toBe(true);
    expect(ipMatches("2600:1f24:64:80ff::1", ["2600:1f24:64:8000::/56"])).toBe(true);
    expect(ipMatches("2600:1f24:64:8100::1", ["2600:1f24:64:8000::/56"])).toBe(false);
    expect(ipMatches("2600:1f24:64:8000:0:0:0:1", ["2600:1f24:64:8000::/56"])).toBe(true);
  });

  test("rejects malformed input and mixed families", () => {
    expect(ipMatches("", ["1.2.3.4"])).toBe(false);
    expect(ipMatches("999.1.1.1", ["999.1.1.1"])).toBe(false);
    expect(ipMatches("not-an-ip", ["1.2.3.4"])).toBe(false);
    expect(ipMatches("1.2.3.4", ["2600:1f24:64:8000::/56"])).toBe(false);
    expect(ipMatches("::1", ["1.2.3.4"])).toBe(false);
  });
});
