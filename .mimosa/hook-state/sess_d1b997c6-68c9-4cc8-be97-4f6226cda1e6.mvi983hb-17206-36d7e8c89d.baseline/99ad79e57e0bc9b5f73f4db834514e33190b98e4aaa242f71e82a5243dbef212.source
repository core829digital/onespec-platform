import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant } from "./_helpers";
import { sniffProblem, svgProblem } from "../../convex/lib/fileSniff";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const enc = (s: string) => new TextEncoder().encode(s);
const png = (w = 100, h = 100) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
const jpeg = (w = 640, h = 480) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]);

test("sniffProblem reads the bytes, whatever the announced type", () => {
  expect(sniffProblem(png(), "image")).toBeNull();
  expect(sniffProblem(jpeg(), "image")).toBeNull();
  expect(sniffProblem(new Uint8Array([...enc("RIFF"), 0, 0, 0, 0, ...enc("WEBPVP8 ")]), "image")).toBeNull();
  expect(sniffProblem(new Uint8Array([0, 0, 0, 24, ...enc("ftypheic"), 0, 0, 0, 0]), "image")).toBeNull();
  expect(sniffProblem(enc("<html><script>alert(1)</script></html>"), "image")).toBe("UNSUPPORTED_FILE_TYPE");
  expect(sniffProblem(enc("%PDF-1.4 hello %%EOF"), "image")).toBe("UNSUPPORTED_FILE_TYPE"); // a PDF is not a photo
  expect(sniffProblem(png(30000, 30000), "image")).toBe("IMAGE_TOO_LARGE_PIXELS"); // 900 million pixels
  expect(sniffProblem(jpeg(20000, 20000), "image")).toBe("IMAGE_TOO_LARGE_PIXELS");
  expect(sniffProblem(png(0, 5), "image")).toBe("IMAGE_TOO_LARGE_PIXELS");
  // documents: a PDF (complete, without scripts) or a picture
  expect(sniffProblem(enc("%PDF-1.7\n<< >>\n%%EOF\n"), "document")).toBeNull();
  expect(sniffProblem(enc("%PDF-1.7\n<< /S /JavaScript >>\n%%EOF\n"), "document")).toBe("DOCUMENT_ACTIVE_CONTENT");
  expect(sniffProblem(png(), "document")).toBeNull();
  expect(sniffProblem(enc("just text"), "document")).toBe("DOCUMENT_NOT_PDF");
  // company logo: PNG / JPEG only; brand logo: also WebP and a plain SVG
  expect(sniffProblem(new Uint8Array([...enc("RIFF"), 0, 0, 0, 0, ...enc("WEBPVP8 ")]), "logo")).toBe("UNSUPPORTED_FILE_TYPE");
  expect(sniffProblem(enc('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'), "brandLogo")).toBeNull();
});

test("an SVG logo is a drawing, never a program", () => {
  const ok = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="g"/></defs><use xlink:href="#g"/><image href="data:image/png;base64,AAAA"/></svg>';
  expect(svgProblem(enc(ok))).toBeNull();
  for (const bad of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="x"/></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/track.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css);</style></svg>',
    '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    "<html><body>not an svg</body></html>",
  ]) expect(svgProblem(enc(bad)), bad).toBe("UNSUPPORTED_FILE_TYPE");
});

// convex-test drops the upload Content-Type; the real backend records it on _storage.
async function store(t: ReturnType<typeof newDb>, bytes: Uint8Array, type: string) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([bytes as BlobPart], { type }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.db as any).patch(id, { contentType: type });
    return id;
  });
}

async function setup() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  return { t, s, owner: t.withIdentity({ subject: s.ownerId }) };
}

test("a file attached under a false type is deleted after a second look at its bytes; a real one stays", async () => {
  const { t, s, owner } = await setup();
  const fake = await store(t, enc("<html><script>alert(1)</script></html>"), "image/png");
  await owner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: fake });
  await vi.runAllTimersAsync();
  await t.finishInProgressScheduledFunctions();
  expect(await t.run((ctx) => ctx.db.system.get(fake))).toBeNull();
  const log = await t.run((ctx) => ctx.db.query("auditLog").collect());
  expect(log.some((l) => l.action === "upload.quarantined" && l.targetId === fake)).toBe(true);

  const real = await store(t, png(), "image/png");
  await owner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: real });
  await vi.runAllTimersAsync();
  await t.finishInProgressScheduledFunctions();
  expect(await t.run((ctx) => ctx.db.system.get(real))).not.toBeNull();
});

test("an SVG brand logo with a script is removed, a clean one is kept", async () => {
  const { t, s, owner } = await setup();
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
  await t.run((ctx) => ctx.db.insert("branding", { tenantId: s.tenantId, configuratorId, whiteLabel: false, colorAccent: "#16d19d", colorAccentInk: "#000", fontFamily: "inter", copy: {}, companyInfo: { name: "x" } }));
  const evil = await store(t, enc('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml");
  await owner.mutation(api.branding.setLogo, { configuratorId, storageId: evil, variant: "dark" });
  await vi.runAllTimersAsync();
  await t.finishInProgressScheduledFunctions();
  expect(await t.run((ctx) => ctx.db.system.get(evil))).toBeNull();
  const clean = await store(t, enc('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'), "image/svg+xml");
  await owner.mutation(api.branding.setLogo, { configuratorId, storageId: clean, variant: "light" });
  await vi.runAllTimersAsync();
  await t.finishInProgressScheduledFunctions();
  expect(await t.run((ctx) => ctx.db.system.get(clean))).not.toBeNull();
});

test("upload slots are rate limited per person", async () => {
  const { s, owner } = await setup();
  for (let i = 0; i < 40; i++) await owner.mutation(api.surveys.generateUploadUrl, { tenantId: s.tenantId });
  await expect(owner.mutation(api.surveys.generateUploadUrl, { tenantId: s.tenantId })).rejects.toThrow("RATE_LIMITED");
  // another kind of upload shares the same budget: it is the person that is limited, not the endpoint
  await expect(owner.mutation(api.passports.generateUploadUrl, { tenantId: s.tenantId })).rejects.toThrow("RATE_LIMITED");
});
