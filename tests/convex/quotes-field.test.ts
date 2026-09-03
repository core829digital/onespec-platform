import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 21 IT: Field quote creation, UNI 11673 posa, Ecobonus, and digital signature", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "IT_FIELD_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create a field quote on mobile/tablet on-site
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Giuseppe Verdi",
    leadEmail: "giuseppe.verdi@gmail.com",
    leadPhone: "+39 340 1234567",
    customerAddress: "Via Roma 10",
    customerCity: "Milano",
    customerPostalCode: "20100",
    items: [sampleItem],
    installationType: "posa_qualificata_uni_11673",
    installationPriceCents: 24000, // 240.00 EUR posa
    demolitionPriceCents: 6000, // 60.00 EUR smaltimento
    discountPercent: 5, // 5% sconto cantiere
    ecobonusPercent: 50, // 50% detrazione
    vatRatePercent: 10, // 10% IVA agevolata recupero edilizio
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign the quote directly on touch tablet
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Giuseppe Verdi",
  });

  expect(signResult.ok).toBe(true);
  expect(signResult.signedAt).toBeDefined();

  // Verify quote state and calculations
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.signedByName).toBe("Giuseppe Verdi");
  expect(quote?.channel).toBe("field_b2b");
  expect(quote?.vatRatePercent).toBe(10);
  expect(quote?.ecobonusPercent).toBe(50);
  expect(quote?.ecobonusDeductionCents).toBe(Math.round(quote!.priceCents * 0.5));
  expect(quote?.customerAddress).toBe("Via Roma 10");
  expect(quote?.customerCity).toBe("Milano");

  // Verify print payload
  const printData = await asOwner.query(api.quotes.getQuoteForPrint, { quoteId: quoteResult.quoteId });
  expect(printData).not.toBeNull();
  expect(printData?.quote._id).toBe(quoteResult.quoteId);
  expect(printData?.tenant?._id).toBe(seeded.tenantId);
});
