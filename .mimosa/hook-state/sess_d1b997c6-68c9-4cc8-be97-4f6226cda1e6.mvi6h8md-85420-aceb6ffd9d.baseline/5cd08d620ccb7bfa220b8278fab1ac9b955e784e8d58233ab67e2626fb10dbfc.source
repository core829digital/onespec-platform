"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Make user-uploaded photos safe to embed in a @react-pdf document WITHOUT
 * touching their size.
 *
 * react-pdf can only embed JPEG and PNG, and it ignores EXIF orientation. Phone
 * photos are often WebP/AVIF/HEIC or a JPEG flagged "rotate 90°" — one such
 * file used to either break the whole PDF or show up sideways. So:
 *  - JPEG with normal orientation, PNG -> embedded untouched (original bytes).
 *  - anything else, or a rotated JPEG -> redrawn at its NATURAL pixel size
 *    (never scaled) with orientation applied, as PNG/near-lossless JPEG.
 *  - undecodable (e.g. HEIC outside Safari) -> null, so the caller can print a
 *    placeholder instead of failing the document.
 */

/** EXIF orientation (1-8) of a JPEG, 1 when absent/unreadable. */
export function jpegOrientation(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const len = v.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 < v.byteLength && v.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      const little = v.getUint16(tiff) === 0x4949;
      const ifd = tiff + v.getUint32(tiff + 4, little);
      if (ifd + 2 > v.byteLength) return 1;
      const entries = v.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > v.byteLength) break;
        if (v.getUint16(e, little) === 0x0112) return v.getUint16(e + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) break;
    off += 2 + len;
  }
  return 1;
}

export async function preparePdfImage(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src; // signatures etc. are already PNG data URLs
  let blob: Blob;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    blob = await res.blob();
  } catch {
    return null;
  }
  const type = blob.type;
  if (type === "image/png") return src;
  let rotated = false;
  if (type === "image/jpeg") {
    rotated = jpegOrientation(await blob.slice(0, 65536).arrayBuffer()) > 1;
    if (!rotated) return src;
  }
  try {
    // Natural pixel size, orientation applied — no scaling anywhere.
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close();
    return rotated ? canvas.toDataURL("image/jpeg", 0.98) : canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Resolve a list of image URLs to PDF-safe sources. `ready` flips once every
 * one has been prepared (failed ones map to null).
 */
export function usePdfImages(urls: Array<string | null | undefined>): {
  ready: boolean;
  map: Record<string, string | null>;
} {
  const key = useMemo(() => JSON.stringify([...new Set(urls.filter((u): u is string => !!u))]), [urls]);
  const [state, setState] = useState<{ key: string; map: Record<string, string | null> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const list = JSON.parse(key) as string[];
    void Promise.all(list.map(async (u) => [u, await preparePdfImage(u)] as const)).then((entries) => {
      if (!cancelled) setState({ key, map: Object.fromEntries(entries) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { ready: state?.key === key, map: state?.key === key ? state.map : {} };
}
