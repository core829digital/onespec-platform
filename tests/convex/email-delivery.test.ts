import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb } from "./_helpers";

/** Launch audit: transient provider errors are retried; live logs never store bodies (codes/links). */
beforeEach(() => {
  vi.useFakeTimers();
  process.env.RESEND_MODE = "live";
  process.env.AUTH_RESEND_KEY = "re_test";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.RESEND_MODE;
  delete process.env.AUTH_RESEND_KEY;
});

describe("email delivery", () => {
  test("a 503 is retried and then delivered; the body (with the code) is never stored", async () => {
    const responses = [
      new Response(JSON.stringify({ message: "busy" }), { status: 503 }),
      new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
    ];
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal("fetch", fetchMock);

    const t = newDb();
    await t.action(internal.email.send, { template: "verify", to: "a@example.com", locale: "it", data: { code: "987654" } });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // One logical send = one row (#41): created queued before the first POST,
    // patched through failed (attempt 1) to sent (attempt 2) — and both POSTs
    // carried the same idempotency key.
    const logs = await t.run((ctx) => ctx.db.query("emailLog").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "sent", resendId: "re_123" });
    expect(logs[0].sendKey).toBeDefined();
    const keys = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).map((c) => (c[1].headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys).toEqual([logs[0]!.sendKey, logs[0]!.sendKey]);
    expect(JSON.stringify(logs)).not.toContain("987654");
  });

  test("a permanent 4xx is not retried", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "invalid to" }), { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = newDb();
    await t.action(internal.email.send, { template: "welcome", to: "bad@example.com", locale: "it", data: {} });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries stop after 3 attempts", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = newDb();
    await t.action(internal.email.send, { template: "welcome", to: "x@example.com", locale: "it", data: {} });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("retention purges email logs older than 90 days", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const t = newDb();
    await t.run((ctx) => ctx.db.insert("emailLog", { to: "o@example.com", template: "welcome", subject: "s", status: "sent", createdAt: Date.now() }));
    vi.setSystemTime(Date.now() + 91 * 86_400_000);
    expect(await t.mutation(internal.email.purgeOldEmailLogs, {})).toBe(1);
  });

  test("a logical send owns one queued row and its idempotency key (#41)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "re_k" }), { status: 200 })));
    const t = newDb();
    const args1 = { template: "welcome" as const, to: "k@example.com", tenantId: undefined, relatedEntityId: undefined, subject: "s" };
    const first = await t.mutation(internal.email.beginSend, args1);
    expect(first.reused).toBe(false);
    // A crash-retried action re-finds the still-queued row and reuses its key.
    const again = await t.mutation(internal.email.beginSend, args1);
    expect(again.logId).toBe(first.logId);
    expect(again.sendKey).toBe(first.sendKey);
    expect(again.reused).toBe(true);
    // A different logical send gets its own row and key.
    const other = await t.mutation(internal.email.beginSend, { ...args1, relatedEntityId: "quote_7" });
    expect(other.logId).not.toBe(first.logId);
  });

  test("the live POST carries the row's idempotency key and patches that row (#41)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_k2" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = newDb();
    const begin = await t.mutation(internal.email.beginSend, {
      template: "welcome", to: "k2@example.com", tenantId: undefined, relatedEntityId: undefined, subject: "Benvenuti",
    });
    await t.action(internal.email.send, {
      template: "welcome", to: "k2@example.com", locale: "it", data: {},
      logId: begin.logId, sendKey: begin.sendKey,
    });
    const headers = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]![1].headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(begin.sendKey);
    const rows = await t.run((ctx) => ctx.db.query("emailLog").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "sent", resendId: "re_k2", sendKey: begin.sendKey });
  });
});
