const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function nanoid(length: number = 10): string {
  let result = "";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomBytes[i] % ALPHABET.length];
  }
  return result;
}

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
 * 6-digit one-time code (100000–999999) from the CSPRNG, with rejection
 * sampling so every code is equally likely. Math.random() is not a
 * cryptographic source and must never generate sign-in / reset codes.
 */
export function secureSixDigitCode(): string {
  const buf = new Uint32Array(1);
  const range = 900_000;
  const limit = Math.floor(0x1_0000_0000 / range) * range; // largest multiple of range ≤ 2^32
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(100_000 + (buf[0] % range));
  }
}
