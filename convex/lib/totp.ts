/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226), the standard behind Google Authenticator, Microsoft Authenticator, 1Password,
 * Authy and every other authenticator app: HMAC-SHA-1, 30-second steps, 6 digits. Pure functions (WebCrypto only), no environment.
 */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Codes of the previous and next step are accepted too, to absorb clock drift between the phone and the server. */
export const TOTP_WINDOW = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("INVALID_BASE32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** 160 random bits, the size RFC 4226 recommends, as the base32 text an authenticator app expects. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const off = mac[mac.length - 1] & 15;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const totpStep = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);

/** The code valid at `nowMs` (used by tests and by nothing else: the server never needs to *produce* a code). */
export async function totpAt(secretB32: string, nowMs: number, digits = TOTP_DIGITS): Promise<string> {
  const code = await hotp(base32Decode(secretB32), totpStep(nowMs));
  return digits === TOTP_DIGITS ? code : code.slice(-digits);
}

/**
 * Checks a typed code against the secret. Returns the matching time step, or null. A step at or below `lastStep` is refused, so a code
 * that was already used (or an older one) can never be replayed — an observed code is worthless after one use.
 */
export async function verifyTotp(secretB32: string, code: string, nowMs: number, lastStep = -1): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const current = totpStep(nowMs);
  let match: number | null = null;
  // Every window is evaluated (no early exit) so the time taken does not reveal which one matched.
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = current + delta;
    const expected = await hotp(secret, step);
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0 && step > lastStep && (match === null || step > match)) match = step;
  }
  return match;
}

/** The `otpauth://` link an authenticator app reads from the QR code. */
export function otpauthUri(issuer: string, account: string, secretB32: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
