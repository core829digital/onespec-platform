// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientIp, isIp } from "../../convex/lib/clientIp";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp", () => {
  it("accepts well-formed IPv4 and IPv6 only", () => {
    for (const ok of ["1.2.3.4", "255.255.255.255", "::1", "2001:db8::1", "::ffff:1.2.3.4"]) expect(isIp(ok), ok).toBe(true);
    for (const bad of ["", "unknown", "1.2.3", "256.1.1.1", "1.2.3.4.5", "a:b", "x".repeat(60), "<script>", "1.2.3.4, 5.6.7.8", "2001::db8::1"]) expect(isIp(bad), bad).toBe(false);
  });

  it("prefers cf-connecting-ip, then the first valid x-forwarded-for entry", () => {
    expect(clientIp(h({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(h({ "x-forwarded-for": "junk, 1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "cf-connecting-ip": "junk", "x-forwarded-for": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("collapses missing or junk headers into one identity instead of minting a bucket per value", () => {
    expect(clientIp(h({}))).toBe("unknown");
    expect(clientIp(h({ "x-forwarded-for": "a, b, c" }))).toBe("unknown");
    expect(clientIp(h({ "cf-connecting-ip": "random-" + Math.random() }))).toBe("unknown");
  });

  it("normalises IPv6 case so one visitor is one bucket", () => {
    expect(clientIp(h({ "cf-connecting-ip": "2001:DB8::1" }))).toBe("2001:db8::1");
  });
});
