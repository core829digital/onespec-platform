import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 23 BE: Belgian field quote, TVA 6% (>10 ans), Renson grilles, Volet monobloc", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "BE_DEVIS_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create Belgian quote
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Luc Van den Bossche",
    leadEmail: "luc.vdb@telenet.be",
    leadPhone: "+32 470 12 34 56",
    customerAddress: "Kerkstraat 45",
    customerCity: "Gent",
    customerPostalCode: "9000",
    leadLocale: "nl",
    regionCode: "BE",
    items: [sampleItem],
    installationType: "pose_belgique_standard",
    installationPriceCents: 32000, // 320.00 EUR pose
    demolitionPriceCents: 8000, // 80.00 EUR dépose
    rensonGrilleWidthMm: 1200, // 1.2m Renson Invisivent grille
    voletMonoblocHeightMm: 220, // 220mm monobloc rolling shutter box
    vatRatePercent: 6, // 6% TVA Logement > 10 ans
    depositTerms: "Acompte 30% à la commande · 60% à la livraison · 10% réception des travaux",
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign quote
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Luc Van den Bossche",
  });

  expect(signResult.ok).toBe(true);

  // Verify
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.regionCode).toBe("BE");
  expect(quote?.vatRatePercent).toBe(6);
  expect(quote?.rensonGrilleWidthMm).toBe(1200);
  expect(quote?.voletMonoblocHeightMm).toBe(220);
  expect(quote?.customerCity).toBe("Gent");
});
