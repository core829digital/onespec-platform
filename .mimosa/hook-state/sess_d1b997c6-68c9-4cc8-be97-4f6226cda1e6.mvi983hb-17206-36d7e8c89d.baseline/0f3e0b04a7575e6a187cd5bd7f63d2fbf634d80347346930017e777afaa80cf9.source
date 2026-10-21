import { ConvexError } from "convex/values";
import { hmacHex, safeEqual } from "./signing";

/**
 * Protection of the second factor at rest. The authenticator secret is encrypted (AES-256-GCM) with a key that lives only in the
 * deployment environment (MFA_ENCRYPTION_KEY, ≥ 32 characters, e.g. `openssl rand -hex 32`), so a copy of the database alone is not
 * enough to generate codes. Recovery codes are stored only as HMACs. Without the key nothing can be enrolled or checked: the system
 * FAILS CLOSED — a user who already has the second factor is never let in without it.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function mfaKeyMaterial(): string {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (!k || k.length < 32) throw new ConvexError("MFA_NOT_CONFIGURED");
  return k;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`onespec-mfa-v1|${mfaKeyMaterial()}`));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [usage]);
}

export async function encryptSecret(plain: string, userId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // The owner is authenticated with the ciphertext: a secret copied onto another user's row will not decrypt.
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(userId) }, await aesKey("encrypt"), enc.encode(plain));
  return `v1.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decryptSecret(stored: string, userId: string): Promise<string> {
  const [ver, iv, ct] = stored.split(".");
  if (ver !== "v1" || !iv || !ct) throw new ConvexError("MFA_UNAVAILABLE");
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(userId) }, await aesKey("decrypt"), unb64(ct));
    return dec.decode(pt);
  } catch (e) {
    if (e instanceof ConvexError) throw e;
    throw new ConvexError("MFA_UNAVAILABLE");
  }
}

// Recovery codes: 10 symbols (~49 bits) without look-alike characters, shown as XXXXX-XXXXX.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;

function randomBelow(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let s = "";
    for (let i = 0; i < 10; i++) s += ALPHABET[randomBelow(ALPHABET.length)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

/** "abcde-fghjk", "ABCDE FGHJK" and "ABCDEFGHJK" are the same code. */
export const normalizeRecoveryCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const hashRecoveryCode = (code: string, userId: string) => hmacHex(`mfa-recovery|v1|${userId}|${normalizeRecoveryCode(code)}`, mfaKeyMaterial());

export { safeEqual };
