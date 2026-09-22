// @vitest-environment node
import { createElement as h } from "react";
import { deflateSync } from "node:zlib";
import { expect, test } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InspectionCertPDF } from "../src/lib/pdfs/InspectionCertPDF";
import { WindowDrawingPdf } from "../src/lib/drawing";

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
        h(WindowDrawingPdf, {
          input: {
            widthMm: 1400,
            heightMm: 1200,
            finish: "anthracite",
            sashes: [
              { type: "tiltturn", direction: "left", active: true, widthRatio: 0.6, handleHeightMm: 1000 },
              { type: "fix", direction: "left", active: true },
              { type: "sliding", direction: "right", active: false },
            ],
          },
        }),
      ),
    ),
  );
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
});

test("DPA PDF renders unsigned and signed, with pagination", async () => {
  const { DpaPDF } = await import("../src/lib/pdfs/DpaPDF");
  const { buildDpa, DPA_VERSION } = await import("../src/shared/dpa");
  const controller = { name: "Acme Serramenti Srl", vatId: "IT01234567890", address: "Via Roma 1, Prato", email: "info@acme.it" };
  for (const acceptance of [null, { signerName: "Mario Rossi", signerRole: "Legale rappresentante", acceptedAt: 1_700_000_000_000 }]) {
    const buf = await renderToBuffer(
      h(DpaPDF, { doc: buildDpa(controller), version: DPA_VERSION, controller, acceptance, locale: "it-IT", generatedAt: 1 }) as unknown as Parameters<typeof renderToBuffer>[0],
    );
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(5000);
  }
});

test("quote PDF renders with the pinned catalogue: offer number, real Uw, telaio, leaves, accessories, drawings", async () => {
  const { QuotePrintPDF } = await import("../src/lib/pdfs/QuotePrintPDF");
  const { defaultItem } = await import("../src/shared/item-defaults");
  const { DEFAULT_ACCESSORIES, DEFAULT_FRAME_TYPES } = await import("../src/shared/configurator-model");
  const catalog = {
    configurator: { vatRatePercent: 10, priceRoundingStep: 1, currency: "EUR" },
    branding: null,
    materials: [{ key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true }],
    qualityTiers: [{ materialKey: "pvc", key: "chamber5", labels: { it: "5" }, multiplier: 1, sortOrder: 0, enabled: true }],
    profileSystems: [{ materialKey: "pvc", key: "rehau", labels: { it: "Rehau Synego" }, multiplier: 1, uFrame: 1, sortOrder: 0, enabled: true }],
    sizeConstraints: [],
    glazing: [{ key: "double", labels: { it: "Doppio" }, priceCents: 0, uGlass: 1.1, sortOrder: 0, enabled: true }],
    finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
    hardware: [
      { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 5000, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
      { kind: "sashType", key: "classic", labels: { it: "B" }, priceCents: 3000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
      { kind: "hardware", key: "standard", labels: { it: "Standard" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
      { kind: "hardwareColor", key: "silver", labels: { it: "Argento" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
    ],
    frameTypes: DEFAULT_FRAME_TYPES,
    accessories: DEFAULT_ACCESSORIES,
  } as unknown as Parameters<typeof QuotePrintPDF>[0]["catalog"];
  const item = { ...defaultItem(catalog!, "finestra2"), profileSystem: "rehau", frameType: "reno40", notes: "senza zanzariera", accessories: { zanz: "plisettata", cass: "aluplast140" } };
  const buf = await renderToBuffer(
    h(QuotePrintPDF, {
      tenant: { name: "Acme" },
      catalog,
      locale: "it-IT",
      quote: {
        publicId: "ABCDEF1234",
        offerNumber: "Q-2026-0007",
        status: "quoted",
        leadName: "Mario",
        leadEmail: "m@example.com",
        vatRatePercent: 10,
        priceCents: 100000,
        priceExVatCents: 90909,
        items: [item, { ...item, category: "porta2", productType: "balconyDoor", width: 1600, height: 2100 }],
        regionCode: "IT",
      },
    } as unknown as Parameters<typeof QuotePrintPDF>[0]) as unknown as Parameters<typeof renderToBuffer>[0],
  );
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  expect(buf.length).toBeGreaterThan(8000);
});
