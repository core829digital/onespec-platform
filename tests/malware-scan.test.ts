// @vitest-environment node
import { describe, expect, test } from "vitest";
import { scanAttachment } from "../convex/lib/malwareScan";

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (type: string, data: number[]) => [...u32(data.length), ...ascii(type), ...data, ...u32(crc32([...ascii(type), ...data]))];
/** A tiny but structurally valid PNG (1x1), optionally with extra chunks / trailing bytes. */
function png(extra: number[] = [], trailing: number[] = []): Uint8Array {
  const ihdr = chunk("IHDR", [...u32(1), ...u32(1), 8, 2, 0, 0, 0]);
  const idat = chunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...extra, ...idat, ...chunk("IEND", []), ...trailing]);
}
const jpeg = (mid: number[] = [], trailing: number[] = []) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, ...mid, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9, ...trailing]);
const pdf = (body = "1 0 obj<< /Type /Catalog >>endobj", tail = "") => new TextEncoder().encode(`%PDF-1.4\n${body}\ntrailer<< >>\nstartxref\n0\n%%EOF\n${tail}`);

describe("malware screening of attachments", () => {
  test("clean files pass: a valid PNG, a JPEG (even with a trailer, like phone photos), a PDF", () => {
    expect(scanAttachment(png(), "png")).toEqual({ verdict: "clean", findings: [] });
    expect(scanAttachment(jpeg([], ascii("MPF-thumbnail-bytes")), "jpeg").verdict).toBe("clean");
    expect(scanAttachment(pdf(), "pdf")).toEqual({ verdict: "clean", findings: [] });
  });

  test("the EICAR test string is detected in every kind", () => {
    const eicar = ascii("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(scanAttachment(png(chunk("tEXt", eicar)), "png")).toMatchObject({ verdict: "malicious", findings: expect.arrayContaining(["EICAR_TEST"]) });
    expect(scanAttachment(jpeg(eicar), "jpeg").verdict).toBe("malicious");
    expect(scanAttachment(pdf("", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE"), "pdf").findings).toContain("EICAR_TEST");
  });

  test("executables, scripts and web shells smuggled in a picture are detected", () => {
    expect(scanAttachment(png(chunk("tEXt", ascii("This program cannot be run in DOS mode"))), "png").findings).toContain("PE_EXECUTABLE");
    expect(scanAttachment(png(chunk("tEXt", [0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])), "png").findings).toContain("ELF_EXECUTABLE");
    expect(scanAttachment(png(chunk("tEXt", ascii("<script>alert(1)</script>"))), "png").findings).toContain("HTML_SCRIPT");
    expect(scanAttachment(png(chunk("tEXt", ascii("<?php system($_GET['c']); ?>"))), "png").findings).toContain("PHP_TAG");
    expect(scanAttachment(jpeg(ascii("#!/bin/sh\nrm -rf /")), "jpeg").findings).toContain("SHEBANG");
    expect(scanAttachment(png(chunk("tEXt", ascii("powershell -enc SQBFAFgA"))), "png").findings).toContain("POWERSHELL");
  });

  test("an archive hidden behind an image header is a polyglot", () => {
    expect(scanAttachment(png([], [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0, 0]), "png").findings).toEqual(expect.arrayContaining(["ARCHIVE_POLYGLOT"]));
    expect(scanAttachment(jpeg([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]), "jpeg").findings).toContain("ARCHIVE_POLYGLOT");
  });

  test("structure: bad checksum, truncated, trailing data after the end of a PNG, unknown critical chunk, truncated JPEG", () => {
    const tampered = png();
    tampered[40] ^= 0xff; // flip a byte inside a chunk
    expect(scanAttachment(tampered, "png").verdict).not.toBe("clean");
    expect(scanAttachment(png().slice(0, 30), "png").verdict).toBe("suspicious");
    expect(scanAttachment(png([], ascii("payload-after-iend")), "png").findings).toContain("TRAILING_DATA");
    expect(scanAttachment(png(chunk("ZZZZ", [1, 2, 3])), "png").findings).toContain("UNKNOWN_CRITICAL_CHUNK");
    expect(scanAttachment(jpeg().slice(0, 12), "jpeg").verdict).toBe("suspicious");
  });

  test("PDF: JavaScript / launch / auto actions, encryption and data after %%EOF are refused", () => {
    expect(scanAttachment(pdf("<< /S /JavaScript /JS (app.alert(1)) >>"), "pdf").findings).toContain("PDF_ACTIVE_CONTENT");
    expect(scanAttachment(pdf("<< /Type /Catalog /OpenAction << /S /Launch /F (cmd.exe) >> >>"), "pdf").verdict).toBe("malicious");
    expect(scanAttachment(pdf("<< /Encrypt 5 0 R >>"), "pdf").findings).toContain("ENCRYPTED_PDF");
    expect(scanAttachment(pdf("", "MZ-hidden-payload"), "pdf").findings).toContain("TRAILING_DATA");
  });

  test("random-looking binary data (what a real photo looks like) does not trip the rules", () => {
    // 4 MB of pseudo-random bytes inside a valid JPEG shell: the narrow rules must not fire by chance.
    let seed = 12345;
    const noise: number[] = [];
    for (let i = 0; i < 4_000_000; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const v = seed & 0xff; noise.push(v === 0xff ? 0xfe : v); }
    expect(scanAttachment(jpeg(), "jpeg").verdict).toBe("clean");
    const big = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, ...noise, 0xff, 0xd9]);
    expect(scanAttachment(big, "jpeg").findings).toEqual([]);
  });

  test("never throws: garbage in every kind is refused, not crashed on", () => {
    for (const kind of ["png", "jpeg", "webp", "pdf"] as const) expect(scanAttachment(new Uint8Array([1, 2, 3]), kind).verdict).not.toBe("clean");
  });
});
