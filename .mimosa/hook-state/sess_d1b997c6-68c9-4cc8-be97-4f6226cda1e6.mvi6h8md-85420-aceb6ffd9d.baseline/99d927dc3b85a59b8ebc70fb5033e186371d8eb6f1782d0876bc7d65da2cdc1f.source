import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SCAN_VERSION, scanAttachment, type ScanKind } from "../lib/malwareScan";
import { DOWNLOAD_TTL_MS, downloadGrant, responseSignature, safeEqual, sha256Hex, signAttestation, signingSecret, verifyAttestation } from "../lib/signing";

/**
 * Serves a ticket attachment over HTTPS — the only way files leave the platform.
 *
 * Request: GET /api/support/file?id=…&u=…&exp=…&sig=… where `sig` is an HMAC (SHA-256) of attachment, person and expiry, minted by the
 * platform for 60 seconds after an authorised person asked to open the file. Anything else (missing/expired/forged grant) is refused.
 *
 * Before sending a byte the server re-hashes the stored file and checks it against the signed attestation made when the file was scanned
 * (a changed file or a changed record is an integrity failure: nothing is sent, the team is alerted). Files uploaded before attestations
 * existed are scanned and attested on the spot.
 *
 * Response headers make a file harmless in the browser and verifiable by whoever receives it:
 *   Content-Type (detected from the bytes) · Content-Disposition: attachment · X-Content-Type-Options: nosniff
 *   Content-Security-Policy: default-src 'none'; sandbox · Cache-Control: private, no-store · X-Frame-Options: DENY · Referrer-Policy: no-referrer
 *   X-OneSpec-Content-SHA256 · X-OneSpec-Scan: v=<scanner version>; verdict=clean
 *   X-OneSpec-Signature: t=<unix seconds>,v1=<HMAC-SHA256 over attachment|sha256|verdict|t>
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store, max-age=0",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Cross-Origin-Resource-Policy": "same-site",
};

const deny = (status: number, body: string) => new Response(body, { status, headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
// Shape check only (the HMAC and the typed lookup do the real work); Convex ids are lower-case alphanumerics, test ids also carry ";".
const ID = /^[A-Za-z0-9;_-]{10,64}$/;

export const supportFileDownload = httpAction(async (ctx, request: Request) => {
  try {
    signingSecret();
  } catch {
    return deny(503, "not configured"); // fail closed
  }
  const q = new URL(request.url).searchParams;
  const id = q.get("id") ?? "";
  const user = q.get("u") ?? "";
  const sig = q.get("sig") ?? "";
  const exp = Number(q.get("exp"));
  const now = Date.now();
  if (!ID.test(id) || !ID.test(user) || !/^[0-9a-f]{64}$/.test(sig) || !Number.isFinite(exp)) return deny(400, "bad request");
  if (exp < now || exp > now + DOWNLOAD_TTL_MS + 5_000) return deny(403, "expired");
  if (!safeEqual(await downloadGrant(id, user, exp), sig)) return deny(403, "forbidden");

  let a;
  try {
    a = await ctx.runQuery(internal.supportFiles.getForDownload, { id: id as Id<"supportAttachments"> });
  } catch {
    return deny(404, "not found");
  }
  if (!a) return deny(404, "not found");
  const blob = await ctx.storage.get(a.storageId);
  if (!blob) return deny(410, "gone");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const hash = await sha256Hex(bytes);
  const kind: ScanKind = a.contentType === "application/pdf" ? "pdf" : a.contentType === "image/png" ? "png" : a.contentType === "image/jpeg" ? "jpeg" : "webp";

  const signed = !!(a.signature && a.sha256 && a.scanVersion && a.scanVerdict && a.scannedAt);
  if (signed) {
    const valid = await verifyAttestation(
      { storageId: a.storageId, sha256: a.sha256!, contentType: a.contentType, sizeBytes: a.sizeBytes, scanVersion: a.scanVersion!, scanVerdict: a.scanVerdict!, scannedAt: a.scannedAt!, uploaderUserId: a.uploaderUserId },
      a.signature!,
    );
    if (!valid || hash !== a.sha256 || bytes.length !== a.sizeBytes) {
      await ctx.runMutation(internal.supportFiles.reportBlocked, { userId: a.uploaderUserId, tenantId: a.tenantId, findings: ["INTEGRITY_FAILURE"], verdict: "suspicious" });
      return deny(409, "integrity check failed");
    }
  } else {
    // Uploaded before attestations existed: scan now, then attest (or remove).
    const scan = scanAttachment(bytes, kind);
    if (scan.verdict !== "clean") {
      await ctx.runMutation(internal.supportFiles.reportBlocked, { userId: a.uploaderUserId, tenantId: a.tenantId, findings: scan.findings, verdict: scan.verdict });
      await ctx.runMutation(internal.supportFiles.purgeInfected, { id: a._id, findings: scan.findings });
      return deny(410, "removed");
    }
    const scannedAt = Date.now();
    const signature = await signAttestation({ storageId: a.storageId, sha256: hash, contentType: a.contentType, sizeBytes: bytes.length, scanVersion: SCAN_VERSION, scanVerdict: "clean", scannedAt, uploaderUserId: a.uploaderUserId });
    await ctx.runMutation(internal.supportFiles.attestLegacy, { id: a._id, sha256: hash, scanVersion: SCAN_VERSION, scannedAt, signature });
  }

  const t = Math.floor(now / 1000);
  const safeName = a.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "file";
  return new Response(bytes, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": a.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "X-OneSpec-Content-SHA256": hash,
      "X-OneSpec-Scan": `v=${a.scanVersion ?? SCAN_VERSION}; verdict=clean`,
      "X-OneSpec-Signature": `t=${t},v1=${await responseSignature(a._id, hash, "clean", t)}`,
    },
  });
});
