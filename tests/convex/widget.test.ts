import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

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

describe("widget.getPublicConfigurator — region policy", () => {
  test("no tenant country → IT region: lead_gen mode, IT VAT set, posa_uni_11673 flag", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedPublishedConfigurator(t, tenantId, "REGION_IT_1");

    const res = await t.query(api.widget.getPublicConfigurator, { publicId: "REGION_IT_1" });
    expect(res?.region).toBe("IT");
    expect(res?.widgetMode).toBe("lead_gen");
    expect(res?.defaultVatKey).toBe("ordinaria");
    expect(res?.vatRates.map((r) => r.percent)).toEqual([22, 10]);
    expect(res?.complianceFlags).toContain("posa_uni_11673");
  });

  test("NL tenant → transparent widget mode and a single 21% rate", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await t.run((ctx) => ctx.db.patch(tenantId, { country: "NL" }));
    await seedPublishedConfigurator(t, tenantId, "REGION_NL_1");

    const res = await t.query(api.widget.getPublicConfigurator, { publicId: "REGION_NL_1" });
    expect(res?.region).toBe("NL");
    expect(res?.widgetMode).toBe("transparent");
    expect(res?.vatRates).toHaveLength(1);
    expect(res?.vatRates[0].percent).toBe(21);
  });
});
