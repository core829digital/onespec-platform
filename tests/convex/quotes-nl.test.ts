import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

test("Fase 24 NL: Dutch field quote, Blokprofiel 120mm, HVL 90 deg corner joints, IsoStone", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "NL_OFFERTE_01");

  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // Create Dutch quote (Offerte)
  const quoteResult = await asOwner.mutation(api.quotes.createFieldQuote, {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Jan de Vries",
    leadEmail: "jan.devries@kpnmail.nl",
    leadPhone: "+31 6 12345678",
    customerAddress: "Keizersgracht 100",
    customerCity: "Amsterdam",
    customerPostalCode: "1015 CR",
    leadLocale: "nl",
    regionCode: "NL",
    items: [sampleItem],
    installationType: "kozijn_montage_inmeet",
    installationPriceCents: 35000, // 350.00 EUR montage
    demolitionPriceCents: 9000, // 90.00 EUR afvoer
    hvlJointCount: 4, // 4 HVL 90 deg corner joints
    isostoneSill: true, // IsoStone synthetic stone sill
    vatRatePercent: 21, // 21% btw
    depositTerms: "10% bij opdracht · 90% na montage en oplevering",
  });

  expect(quoteResult.quoteId).toBeDefined();
  expect(quoteResult.priceCents).toBeGreaterThan(0);

  // Sign quote
  const signResult = await asOwner.mutation(api.quotes.signQuote, {
    quoteId: quoteResult.quoteId,
    signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signedByName: "Jan de Vries",
  });

  expect(signResult.ok).toBe(true);

  // Verify
  const quote = await asOwner.query(api.quotes.getRequest, { quoteId: quoteResult.quoteId });
  expect(quote?.status).toBe("won");
  expect(quote?.regionCode).toBe("NL");
  expect(quote?.vatRatePercent).toBe(21);
  expect(quote?.hvlJointCount).toBe(4);
  expect(quote?.isostoneSill).toBe(true);
  expect(quote?.customerCity).toBe("Amsterdam");
});
