/**
 * Secrets of the team-access system: the team's alphanumeric password and the 6-digit code that travels with the invite link.
 * Neither is ever stored in clear: PBKDF2-SHA256 with its own random salt, compared in constant time. Generated with the platform's
 * secure random source, with no bias (rejection sampling), from an alphabet without look-alike characters (no 0/O, 1/I/L).
 */
const PBKDF2_ITERATIONS = 60_000;
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 symbols: no 0 O 1 I L
const enc = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Equal-length strings compared without stopping at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Unbiased random integer in [0, max). */
function randomBelow(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** How a password is compared: capitals only, no spaces or dashes — "abcde-fghjk" and "ABCDEFGHJK" are the same password. */
export function normalizePassword(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 10 symbols (about 49 bits), shown as XXXXX-XXXXX. */
export function generateTeamPassword(): string {
  let out = "";
  for (let i = 0; i < 10; i++) out += PASSWORD_ALPHABET[randomBelow(PASSWORD_ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** 6 digits, leading zeros allowed. */
export function generateCode(): string {
  return String(randomBelow(1_000_000)).padStart(6, "0");
}

export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "");
}

async function derive(secret: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toB64(new Uint8Array(bits));
}

/** A fresh salted hash of `secret`. */
export async function hashSecret(secret: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(secret, salt), salt: toB64(salt) };
}

export async function verifySecret(secret: string, hash: string, salt: string): Promise<boolean> {
  return constantTimeEqual(await derive(secret, fromB64(salt)), hash);
}
