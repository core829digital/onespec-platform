/**
 * Just enough PNG to answer one question about a saved signature: is there ink on it?
 * Decodes 8-bit grey / RGB / grey+alpha / RGBA, non-interlaced images (what a canvas produces) and counts the dark, opaque pixels.
 * The server cannot see the pad the signer used, so it looks at the picture it was given: a blank page, a transparent image or a
 * white-on-white line is refused instead of being stored as "signed".
 */
import { unzlibSync } from "fflate";

export interface PngInk {
  width: number;
  height: number;
  /** Dark, opaque pixels (the pen). */
  inkPixels: number;
  /** Size of the box that contains all of them. */
  inkWidth: number;
  inkHeight: number;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_PIXELS = 1_500_000;
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

/** Bytes of a `data:image/png;base64,…` URL, or null when it is not one. */
export function pngBytesFromDataUrl(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Throws `Error("PNG_INVALID")` for anything that is not a plain, supported PNG. */
export function analyzePng(bytes: Uint8Array): PngInk {
  const bad = () => new Error("PNG_INVALID");
  if (bytes.length < 33 || SIGNATURE.some((v, i) => bytes[i] !== v)) throw bad();
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = u32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const start = pos + 8;
    if (start + len + 4 > bytes.length) throw bad();
    if (type === "IHDR") {
      width = u32(bytes, start);
      height = u32(bytes, start + 4);
      colorType = bytes[start + 9];
      if (bytes[start + 8] !== 8 || bytes[start + 12] !== 0) throw bad(); // 8-bit, not interlaced
    } else if (type === "IDAT") {
      idat.push(bytes.subarray(start, start + len));
    } else if (type === "IEND") {
      break;
    }
    pos = start + len + 4;
  }
  const channels = CHANNELS[colorType];
  if (!channels || width < 1 || height < 1 || width * height > MAX_PIXELS || idat.length === 0) throw bad();

  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of idat) {
    joined.set(c, o);
    o += c.length;
  }
  let raw: Uint8Array;
  try {
    raw = unzlibSync(joined);
  } catch {
    throw bad();
  }
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw bad();

  // undo the per-row filters
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? px[dst + x - channels] : 0;
      const up = y > 0 ? px[dst - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? px[dst - stride + x - channels] : 0;
      let v = raw[src + x];
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        v += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) throw bad();
      px[dst + x] = v & 0xff;
    }
  }

  let ink = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * channels;
      const grey = colorType === 0 || colorType === 4;
      const alpha = colorType === 4 ? px[i + 1] : colorType === 6 ? px[i + 3] : 255;
      const luma = grey ? px[i] : (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      if (alpha >= 64 && luma <= 160) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { width, height, inkPixels: ink, inkWidth: ink ? maxX - minX + 1 : 0, inkHeight: ink ? maxY - minY + 1 : 0 };
}
