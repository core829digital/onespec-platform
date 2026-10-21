// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { postQuote } from "../src/components/widget/post-quote";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: string, type = "application/json") => new Response(body, { status, headers: { "content-type": type } });

describe("postQuote", () => {
  it("success: ok with the reference", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, JSON.stringify({ ok: true, referenceId: "Q-1" }))));
    expect(await postQuote("https://x/api", { a: 1 })).toEqual({ ok: true, error: undefined, referenceId: "Q-1" });
  });
  it("refusals keep the server's code (the widget turns it into words)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(429, JSON.stringify({ ok: false, error: "RATE_LIMITED" }))));
    expect(await postQuote("https://x/api", {})).toMatchObject({ ok: false, error: "RATE_LIMITED" });
  });
  it("a 200 that says ok:false, or a body that is not JSON, is a failure with a generic code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, JSON.stringify({ ok: false }))));
    expect(await postQuote("https://x/api", {})).toMatchObject({ ok: false, error: "BAD_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, "<html>oops</html>", "text/html")));
    expect(await postQuote("https://x/api", {})).toMatchObject({ ok: false, error: "BAD_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, JSON.stringify({ ok: "yes" }))));
    expect((await postQuote("https://x/api", {})).ok).toBe(false);
  });
  it("sends JSON and aborts a request that never answers after the timeout (no endless spinner)", async () => {
    vi.useFakeTimers();
    let seen: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      seen = init;
      return new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }));
    const pending = postQuote("https://x/api", { hello: "world" }, 5000);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(seen?.method).toBe("POST");
    expect(JSON.parse(String(seen?.body))).toEqual({ hello: "world" });
  });
  it("a network failure rejects (the widget shows its generic message)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(postQuote("https://x/api", {})).rejects.toThrow("Failed to fetch");
  });
});
