import { convexTest } from "convex-test";
import { zlibSync } from "fflate";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

// convex-test needs to see the function modules; import.meta.glob is provided by
// Vitest. Passing the modules map avoids "module not found" in edge-runtime.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

export function newDb() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof newDb>;

export interface SeededTenant {
  tenantId: Id<"tenants">;
  ownerId: Id<"users">;
  adminId: Id<"users">;
  memberId: Id<"users">;
}

let slugCounter = 0;

export async function seedTenant(
  t: T,
  opts: {
    plan?: "base" | "starter" | "business" | "pro" | "agency" | "enterprise" | "showroom"
      | "essentials" | "essentials_plus" | "max";
  } = {},
): Promise<SeededTenant> {
  const plan = opts.plan ?? "base";
  return t.run(async (ctx) => {
    const mkUser = (name: string) =>
      ctx.db.insert("users", {
        name,
        email: `${name}-${Date.now()}-${Math.random()}@example.com`,
        emailVerificationTime: Date.now(),
      });
    const ownerId = await mkUser("owner");
    const adminId = await mkUser("admin");
    const memberId = await mkUser("member");

    const tenantId = await ctx.db.insert("tenants", {
      name: `Tenant ${slugCounter}`,
      slug: `tenant-${slugCounter++}-${Date.now()}`,
      ownerUserId: ownerId,
      plan: plan as "base" | "starter" | "pro" | "agency" | "enterprise" | "showroom"
        | "essentials" | "essentials_plus" | "max",
      planStatus: "active",
      createdVia: "open_signup",
      createdAt: Date.now(),
    });

    for (const [userId, role] of [
      [ownerId, "owner"],
      [adminId, "admin"],
      [memberId, "member"],
    ] as const) {
      await ctx.db.insert("memberships", {
        tenantId,
        userId,
        role,
        status: "active",
        acceptedAt: Date.now(),
      });
    }

    return { tenantId, ownerId, adminId, memberId };
  });
}

export async function seedPublishedConfigurator(t: T, tenantId: Id<"tenants">, publicId = "PUBID12345") {
  return t.run(async (ctx) => {
    const configuratorId = await ctx.db.insert("configurators", {
      tenantId,
      publicId,
      name: "Demo",
      status: "published",
      allowedOrigins: [],
      defaultLocale: "it",
      defaultTheme: "auto",
      vatRatePercent: 22,
      priceRoundingStep: 1,
      showPricesToEndUser: true,
      currency: "EUR",
      publishedCatalogVersion: 1,
    });
    await ctx.db.insert("catalogVersions", {
      tenantId,
      configuratorId,
      version: 1,
      publishedByUserId: (await ctx.db.query("users").first())!._id,
      publishedAt: Date.now(),
      payload: {
        configurator: { vatRatePercent: 22, priceRoundingStep: 1, currency: "EUR" },
        branding: null,
        materials: [
          { key: "pvc", labels: { it: "PVC" }, basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 0, enabled: true },
        ],
        qualityTiers: [
          { materialKey: "pvc", key: "chamber5", labels: { it: "5" }, multiplier: 1, sortOrder: 0, enabled: true },
        ],
        profileSystems: [
          { materialKey: "pvc", key: "standard", labels: { it: "Standard" }, multiplier: 1, sortOrder: 0, enabled: true },
          { materialKey: "pvc", key: "premium", labels: { it: "Premium" }, multiplier: 1.5, sortOrder: 1, enabled: true },
        ],
        sizeConstraints: [],
        glazing: [{ key: "double", labels: { it: "Doppio" }, priceCents: 0, sortOrder: 0, enabled: true }],
        finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
        hardware: [
          { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
          { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
          { kind: "hardware", key: "maco", labels: { it: "Maco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
          { kind: "hardwareColor", key: "white", labels: { it: "Bianco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
          { kind: "screen", key: "molla", labels: { it: "Molla" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
          { kind: "screenColor", key: "brown", labels: { it: "Marrone" }, priceCents: 1000, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
          { kind: "installation", key: "posaClima", labels: { it: "Posa clima" }, priceCents: 15000, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
        ],
      },
    });
    return configuratorId;
  });
}

export const sampleItem = {
  productType: "window" as const,
  material: "pvc",
  quality: { pvc: "chamber5" },
  width: 1200,
  height: 1400,
  quantity: 1,
  sashes: [
    { type: "fix" as const, direction: "right" as const, active: true, hardware: "maco", hardwareColor: "white" },
    { type: "tiltturn" as const, direction: "right" as const, active: true, hardware: "maco", hardwareColor: "white" },
  ],
  glazing: "double",
  color: "white",
  insectScreen: false,
};

/** Everything the onboarding wizard asks for, filled in correctly (so a test can complete it). */
export async function fillOnboardingProfile(t: T, tenantId: Id<"tenants">, country = "IT") {
  await t.run((ctx) =>
    ctx.db.patch(tenantId, {
      country,
      vatId: "IT00905811006",
      addressStreet: "Via Roma 1",
      addressPostalCode: "20121",
      addressCity: "Milano",
      address: "Via Roma 1, 20121 Milano",
      phone: "+393331234567",
      companyEmail: "info@example.com",
      viesAckAt: Date.now(),
      defaultVatPercent: 22,
      pricingSavedAt: Date.now(),
      priceZone: "centro",
    }),
  );
}

// ── PNG signatures for tests: a real picture (pen stroke) and an empty one, built byte by byte ─────────────────────────────────────────────
function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/** An RGBA 8-bit PNG data URL whose pixels come from `pixel(x, y)`. */
export function makePng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): string {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw)), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    png.set(p, o);
    o += p.length;
  }
  return "data:image/png;base64," + Buffer.from(png).toString("base64");
}
const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];
/** A signature: a thick diagonal-ish stroke, black on white. */
export const SIGNATURE_PNG = makePng(240, 80, (x, y) => (Math.abs(y - (20 + x / 6)) <= 2 ? BLACK : WHITE));
/** Nothing drawn: a white page. */
export const BLANK_PNG = makePng(240, 80, () => WHITE);
/** A stroke that exists but cannot be seen: white ink on a white page. */
export const WHITE_ON_WHITE_PNG = BLANK_PNG;
/** A transparent picture (what a pad with an unseen stroke produces). */
export const TRANSPARENT_PNG = makePng(240, 80, () => [0, 0, 0, 0]);
export { chunk as pngChunk };
