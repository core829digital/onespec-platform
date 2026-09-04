import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 26 LU: Luxembourg field quote, TVA super-réduit 3%, Klimabonus subsidy", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "LU_DEVIS_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create Luxembourg quote (Devis / Angebot)
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Marc Schmit",
    leadEmail: "marc.schmit@pt.lu",
    leadPhone: "+352 621 123 456",
    customerAddress: "24 Grand-Rue",
    customerCity: "Luxembourg",
    customerPostalCode: "1660",
    leadLocale: "fr",
    regionCode: "LU",
    items: [sampleItem],
    installationType: "ral_montage_lux",
    installationPriceCents: 42000, // 420.00 EUR Pose
    demolitionPriceCents: 10000, // 100.00 EUR Dépose
    klimabonusEligible: true, // Eligible for Klimabonus subsidy
    vatRatePercent: 3, // 3% TVA super-réduit
    depositTerms: "30% Acompte / Anzahlung · 70% Solde / Restbetrag",
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign quote
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Marc Schmit",
  });

  expect(signResult.ok).toBe(true);

  // Verify
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.regionCode).toBe("LU");
  expect(quote?.vatRatePercent).toBe(3);
  expect(quote?.klimabonusEligible).toBe(true);
  expect(quote?.customerCity).toBe("Luxembourg");
});
