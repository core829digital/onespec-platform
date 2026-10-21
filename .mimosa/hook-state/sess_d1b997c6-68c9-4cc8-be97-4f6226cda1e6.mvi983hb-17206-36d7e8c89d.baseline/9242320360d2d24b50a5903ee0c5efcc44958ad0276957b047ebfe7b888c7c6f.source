// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A cheap last line of defence in CI (GitHub secret scanning + push protection are the main one): no private key or live
// payment / mail / cloud credential in any tracked file. Public identifiers (PostHog "phc_" key, Sentry DSN, Stripe "pk_") are fine.
const PATTERNS: Array<[string, RegExp]> = [
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["Stripe live secret key", /\bsk_live_[0-9A-Za-z]{16,}/],
  ["Stripe restricted key", /\brk_live_[0-9A-Za-z]{16,}/],
  ["Stripe webhook secret", /\bwhsec_[0-9A-Za-z]{20,}/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[0-9A-Za-z]{30,}/],
  ["Resend API key", /\bre_[0-9A-Za-z]{20,}_[0-9A-Za-z]{10,}/],
  ["Convex deploy key", /\b(?:prod|dev):[a-z0-9-]+\|[0-9A-Za-z+/=_-]{30,}/],
  ["Slack token", /\bxox[abprs]-[0-9A-Za-z-]{20,}/],
];

describe("no credentials in the repository", () => {
  it("tracked files contain none of the well-known secret shapes", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)
      // .env.example is the template of placeholders (it shows the shape of the JWT key on purpose); lockfiles and binaries carry no secrets.
      .filter((f) => !/\.(png|jpe?g|gif|ico|webp|woff2?|pdf|mp4|webm|lock)$/i.test(f) && !f.endsWith("package-lock.json") && f !== ".env.example");
    const hits: string[] = [];
    for (const f of files) {
      let text: string;
      try {
        text = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      for (const [name, re] of PATTERNS) if (re.test(text)) hits.push(`${f}: ${name}`);
    }
    expect(hits).toEqual([]);
  });
});
