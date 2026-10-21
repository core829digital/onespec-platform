import { zlibSync } from "fflate";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { assertSignature } from "../../convex/lib/fieldModules";
import { analyzePng, pngBytesFromDataUrl } from "../../convex/lib/png";
import { BLANK_PNG, SIGNATURE_PNG, TRANSPARENT_PNG, makePng, newDb, pngChunk, sampleItem, seedPublishedConfigurator, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (fn: () => void): string => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return String((e as { data?: unknown }).data ?? (e as Error).message);
  }
};

describe("server-side signature check", () => {
  test("a drawn signature passes; the analysis sees the pen", () => {
    expect(code(() => assertSignature(SIGNATURE_PNG))).toBe("ok");
    const ink = analyzePng(pngBytesFromDataUrl(SIGNATURE_PNG)!);
    expect(ink).toMatchObject({ width: 240, height: 80 });
    expect(ink.inkPixels).toBeGreaterThan(500);
    expect(ink.inkWidth).toBeGreaterThan(200);
  });

  test("a blank page, a transparent picture and a white stroke on white are all refused as empty", () => {
    expect(code(() => assertSignature(BLANK_PNG))).toBe("SIGNATURE_EMPTY");
    expect(code(() => assertSignature(TRANSPARENT_PNG))).toBe("SIGNATURE_EMPTY");
    // white ink on a transparent page: what a pad drawing white strokes straight into the saved picture would store
    expect(code(() => assertSignature(makePng(240, 80, (x, y) => (Math.abs(y - 40) <= 2 ? [255, 255, 255, 255] : [0, 0, 0, 0]))))).toBe("SIGNATURE_EMPTY");
  });

  test("a single dot is not a signature", () => {
    expect(code(() => assertSignature(makePng(240, 80, (x, y) => ((x - 100) ** 2 + (y - 40) ** 2 <= 9 ? [0, 0, 0, 255] : [255, 255, 255, 255]))))).toBe("SIGNATURE_EMPTY");
  });

  test("anything that is not a readable PNG is invalid, not 'empty'", () => {
    expect(code(() => assertSignature("data:image/png;base64,AAAA"))).toBe("INVALID_SIGNATURE");
    expect(code(() => assertSignature("data:image/jpeg;base64,/9j/4AAQSkZJRg=="))).toBe("INVALID_SIGNATURE");
    expect(code(() => assertSignature("not a data url"))).toBe("INVALID_SIGNATURE");
    expect(code(() => assertSignature("data:image/png;base64," + "A".repeat(210_000)))).toBe("SIGNATURE_TOO_LARGE");
  });

  test("every PNG row filter decodes to the same picture (browsers use all of them)", () => {
    const w = 120;
    const h = 40;
    const px = (x: number, y: number): [number, number, number, number] => (Math.abs(y - (8 + x / 5)) <= 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]);
    const rows: Uint8Array[] = [];
    for (let y = 0; y < h; y++) {
      const r = new Uint8Array(w * 4);
      for (let x = 0; x < w; x++) r.set(px(x, y), x * 4);
      rows.push(r);
    }
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    const encode = (filter: number) => {
      const raw = new Uint8Array((w * 4 + 1) * h);
      for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = filter;
        for (let x = 0; x < w * 4; x++) {
          const cur = rows[y][x];
          const left = x >= 4 ? rows[y][x - 4] : 0;
          const up = y > 0 ? rows[y - 1][x] : 0;
          const upLeft = y > 0 && x >= 4 ? rows[y - 1][x - 4] : 0;
          const pred = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0;
          raw[y * (w * 4 + 1) + 1 + x] = (cur - pred) & 0xff;
        }
      }
      const ihdr = new Uint8Array(13);
      new DataView(ihdr.buffer).setUint32(0, w);
      new DataView(ihdr.buffer).setUint32(4, h);
      ihdr[8] = 8;
      ihdr[9] = 6;
      const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", zlibSync(raw)), pngChunk("IEND", new Uint8Array(0))];
      const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) {
        png.set(p, o);
        o += p.length;
      }
      return png;
    };
    const reference = analyzePng(encode(0));
    expect(reference.inkPixels).toBeGreaterThan(200);
    for (const filter of [1, 2, 3, 4]) expect(analyzePng(encode(filter)), `filter ${filter}`).toEqual(reference);
    expect(() => analyzePng(new Uint8Array([1, 2, 3]))).toThrow("PNG_INVALID");
  });
});

describe("signing refuses an empty picture where the money is", () => {
  async function setup() {
    const t = newDb();
    const seeded = await seedTenant(t, { plan: "pro" });
    const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "SIG_01");
    const asOwner = t.withIdentity({ subject: seeded.ownerId });
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, {
      tenantId: seeded.tenantId, configuratorId, leadName: "Mario Rossi", leadEmail: "mario@example.com", items: [sampleItem], vatRatePercent: 22,
    });
    return { t, asOwner, quoteId };
  }

  test("a quote is not signed with a blank picture, and stays open", async () => {
    const { t, asOwner, quoteId } = await setup();
    await expect(asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: BLANK_PNG, signedByName: "Mario Rossi" })).rejects.toThrow(/SIGNATURE_EMPTY/);
    const q = await t.run((ctx) => ctx.db.get(quoteId));
    expect(q?.signedAt).toBeUndefined();
    expect(q?.status).not.toBe("won");
    await asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "Mario Rossi" });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.status).toBe("won");
  });
});
