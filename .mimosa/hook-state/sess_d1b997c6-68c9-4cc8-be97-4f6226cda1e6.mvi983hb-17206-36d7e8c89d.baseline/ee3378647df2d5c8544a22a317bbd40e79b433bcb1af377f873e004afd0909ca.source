import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { newDb } from "./_helpers";

const KEYS = ["OPS_ALERT_EMAIL", "AUTH_RESEND_KEY"] as const;
const saved: Record<string, string | undefined> = {};
let sent: Array<{ to: string[]; subject: string; text: string }> = [];

beforeEach(() => {
  vi.useFakeTimers();
  for (const k of KEYS) saved[k] = process.env[k];
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { body?: string }) => {
      sent.push(JSON.parse(init?.body ?? "{}"));
      return new Response("{}", { status: 200 });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("ops alerts", () => {
  test("without OPS_ALERT_EMAIL nothing is e-mailed (still logged)", async () => {
    delete process.env.OPS_ALERT_EMAIL;
    process.env.AUTH_RESEND_KEY = "re_x";
    const r = await newDb().action(internal.ops.alert, { source: "stripe-webhook", message: "boom" });
    expect(r.sent).toBe(false);
    expect(sent).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[OPS-ALERT] stripe-webhook"));
  });

  test("sends to every configured recipient, then throttles the same source", async () => {
    process.env.OPS_ALERT_EMAIL = "a@example.com, b@example.com";
    process.env.AUTH_RESEND_KEY = "re_x";
    const t = newDb();
    expect((await t.action(internal.ops.alert, { source: "stripe-webhook", message: "first" })).sent).toBe(true);
    expect(sent[0].to).toEqual(["a@example.com", "b@example.com"]);
    expect(sent[0].subject).toContain("stripe-webhook");
    // same source again within 30 minutes → no second e-mail
    expect((await t.action(internal.ops.alert, { source: "stripe-webhook", message: "again" })).sent).toBe(false);
    // a different source is independent
    expect((await t.action(internal.ops.alert, { source: "widget-quote-submit", message: "other" })).sent).toBe(true);
    expect(sent).toHaveLength(2);
  });
});
