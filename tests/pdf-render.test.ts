// @vitest-environment node
import { createElement as h } from "react";
import { deflateSync } from "node:zlib";
import { expect, test } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InspectionCertPDF } from "../src/lib/pdfs/InspectionCertPDF";
import { WindowDrawingPDF } from "../src/lib/pdfs/WindowDrawingPDF";

// Valid 2x2 RGB PNG built on the fly.
function makePng(): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.from([0, 255, 0, 0, 255, 0, 0]);
  const raw = Buffer.concat([row, row]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}
const PNG = makePng();

test("inspection PDF embeds photo + signature images and renders", async () => {
  const buf = await renderToBuffer(
    h(InspectionCertPDF, {
      tenant: { name: "Test" },
      report: {
        createdAt: 1,
        status: "signed",
        customerName: "Mario",
        photos: [{ key: "a", label: "Foto", url: PNG }],
        checks: [{ key: "c", label: "Ok", passed: true }],
        signatureDataUrl: PNG,
        signedByName: "Mario",
        signedAt: 1,
      },
      title: "Verbale",
      legalBasis: "x",
      warrantyLines: ["w"],
      generatedAt: 1,
    }),
  );
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  expect(buf.length).toBeGreaterThan(1500);
});

test("window drawing renders with sashes and handle heights", async () => {
  const { Document, Page } = await import("@react-pdf/renderer");
  const buf = await renderToBuffer(
    h(
      Document,
      null,
      h(
        Page,
        { size: "A4" },
        h(WindowDrawingPDF, {
          width: 1400,
          height: 1200,
          material: "pvc",
          color: "anthracite",
          sashes: [
            { type: "tiltturn", direction: "left", active: true, widthRatio: 0.6, handleHeightMm: 1000 },
            { type: "fix", direction: "left", active: true },
            { type: "sliding", direction: "right", active: false },
          ],
        }),
      ),
    ),
  );
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
});
