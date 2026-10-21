import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { parseResendEvent } from "../../convex/lib/resendEvent";
import { newDb } from "./_helpers";

const SECRET_RAW = "super-secret-bytes-0123456789abcdef";
const SECRET = "whsec_" + Buffer.from(SECRET_RAW).toString("base64");

async function sign(id: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET_RAW), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return "v1," + Buffer.from(new Uint8Array(mac)).toString("base64");
}

beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  process.env.WEBHOOK_IP_ENFORCE = "0";
});
afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  delete process.env.WEBHOOK_IP_ENFORCE;
});

const event = (type: string, emailId = "re_1") =>
  JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: emailId, to: ["dest@example.com"], subject: "x", bounce: { type: "Permanent", message: "no such user" } } });

async function post(t: ReturnType<typeof newDb>, body: string, over: { id?: string; ts?: string; sig?: string } = {}) {
  const id = over.id ?? "msg_1";
  const ts = over.ts ?? String(Math.floor(Date.now() / 1000));
  return t.fetch("/api/email/webhook", {
    method: "POST",
    headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": over.sig ?? (await sign(id, ts, body)) },
    body,
  });
}

async function seedLog(t: ReturnType<typeof newDb>) {
  return t.run((ctx) => ctx.db.insert("emailLog", { to: "dest@example.com", template: "welcome", subject: "s", status: "sent", resendId: "re_1", createdAt: Date.now() }));
}

describe("parseResendEvent", () => {
  test("maps Resend's real shape", () => {
    const p = parseResendEvent(JSON.parse(event("email.bounced")));
    expect(p).toMatchObject({ event: "bounced", resendId: "re_1", recipient: "dest@example.com" });
    expect(p?.detail.bounce).toEqual({ type: "Permanent", message: "no such user" });
  });
  test("ignores untracked / foreign events and malformed data", () => {
    expect(parseResendEvent({ type: "email.sent", data: { email_id: "x" } })).toBeNull();
    expect(parseResendEvent({ type: "domain.created", data: {} })).toBeNull();
    expect(parseResendEvent({ type: "email.delivered", data: {} })).toBeNull();
    expect(parseResendEvent({ type: "email.delivered" })).toBeNull();
    expect(parseResendEvent(null)).toBeNull();
    expect(parseResendEvent("x")).toBeNull();
  });
  test("far-future timestamps fall back to receipt time", () => {
    const now = 1_000_000;
    const p = parseResendEvent({ type: "email.delivered", created_at: "2999-01-01T00:00:00Z", data: { email_id: "x", to: ["a@b.co"] } }, now);
    expect(p?.timestamp).toBe(now);
  });
});

describe("POST /api/email/webhook", () => {
  test("a signed bounce is logged once and flips the email to failed; a replay is a no-op", async () => {
    const t = newDb();
    const logId = await seedLog(t);
    const body = event("email.bounced");
    expect((await post(t, body)).status).toBe(200);
    expect((await post(t, body)).status).toBe(200); // same svix-id
    const rows = await t.run((ctx) => ctx.db.query("emailDeliveryLog").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "bounced", recipient: "dest@example.com", svixId: "msg_1" });
    expect((await t.run((ctx) => ctx.db.get(logId)))?.status).toBe("failed");
  });

  test("bad signature, missing headers and stale timestamp are refused and change nothing", async () => {
    const t = newDb();
    const logId = await seedLog(t);
    const body = event("email.complained");
    expect((await post(t, body, { sig: "v1,AAAA" })).status).toBe(401);
    expect((await t.fetch("/api/email/webhook", { method: "POST", body })).status).toBe(401);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect((await post(t, body, { ts: old })).status).toBe(401);
    // A body altered after signing no longer verifies.
    const sig = await sign("msg_1", String(Math.floor(Date.now() / 1000)), body);
    expect((await post(t, body.replace("re_1", "re_2"), { sig })).status).toBe(401);
    expect(await t.run((ctx) => ctx.db.query("emailDeliveryLog").collect())).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(logId)))?.status).toBe("sent");
  });

  test("not configured → closed (503); unknown email id and untracked events are acknowledged", async () => {
    const t = newDb();
    await seedLog(t);
    expect((await post(t, event("email.delivered", "re_unknown"), { id: "m2" })).status).toBe(200);
    expect((await post(t, event("email.sent"), { id: "m3" })).status).toBe(200);
    expect(await t.run((ctx) => ctx.db.query("emailDeliveryLog").collect())).toHaveLength(0);
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await post(t, event("email.delivered"))).status).toBe(503);
  });

  test("delivered is logged without touching the email status", async () => {
    const t = newDb();
    const logId = await seedLog(t);
    expect((await post(t, event("email.delivered"), { id: "m9" })).status).toBe(200);
    expect(await t.run((ctx) => ctx.db.query("emailDeliveryLog").collect())).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.get(logId)))?.status).toBe("sent");
  });
});

describe("email hardening (S3)", () => {
  test("send refuses recipients with header-injection / multiple addresses", async () => {
    const { internal } = await import("../../convex/_generated/api");
    const t = newDb();
    for (const to of ["a@b.co\r\nBcc: x@y.z", "a@b.co, c@d.ef", "Name <a@b.co>", "not-an-email"]) {
      await t.action(internal.email.send, { template: "welcome", to, locale: "it", data: {} });
    }
    const logs = await t.run((ctx) => ctx.db.query("emailLog").collect());
    expect(logs).toHaveLength(4);
    expect(logs.every((l) => l.status === "failed" && l.error === "INVALID_RECIPIENT")).toBe(true);
  });
});
