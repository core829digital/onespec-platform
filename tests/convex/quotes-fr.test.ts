import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 22 FR: French Devis creation, DTU 36.5 pose en rénovation, TVA 5.5%, RGE & MaPrimeRénov'", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "FR_DEVIS_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create a French field quote (Devis) on mobile/tablet on-site
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Jean-Pierre Dubois",
    leadEmail: "jp.dubois@free.fr",
    leadPhone: "+33 6 12 34 56 78",
    customerAddress: "14 Rue de la Paix",
    customerCity: "Lyon",
    customerPostalCode: "69002",
    leadLocale: "fr",
    regionCode: "FR",
    items: [sampleItem],
    installationType: "pose_dtu_36_5",
    poseType: "pose_renovation_dormant_existant",
    installationPriceCents: 28000, // 280.00 EUR pose
    demolitionPriceCents: 7500, // 75.00 EUR dépose et évacuation
    discountPercent: 0,
    rgeCertificate: "RGE-2026-8849",
    decennaleInsurance: "AXA Assurances Décennale N° 789456123",
    maPrimeRenovPercent: 25, // 25% subvention estimée
    vatRatePercent: 5.5, // 5.5% TVA Rénovation énergétique
    depositTerms: "Acompte 30% à la commande · 70% à la livraison et fin de pose",
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign the Devis directly on touch tablet
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Jean-Pierre Dubois",
  });

  expect(signResult.ok).toBe(true);
  expect(signResult.signedAt).toBeDefined();

  // Verify quote state and calculations
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.signedByName).toBe("Jean-Pierre Dubois");
  expect(quote?.channel).toBe("field_b2b");
  expect(quote?.regionCode).toBe("FR");
  expect(quote?.vatRatePercent).toBe(5.5);
  expect(quote?.poseType).toBe("pose_renovation_dormant_existant");
  expect(quote?.rgeCertificate).toBe("RGE-2026-8849");
  expect(quote?.maPrimeRenovPercent).toBe(25);
  expect(quote?.maPrimeRenovDeductionCents).toBe(Math.round(quote!.priceCents * 0.25));
  expect(quote?.customerCity).toBe("Lyon");

  // Verify print payload
  const printData = await asOwner.query(api.quotes.getQuoteForPrint, { quoteId: quoteResult.quoteId });
  expect(printData).not.toBeNull();
  expect(printData?.quote._id).toBe(quoteResult.quoteId);
});
