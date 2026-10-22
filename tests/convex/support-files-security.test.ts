import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, tinyPng } from "./_helpers";
import { scanAttachment } from "../../convex/lib/malwareScan";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const chunk = (type: string, data: number[]) => { const crc32 = (bytes: number[]) => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; }; const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; return [...u32(data.length), ...ascii(type), ...data, ...u32(crc32([...ascii(type), ...data]))]; };
const png = (extra: number[] = []) => tinyPng(100, 80, extra);
const EICAR = ascii("X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

async function world() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.ownerId, { isPlatformAdmin: true }));
  const me = t.withIdentity({ subject: s.memberId });
  const upload = async (bytes: Uint8Array, name = "a.png") => {
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([bytes as BlobPart], { type: "image/png" })));
    return { storageId, res: me.action(api.supportFiles.finalizeUpload, { storageId, tenantId: s.tenantId, fileName: name }) };
  };
  const send = async (attachmentId: never) => (await me.mutation(api.support.create, { tenantId: s.tenantId, subject: "Con allegato", body: "vedi file", category: "bug", attachmentIds: [attachmentId] })).id;
  return { t, s, me, upload, send };
}

const pathOf = (url: string) => url.replace("https://test.convex.site", "");

describe("antimalware on upload", () => {
  test("an infected file is refused, deleted from storage, logged and the team is alerted", async () => {
    const { t, upload } = await world();
    const { res } = await upload(png(chunk("tEXt", EICAR)));
    await expect(res).rejects.toThrow(/MALWARE_DETECTED/);
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("supportAttachments").collect())).toHaveLength(0);
    const audit = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).filter((a) => a.action === "support.attachment.blocked"));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0].meta)).toContain("EICAR_TEST");
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.some((n) => /antimalware/i.test(n.title))).toBe(true);
  });

  test("a clean file gets a signed attestation bound to its bytes; verifyIntegrity confirms it", async () => {
    const { t, s, upload } = await world();
    const { res } = await upload(png());
    const f = await res;
    const row = await t.run((ctx) => ctx.db.get(f.attachmentId));
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.scanVerdict).toBe("clean");
    const staff = t.withIdentity({ subject: s.ownerId });
    // only sent files can be verified
    await t.withIdentity({ subject: s.memberId }).mutation(api.support.create, { tenantId: s.tenantId, subject: "Verifica", body: "contenuto valido", category: "bug", attachmentIds: [f.attachmentId] });
    const ok = await staff.action(api.supportFiles.verifyIntegrity, { attachmentId: f.attachmentId });
    expect(ok).toMatchObject({ ok: true, signed: true, hashMatches: true, signatureValid: true, rescanClean: true });
    // tamper with the record (verdict/size) → signature no longer valid
    await t.run((ctx) => ctx.db.patch(f.attachmentId, { sizeBytes: 999 }));
    const bad = await staff.action(api.supportFiles.verifyIntegrity, { attachmentId: f.attachmentId });
    expect(bad.ok).toBe(false);
    expect(bad.signatureValid).toBe(false);
    await expect(t.withIdentity({ subject: s.memberId }).action(api.supportFiles.verifyIntegrity, { attachmentId: f.attachmentId })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
  });
});

