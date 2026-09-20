import { expect, test } from "vitest";
import { jpegOrientation } from "../src/lib/pdf-images";

/** Minimal JPEG: SOI + APP1(Exif, one IFD entry: orientation) + EOI. */
function jpegWithOrientation(value: number, little: boolean): ArrayBuffer {
  const tiff = new Uint8Array(8 + 2 + 12 + 4);
  const dv = new DataView(tiff.buffer);
  dv.setUint16(0, little ? 0x4949 : 0x4d4d);
  dv.setUint16(2, 0x002a, little);
  dv.setUint32(4, 8, little); // IFD0 offset
  dv.setUint16(8, 1, little); // one entry
  dv.setUint16(10, 0x0112, little); // Orientation
  dv.setUint16(12, 3, little); // SHORT
  dv.setUint32(14, 1, little);
  dv.setUint16(18, value, little);
  const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  const app1Len = 2 + exif.length;
  const out = new Uint8Array(2 + 2 + 2 + exif.length + 2);
  const o = new DataView(out.buffer);
  o.setUint16(0, 0xffd8);
  o.setUint16(2, 0xffe1);
  o.setUint16(4, app1Len);
  out.set(exif, 6);
  o.setUint16(6 + exif.length, 0xffd9);
  return out.buffer;
}

test("reads EXIF orientation from a JPEG (both byte orders)", () => {
  expect(jpegOrientation(jpegWithOrientation(6, true))).toBe(6);
  expect(jpegOrientation(jpegWithOrientation(3, false))).toBe(3);
  expect(jpegOrientation(jpegWithOrientation(1, true))).toBe(1);
});

test("non-JPEG or EXIF-less data is orientation 1 (embed untouched)", () => {
  expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(1);
  expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBe(1);
  expect(jpegOrientation(new ArrayBuffer(0))).toBe(1);
});
