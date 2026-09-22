import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { QuoteSubmissionSchema } from "../../src/shared/widget-types";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

const base = {
  publicId: "PUBID12345",
  items: [sampleItem],
  leadName: "Mario Rossi",
  leadEmail: "mario@example.com",
};

describe("widget submission requires GDPR consent (Zod boundary)", () => {
  test("missing or false consent is rejected; true passes", () => {
    expect(QuoteSubmissionSchema.safeParse(base).success).toBe(false);
    expect(QuoteSubmissionSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    const ok = QuoteSubmissionSchema.safeParse({ ...base, consent: true, consentVersion: "widget-1" });
    expect(ok.success).toBe(true);
  });
});

describe("company privacy URL", () => {
  test("getCompanyProfile returns it; only a real https URL is accepted", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "starter" });
    const asOwner = t.withIdentity({ subject: s.ownerId });

    await expect(asOwner.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, privacyUrl: "javascript:alert(1)" })).rejects.toThrow();
    await asOwner.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, privacyUrl: "https://acme.it/privacy" });
    const p = await asOwner.query(api.tenants.getCompanyProfile, {});
    expect(p?.privacyUrl).toBe("https://acme.it/privacy");

    await asOwner.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, privacyUrl: "" });
    expect((await asOwner.query(api.tenants.getCompanyProfile, {}))?.privacyUrl).toBeUndefined();
  });

  test("the public widget response carries the owner's privacy URL", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "starter" });
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "PRIVACY001");
    await t.withIdentity({ subject: s.ownerId }).mutation(api.tenants.updateTenant, {
      tenantId: s.tenantId,
      privacyUrl: "https://acme.it/privacy",
    });
    const pub = await t.query(api.widget.getPublicConfigurator, { publicId: "PRIVACY001" });
    expect(pub?.privacyUrl).toBe("https://acme.it/privacy");
  });
});