describe("signed HTTPS download", () => {
  async function sent() {
    const w = await world();
    const { res } = await w.upload(png());
    const f = await res;
    const ticketId = await w.send(f.attachmentId as never);
    void ticketId;
    const { url } = await w.me.mutation(api.supportFiles.open, { attachmentId: f.attachmentId });
    return { ...w, f, url };
  }

  test("a valid grant returns the file with the safety and attestation headers", async () => {
    const { t, url, f } = await sent();
    const r = await t.fetch(pathOf(url));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("sandbox");
    expect(r.headers.get("content-disposition")).toContain("attachment");
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("x-onespec-scan")).toMatch(/^v=.+; verdict=clean$/);
    const sha = r.headers.get("x-onespec-content-sha256")!;
    const row = await t.run((ctx) => ctx.db.get(f.attachmentId));
    expect(sha).toBe(row?.sha256);
    expect(r.headers.get("x-onespec-signature")).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect((await r.arrayBuffer()).byteLength).toBe(f.sizeBytes);
  });

  test("forged, altered, expired or foreign grants are refused", async () => {
    const { t, url } = await sent();
    const u = new URL(url);
    const forged = new URL(url); forged.searchParams.set("sig", "0".repeat(64));
    expect((await t.fetch(pathOf(forged.toString()))).status).toBe(403);
    const otherUser = new URL(url); otherUser.searchParams.set("u", "a".repeat(32));
    expect((await t.fetch(pathOf(otherUser.toString()))).status).toBe(403); // grant is bound to the person
    const later = new URL(url); later.searchParams.set("exp", String(Number(u.searchParams.get("exp")) + 1000));
    expect((await t.fetch(pathOf(later.toString()))).status).toBe(403); // expiry is signed
    expect((await t.fetch("/api/support/file?id=x")).status).toBe(400);
    vi.setSystemTime(Date.now() + 61_000);
    expect((await t.fetch(pathOf(url))).status).toBe(403); // expired
  });

  test("nothing is sent when the file or its record was tampered with", async () => {
    const { t, url, f } = await sent();
    const other = await t.run((ctx) => ctx.storage.store(new Blob([png(chunk("tEXt", ascii("swapped"))) as BlobPart], { type: "image/png" })));
    await t.run((ctx) => ctx.db.patch(f.attachmentId, { storageId: other })); // swap the file behind the record
    expect((await t.fetch(pathOf(url))).status).toBe(409);
    const alerts = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).filter((a) => a.action === "support.attachment.blocked"));
    expect(alerts.length).toBeGreaterThan(0);
  });

  test("fails closed without a signing secret", async () => {
    const { t, url, me, f } = await sent();
    const saved = process.env.SUPPORT_SIGNING_SECRET;
    delete process.env.SUPPORT_SIGNING_SECRET;
    try {
      expect((await t.fetch(pathOf(url))).status).toBe(503);
      await expect(me.mutation(api.supportFiles.open, { attachmentId: f.attachmentId })).rejects.toThrow(/SIGNING_NOT_CONFIGURED/);
    } finally {
      process.env.SUPPORT_SIGNING_SECRET = saved;
    }
  });

  test("a file from before attestations existed is scanned and attested on first download; an infected one is removed", async () => {
    const { t, url, f, me } = await sent();
    await t.run((ctx) => ctx.db.patch(f.attachmentId, { signature: undefined, sha256: undefined, scanVersion: undefined, scanVerdict: undefined, scannedAt: undefined }));
    expect((await t.fetch(pathOf(url))).status).toBe(200);
    expect((await t.run((ctx) => ctx.db.get(f.attachmentId)))?.signature).toMatch(/^[0-9a-f]{64}$/);

    // legacy + infected bytes
    const bad = await t.run((ctx) => ctx.storage.store(new Blob([png(chunk("tEXt", EICAR)) as BlobPart], { type: "image/png" })));
    await t.run((ctx) => ctx.db.patch(f.attachmentId, { storageId: bad, signature: undefined, sha256: undefined, scanVersion: undefined, scanVerdict: undefined, scannedAt: undefined }));
    const fresh = (await me.mutation(api.supportFiles.open, { attachmentId: f.attachmentId })).url;
    expect((await t.fetch(pathOf(fresh))).status).toBe(410);
    expect(await t.run((ctx) => ctx.db.get(f.attachmentId))).toBeNull();
  });

  test("a stranger cannot even obtain a grant", async () => {
    const { t, f } = await sent();
    const other = await seedTenant(t);
    await expect(t.withIdentity({ subject: other.memberId }).mutation(api.supportFiles.open, { attachmentId: f.attachmentId })).rejects.toThrow(/TICKET_NOT_FOUND/);
  });
});


describe("robustness in a restricted runtime (regression: bare \"Server Error\" on upload)", () => {
  test("scanning never depends on TextDecoder('latin1') and works on big files", () => {
    const real = globalThis.TextDecoder;
    // The production runtime does not promise every encoding label: any label other than utf-8 throws here.
    globalThis.TextDecoder = class {
      private inner = new real("utf-8");
      constructor(label = "utf-8") {
        if (!/^utf-?8$/i.test(label)) throw new RangeError(`unsupported label ${label}`);
      }
      decode(b?: BufferSource) { return this.inner.decode(b); }
    } as unknown as typeof TextDecoder;
    try {
      const big = png(Array.from({ length: 3 }, () => 0).flatMap(() => chunk("tEXt", Array.from({ length: 600_000 }, (_, i) => 65 + (i % 26)))));
      expect(big.length).toBeGreaterThan(1_500_000);
      expect(scanAttachment(big, "png")).toEqual({ verdict: "clean", findings: [] });
    } finally {
      globalThis.TextDecoder = real;
    }
  });

  test("a signature straddling two scan windows is still found", () => {
    // EICAR placed so that it crosses the 256 KB window edge.
    const filler = Array.from({ length: 256 * 1024 - 20 }, () => 65);
    const bytes = png(chunk("tEXt", [...filler, ...EICAR]));
    expect(scanAttachment(bytes, "png").findings).toContain("EICAR_TEST");
  });

  test("an unexpected failure inside the action is a clear, retryable error — and the file is not left behind", async () => {
    const { t, upload } = await world();
    // Newer convex-test hashes stored blobs with the same digest (an ArrayBuffer); fail only the action's own hash of the bytes.
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let failed = false;
    const spy = vi.spyOn(crypto.subtle, "digest").mockImplementation((algorithm, data) => {
      if (!failed && ArrayBuffer.isView(data)) {
        failed = true;
        return Promise.reject(new Error("boom"));
      }
      return digest(algorithm, data);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { res } = await upload(png());
      await expect(res).rejects.toThrow(/UPLOAD_FAILED/);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("stage=sign"));
      expect(await t.run((ctx) => ctx.db.query("supportAttachments").collect())).toHaveLength(0);
      expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(0);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });
});
