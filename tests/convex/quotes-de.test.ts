import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 25 DE: German field quote, RAL-Montage, RC2 security grade, 3-fach Verglasung", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "DE_ANGEBOT_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create German quote (Angebot)
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Thomas Müller",
    leadEmail: "thomas.mueller@t-online.de",
    leadPhone: "+49 171 1234567",
    customerAddress: "Maximilianstraße 12",
    customerCity: "München",
    customerPostalCode: "80539",
    leadLocale: "de",
    regionCode: "DE",
    items: [sampleItem],
    installationType: "ral_guetegesicherte_montage",
    installationPriceCents: 38000, // 380.00 EUR Montage
    demolitionPriceCents: 8500, // 85.00 EUR Demontage & Entsorgung
    ralMontage: true, // RAL-Montage system (Compriband + Dampfbremse)
    rcSecurityLevel: "RC2", // RC2 security upgrade (Pilzkopf + P4A)
    vatRatePercent: 19, // 19% MwSt.
    depositTerms: "30% Anzahlung bei Auftrag · 70% nach Fertigstellung und Abnahme",
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign quote
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Thomas Müller",
  });

  expect(signResult.ok).toBe(true);

  // Verify
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.regionCode).toBe("DE");
  expect(quote?.vatRatePercent).toBe(19);
  expect(quote?.ralMontage).toBe(true);
  expect(quote?.rcSecurityLevel).toBe("RC2");
  expect(quote?.customerCity).toBe("München");
});
