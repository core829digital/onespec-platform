import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem, SIGNATURE_PNG } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function seeded() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const as = t.withIdentity({ subject: s.ownerId });
  const clientId = await t.run((ctx) =>
    ctx.db.insert("clients", { tenantId: s.tenantId, name: "Rossi", type: "company", tags: [], status: "active", createdAt: Date.now(), updatedAt: Date.now() }),
  );
  return { t, s, as, clientId };
}

describe("free-text inputs are bounded by the server, not only by the form", () => {
  test("client activity: title, description and link fields", async () => {
    const { as, clientId } = await seeded();
    const base = { clientId, type: "note" as const };
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "x".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "ok", description: "y".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "ok", relatedId: "z".repeat(61) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "Call\u0000", })).rejects.toThrow(/INVALID_INPUT/);
    // Line breaks in a description are fine; a normal note still works.
    await expect(as.mutation(api.clients.addClientActivity, { ...base, title: "Telefonata", description: "riga 1\nriga 2" })).resolves.toBeTruthy();
  });

  test("catalogue product base only accepts a real piece category", async () => {
    const { t, s, as } = await seeded();
    const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
    await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
    await expect(as.mutation(api.catalog.setProductBase, { configuratorId, category: "not-a-category", basePriceCents: 100 })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.catalog.setProductBase, { configuratorId, category: "porta", basePriceCents: 100 });
  });
});

describe("field-module update/sign paths enforce the same free-text bounds as their create/HTTP twins (#76)", () => {
  test("installations.update bounds notes like the create path (≤ 5000)", async () => {
    const { t, s, as } = await seeded();
    const std = await as.query(api.installations.getStandard, { tenantId: s.tenantId });
    const dossierId = await as.mutation(api.installations.create, {
      tenantId: s.tenantId,
      jobType: std.jobTypes[0].key,
      nodeType: std.nodeTypes[0].key,
      perimeterMm: 9200,
    });
    await expect(as.mutation(api.installations.update, { dossierId, notes: "x".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.installations.update, { dossierId, notes: "riga 1\nriga 2" })).resolves.toBeNull();
  });

  test("inspections.updateChecks bounds installerNotes/clientRemarks like the installer HTTP route (≤ 5000)", async () => {
    const { s, as } = await seeded();
    const reportId = await as.mutation(api.inspections.create, { tenantId: s.tenantId, customerName: "Rossi Marco" });
    await expect(as.mutation(api.inspections.updateChecks, { reportId, checks: [], installerNotes: "x".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.inspections.updateChecks, { reportId, checks: [], clientRemarks: "y".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.inspections.updateChecks, { reportId, checks: [], installerNotes: "nota\nok" })).resolves.toBeNull();
  });

  test("signedByName ≤ 200 on both sign paths (inspections.sign, quotes.signQuote)", async () => {
    const { t, s, as } = await seeded();
    const reportId = await as.mutation(api.inspections.create, { tenantId: s.tenantId, customerName: "Rossi Marco" });
    // Fill every mandatory photo slot so only the name bound can fail.
    await t.run(async (ctx) => {
      const r = await ctx.db.get(reportId);
      const fakeId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.patch(reportId, { photos: r!.photos.map((p) => ({ ...p, storageId: fakeId })) });
    });
    await expect(as.mutation(api.inspections.sign, { reportId, signatureDataUrl: SIGNATURE_PNG, signedByName: "n".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);

    const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "FTL_76");
    const { quoteId } = await as.mutation(api.quotes.createFieldQuote, {
      tenantId: s.tenantId,
      configuratorId,
      leadName: "Mario Rossi",
      leadEmail: "mario.rossi@example.com",
      customerAddress: "Via Roma 12",
      customerCity: "Prato",
      customerPostalCode: "59100",
      items: [sampleItem],
      vatRatePercent: 22,
    });
    await expect(as.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "n".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);
  });

  test("inspections.assignInstaller bounds installerTeam like create (≤ 120)", async () => {
    const { s, as } = await seeded();
    const reportId = await as.mutation(api.inspections.create, { tenantId: s.tenantId, customerName: "Rossi Marco" });
    await expect(as.mutation(api.inspections.assignInstaller, { reportId, installerTeam: "t".repeat(121) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.inspections.assignInstaller, { reportId, installerTeam: "Team Verona" })).resolves.toBeNull();
  });

  test("surveys bound customer and opening text on create and update", async () => {
    const { s, as } = await seeded();
    await expect(as.mutation(api.surveys.create, {
      tenantId: s.tenantId,
      customerName: "Rossi",
      openings: [{ label: "l".repeat(700_000), widthMm: 1200, heightMm: 1400 }],
      diagnostics: {},
    })).rejects.toThrow(/INVALID_INPUT/);
    const surveyId = await as.mutation(api.surveys.create, {
      tenantId: s.tenantId,
      customerName: "Rossi",
      openings: [{ label: "Foro 1", widthMm: 1200, heightMm: 1400 }],
      diagnostics: {},
    });
    await expect(as.mutation(api.surveys.update, { surveyId, customerName: "c".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.surveys.update, { surveyId, customerPostalCode: "p".repeat(21) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.surveys.update, {
      surveyId,
      openings: [{ label: "F", widthMm: 1200, heightMm: 1400, notes: "n".repeat(2001) }],
    })).rejects.toThrow(/INVALID_INPUT/);
  });
});
