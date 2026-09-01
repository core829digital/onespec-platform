import { convexTest } from "convex-test";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

// convex-test needs to see the function modules; import.meta.glob is provided by
// Vitest. Passing the modules map avoids "module not found" in edge-runtime.
const modules = import.meta.glob("../**/!(*.*.*)*.*s");

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
  opts: { plan?: "starter" | "business" | "enterprise" | "alpha"; isAlpha?: boolean } = {},
): Promise<SeededTenant> {
  const plan = opts.plan ?? "starter";
  const isAlpha = opts.isAlpha ?? plan === "alpha";
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
      isAlpha,
      plan,
      planStatus: "active",
      alphaDiscountLocked: isAlpha,
      createdVia: isAlpha ? "alpha_signup" : "open_signup",
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
        sizeConstraints: [],
        glazing: [{ key: "double", labels: { it: "Doppio" }, priceCents: 0, sortOrder: 0, enabled: true }],
        finish: [{ key: "white", labels: { it: "Bianco" }, priceCents: 0, sortOrder: 0, enabled: true }],
        hardware: [
          { kind: "sashType", key: "fix", labels: { it: "Fisso" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
          { kind: "sashType", key: "tiltturn", labels: { it: "AR" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
          { kind: "hardware", key: "maco", labels: { it: "Maco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
          { kind: "hardwareColor", key: "white", labels: { it: "Bianco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
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
