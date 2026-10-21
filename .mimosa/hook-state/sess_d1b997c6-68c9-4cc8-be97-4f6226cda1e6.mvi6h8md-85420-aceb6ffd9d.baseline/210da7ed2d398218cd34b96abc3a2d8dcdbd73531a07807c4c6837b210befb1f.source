import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withTurnstileGuard } from "../../convex/lib/authGuard";

const inner = vi.fn(async () => "authorized");

function mockSiteverify(success: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ success, hostname: "platform.onespec.eu" }), { status: 200 })),
  );
}

describe("withTurnstileGuard", () => {
  beforeEach(() => {
    inner.mockClear();
    delete process.env.TURNSTILE_SECRET;
    delete process.env.TURNSTILE_ENFORCE_AUTH;
    delete process.env.TURNSTILE_HOSTNAMES;
  });
  afterEach(() => vi.unstubAllGlobals());

  test("passes through while not enforced (no secret, or flag off)", async () => {
    const guarded = withTurnstileGuard(inner);
    expect(await guarded({ flow: "signIn" }, {})).toBe("authorized");
    process.env.TURNSTILE_SECRET = "s";
    expect(await guarded({ flow: "signIn" }, {})).toBe("authorized"); // flag still off
  });

  test("enforced: rejects missing/invalid token on signIn, signUp and reset", async () => {
    process.env.TURNSTILE_SECRET = "s";
    process.env.TURNSTILE_ENFORCE_AUTH = "1";
    mockSiteverify(false);
    const guarded = withTurnstileGuard(inner);
    for (const flow of ["signIn", "signUp", "reset"]) {
      await expect(guarded({ flow }, {})).rejects.toThrow("TURNSTILE_FAILED");
      await expect(guarded({ flow, turnstileToken: "bad" }, {})).rejects.toThrow("TURNSTILE_FAILED");
    }
    expect(inner).not.toHaveBeenCalled();
  });

  test("enforced: accepts a token Cloudflare validates", async () => {
    process.env.TURNSTILE_SECRET = "s";
    process.env.TURNSTILE_ENFORCE_AUTH = "1";
    mockSiteverify(true);
    expect(await withTurnstileGuard(inner)({ flow: "signIn", turnstileToken: "ok" }, {})).toBe("authorized");
  });

  test("enforced: OTP flows are not gated; hostname allowlist is honoured", async () => {
    process.env.TURNSTILE_SECRET = "s";
    process.env.TURNSTILE_ENFORCE_AUTH = "1";
    mockSiteverify(false);
    const guarded = withTurnstileGuard(inner);
    expect(await guarded({ flow: "email-verification" }, {})).toBe("authorized");
    expect(await guarded({ flow: "reset-verification" }, {})).toBe("authorized");

    mockSiteverify(true);
    process.env.TURNSTILE_HOSTNAMES = "evil.example";
    await expect(guarded({ flow: "signIn", turnstileToken: "t" }, {})).rejects.toThrow("TURNSTILE_FAILED");
    process.env.TURNSTILE_HOSTNAMES = "platform.onespec.eu";
    expect(await guarded({ flow: "signIn", turnstileToken: "t" }, {})).toBe("authorized");
  });
});

describe("convex/auth.ts wiring", () => {
  test("module loads: the Password provider exposes options.authorize to wrap", async () => {
    await expect(import("../../convex/auth")).resolves.toBeDefined();
  });
});
