import { ConvexError } from "convex/values";

/**
 * Integrity signatures for ticket attachments (HMAC-SHA-256).
 *
 * The secret lives only in the deployment environment (SUPPORT_SIGNING_SECRET, ≥ 32 characters, e.g. `openssl rand -hex 32`). Without
 * it nothing is signed and nothing is served: the system FAILS CLOSED instead of falling back to an unsigned mode.
 */
export function signingSecret(): string {
  const s = process.env.SUPPORT_SIGNING_SECRET;
  if (!s || s.length < 32) throw new ConvexError("SIGNING_NOT_CONFIGURED");
  return s;
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hmacHex(message: string, secret = signingSecret()): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

/** Constant-time string comparison (equal length checked first; lengths are public). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** What the scan attestation of an attachment covers: the exact bytes (hash), type, size, scanner version, verdict and owner. */
export interface Attestable {
  storageId: string;
  sha256: string;
  contentType: string;
  sizeBytes: number;
  scanVersion: string;
  scanVerdict: string;
  scannedAt: number;
  uploaderUserId: string;
}

export function attestationMessage(a: Attestable): string {
  return ["att", "v1", a.storageId, a.sha256, a.contentType, a.sizeBytes, a.scanVersion, a.scanVerdict, a.scannedAt, a.uploaderUserId].join("|");
}

export const signAttestation = (a: Attestable) => hmacHex(attestationMessage(a));

export async function verifyAttestation(a: Attestable, signature: string): Promise<boolean> {
  return safeEqual(await signAttestation(a), signature);
}

/** Short-lived download grant bound to one attachment, one person and one moment. */
export const DOWNLOAD_TTL_MS = 60_000;
export const downloadGrant = (attachmentId: string, userId: string, exp: number) => hmacHex(`dl|v1|${attachmentId}|${userId}|${exp}`);

/** Signature the server puts in the response headers of a download so the receiver can check it came, intact, from us. */
export const responseSignature = (attachmentId: string, sha256: string, verdict: string, issuedAt: number) =>
  hmacHex(`resp|v1|${attachmentId}|${sha256}|${verdict}|${issuedAt}`);
