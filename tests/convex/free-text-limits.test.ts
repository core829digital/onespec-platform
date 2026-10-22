import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

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

describe("update and sign paths have the same bounds as their create/HTTP twins (issue #76)", () => {
  test("surveys, dossier notes, inspection notes/team and signer names", async () => {
    const { s, as } = await seeded();
    const survey = {
      tenantId: s.tenantId,
      customerName: "Rossi",
      openings: [{ label: "Foro 1", widthMm: 1200, heightMm: 1400 }],
      diagnostics: {},
    };
    await expect(as.mutation(api.surveys.create, { ...survey, openings: [{ label: "x".repeat(121), widthMm: 1000, heightMm: 1000 }] })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.surveys.create, { ...survey, customerAddress: "a".repeat(301) })).rejects.toThrow(/INVALID_INPUT/);
    const surveyId = await as.mutation(api.surveys.create, survey);
    await expect(as.mutation(api.surveys.update, { surveyId, customerName: "n".repeat(201) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.surveys.update, { surveyId, openings: [{ label: "ok", widthMm: 1, heightMm: 1, notes: "z".repeat(2001) }] })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.surveys.update, { surveyId, customerName: "Rossi Mario" });

    const std = await as.query(api.installations.getStandard, { tenantId: s.tenantId });
    const dossierId = await as.mutation(api.installations.create, {
      tenantId: s.tenantId,
      jobType: std.jobTypes[0].key,
      nodeType: std.nodeTypes[0].key,
      perimeterMm: 5000,
    });
    await expect(as.mutation(api.installations.update, { dossierId, notes: "n".repeat(5001) })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.installations.update, { dossierId, notes: "riga 1\nriga 2" });

    const reportId = await as.mutation(api.inspections.create, { tenantId: s.tenantId, customerName: "Rossi" });
    await expect(as.mutation(api.inspections.updateChecks, { reportId, checks: [], installerNotes: "i".repeat(2001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.inspections.updateChecks, { reportId, checks: [], clientRemarks: "c".repeat(2001) })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.inspections.assignInstaller, { reportId, installerTeam: "t".repeat(121) })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.inspections.assignInstaller, { reportId, installerTeam: "Squadra A" });
  });
});
