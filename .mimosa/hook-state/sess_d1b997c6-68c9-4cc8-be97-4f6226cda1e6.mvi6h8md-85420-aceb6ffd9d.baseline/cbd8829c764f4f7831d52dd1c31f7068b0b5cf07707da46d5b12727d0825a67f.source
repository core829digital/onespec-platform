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
    const logs = await t.run((ctx) => ctx.db.query("emailLog").collect());
    expect(logs.map((l) => l.status)).toEqual(["failed", "sent"]);
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
});
