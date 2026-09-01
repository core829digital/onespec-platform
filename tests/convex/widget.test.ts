import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";

async function seedConfigurator(
  t: ReturnType<typeof newDb>,
  tenantId: Id<"tenants">,
  opts: { publicId: string; status: "draft" | "published"; allowedOrigins: string[] },
) {
  return t.run((ctx) =>
    ctx.db.insert("configurators", {
      tenantId,
      publicId: opts.publicId,
      name: "W",
      status: opts.status,
      allowedOrigins: opts.allowedOrigins,
      defaultLocale: "it",
      defaultTheme: "auto",
      vatRatePercent: 22,
      priceRoundingStep: 1,
      showPricesToEndUser: true,
      currency: "EUR",
      publishedCatalogVersion: opts.status === "published" ? 1 : undefined,
    }),
  );
}

describe("widget.getEmbedPolicy", () => {
  test("normalises allow-listed origins and reports published state", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedConfigurator(t, tenantId, {
      publicId: "PUB1234567",
      status: "published",
      allowedOrigins: ["https://shop.example.com/embed", "https://shop.example.com", "not-a-url"],
    });

    const policy = await t.query(api.widget.getEmbedPolicy, { publicId: "PUB1234567" });
    expect(policy.exists).toBe(true);
    expect(policy.active).toBe(true);
    expect(policy.frameAncestors).toEqual(["https://shop.example.com"]);
  });

  test("draft configurator is not active", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedConfigurator(t, tenantId, {
      publicId: "DRAFT12345",
      status: "draft",
      allowedOrigins: ["https://a.example"],
    });
    const policy = await t.query(api.widget.getEmbedPolicy, { publicId: "DRAFT12345" });
    expect(policy.active).toBe(false);
    expect(policy.frameAncestors).toEqual(["https://a.example"]);
  });

  test("unknown publicId reports not-exists with no origins", async () => {
    const t = newDb();
    const policy = await t.query(api.widget.getEmbedPolicy, { publicId: "NOPE0000000" });
    expect(policy).toEqual({ exists: false, active: false, frameAncestors: [] });
  });
});
