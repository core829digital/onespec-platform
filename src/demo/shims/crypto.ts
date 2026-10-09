/**
 * Browser stand-in for Node's `crypto`, aliased in next.config.mjs for client bundles only. The one thing convex-test needs from it is
 * `createHash("sha256")` for the checksum it stores next to uploaded files; in the demo that checksum is never verified, so a small
 * synchronous digest (FNV-1a, 64-bit, base64) is enough. Nothing security-relevant uses this module.
 */
export function createHash(_algorithm: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const api = {
    update(data: Uint8Array | ArrayBuffer | string) {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
      for (let i = 0; i < bytes.length; i++) {
        h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
        h2 = Math.imul(h2 + bytes[i], 0x85ebca6b) >>> 0;
      }
      return api;
    },
    digest(_encoding?: string) {
      const raw = new Uint8Array(8);
      new DataView(raw.buffer).setUint32(0, h1);
      new DataView(raw.buffer).setUint32(4, h2);
      let s = "";
      for (const b of raw) s += String.fromCharCode(b);
      return btoa(s);
    },
  };
  return api;
}

export default { createHash };
