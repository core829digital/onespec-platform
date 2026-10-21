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

  test("a bare domain also covers its www twin, and the other way round; IPs, localhost and deeper hosts are left alone", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await seedConfigurator(t, tenantId, {
      publicId: "WWW1234567",
      status: "published",
      allowedOrigins: ["https://rossi.it", "https://www.bianchi.it", "https://shop.verdi.it", "http://localhost:4000", "http://10.0.0.5:8080", "https://neri.it:8443"],
    });
    const { frameAncestors } = await t.query(api.widget.getEmbedPolicy, { publicId: "WWW1234567" });
    expect(frameAncestors).toEqual(expect.arrayContaining(["https://rossi.it", "https://www.rossi.it", "https://www.bianchi.it", "https://bianchi.it", "https://neri.it:8443", "https://www.neri.it:8443"]));
    expect(frameAncestors).toContain("https://shop.verdi.it");
    expect(frameAncestors).not.toContain("https://www.shop.verdi.it");
    expect(frameAncestors).not.toContain("https://www.localhost:4000");
    expect(frameAncestors.some((o) => o.includes("www.10."))).toBe(false);
    expect(frameAncestors.length).toBeLessThanOrEqual(50);
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
    expect(policy.frameAncestors).toEqual(["https://a.example", "https://www.a.example"]);
  });

  test("unknown publicId reports not-exists with no origins", async () => {
    const t = newDb();
    const policy = await t.query(api.widget.getEmbedPolicy, { publicId: "NOPE0000000" });
    expect(policy).toEqual({ exists: false, active: false, widgetAllowed: false, name: "", frameAncestors: [] });
  });

  test("tells the oEmbed endpoint whether the owner's plan includes the widget, and the public name", async () => {
    const t = newDb();
    const pro = await seedTenant(t, { plan: "pro" });
    await seedConfigurator(t, pro.tenantId, { publicId: "PROPUB1234", status: "published", allowedOrigins: [] });
    const base = await seedTenant(t, { plan: "base" });
    await seedConfigurator(t, base.tenantId, { publicId: "BASEPUB123", status: "published", allowedOrigins: [] });
    const a = await t.query(api.widget.getEmbedPolicy, { publicId: "PROPUB1234" });
    expect(a.widgetAllowed).toBe(true);
    expect(a.name.length).toBeGreaterThan(0);
    expect((await t.query(api.widget.getEmbedPolicy, { publicId: "BASEPUB123" })).widgetAllowed).toBe(false);
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

  test("FR tenant → lead_gen, the 3 French VAT rates, and RGE + DTU flags", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await t.run((ctx) => ctx.db.patch(tenantId, { country: "FR" }));
    await seedPublishedConfigurator(t, tenantId, "REGION_FR_1");

    const res = await t.query(api.widget.getPublicConfigurator, { publicId: "REGION_FR_1" });
    expect(res?.region).toBe("FR");
    expect(res?.widgetMode).toBe("lead_gen");
    expect(res?.defaultVatKey).toBe("renovation");
    expect(res?.vatRates.map((r) => r.percent).sort((a, b) => a - b)).toEqual([5.5, 10, 20]);
    expect(res?.complianceFlags).toEqual(["rge", "dtu_36_5"]);
  });

  test("BE tenant → lead_gen, 21%/6% VAT set, ventilation_grille + warm_edge flags", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    await t.run((ctx) => ctx.db.patch(tenantId, { country: "BE" }));
    await seedPublishedConfigurator(t, tenantId, "REGION_BE_1");

    const res = await t.query(api.widget.getPublicConfigurator, { publicId: "REGION_BE_1" });
    expect(res?.region).toBe("BE");
    expect(res?.widgetMode).toBe("lead_gen");
    expect(res?.defaultVatKey).toBe("renovation");
    expect(res?.vatRates.map((r) => r.percent).sort((a, b) => a - b)).toEqual([6, 21]);
    expect(res?.complianceFlags).toEqual(["ventilation_grille", "warm_edge"]);
  });
});
