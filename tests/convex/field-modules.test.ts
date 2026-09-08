import { test, expect } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";
import { computePosaMaterials, complianceForRegion } from "../../convex/lib/compliance";

test("compliance: per-market rulesets differ and material formula scales with perimeter", () => {
  expect(complianceForRegion("IT").installation.norm).toContain("UNI 11673");
  expect(complianceForRegion("FR").installation.norm).toContain("DTU 36.5");
  expect(complianceForRegion("DE").installation.norm).toContain("RAL");

  const small = computePosaMaterials("IT", 4000);
  const big = computePosaMaterials("IT", 12000);
  const tapeSmall = small.find((m) => m.key === "bg1")!.quantity;
  const tapeBig = big.find((m) => m.key === "bg1")!.quantity;
  expect(tapeBig).toBeGreaterThan(tapeSmall);
  // flat lines (sealant) do not scale
  expect(small.find((m) => m.key === "sigillante_ms")!.quantity).toBe(
    big.find((m) => m.key === "sigillante_ms")!.quantity,
  );
});

test("survey + installation dossier + inspection gate + passport flow", async () => {
  const t = newDb();
  const seeded = await seedTenant(t);
  const asOwner = t.withIdentity({ subject: seeded.ownerId });

  // --- Rilievo ---
  const surveyId = await asOwner.mutation(api.surveys.create, {
    tenantId: seeded.tenantId,
    customerName: "Rossi Marco",
    customerCity: "Prato",
    openings: [
      { label: "Foro 1", widthMm: 1200, heightMm: 1400 },
      { label: "Foro 2", widthMm: 900, heightMm: 1300 },
    ],
    diagnostics: { wallType: "Laterizio Porotherm 30 cm", mould: false },
  });
  const surveys = await asOwner.query(api.surveys.list, { tenantId: seeded.tenantId });
  expect(surveys.find((s) => s._id === surveyId)?.openings.length).toBe(2);

  // --- Posa wizard (defaults to IT ruleset) ---
  const std = await asOwner.query(api.installations.getStandard, { tenantId: seeded.tenantId });
  expect(std.regionCode).toBe("IT");
  const dossierId = await asOwner.mutation(api.installations.create, {
    tenantId: seeded.tenantId,
    surveyId,
    jobType: std.jobTypes[0].key,
    nodeType: std.nodeTypes[0].key,
    perimeterMm: 9200,
  });
  const dossier = await asOwner.query(api.installations.get, { dossierId });
  expect(dossier?.materials.length).toBeGreaterThan(0);
  await expect(
    asOwner.mutation(api.installations.create, {
      tenantId: seeded.tenantId,
      jobType: "not-a-real-job",
      nodeType: std.nodeTypes[0].key,
      perimeterMm: 1000,
    }),
  ).rejects.toThrow();

  // --- Verbale di Collaudo ---
  const reportId = await asOwner.mutation(api.inspections.create, {
    tenantId: seeded.tenantId,
    customerName: "Rossi Marco",
  });
  const report = await asOwner.query(api.inspections.get, { reportId });
  expect(report?.photos.length).toBeGreaterThan(0);

  // cannot sign before all mandatory photos are attached
  const sig =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await expect(
    asOwner.mutation(api.inspections.sign, {
      reportId,
      signatureDataUrl: sig,
      signedByName: "Rossi Marco",
    }),
  ).rejects.toThrow(/PHOTOS_INCOMPLETE/);

  // attach a fake storage id to every slot, then sign
  await t.run(async (ctx) => {
    const r = await ctx.db.get(reportId);
    const fakeId = await ctx.storage.store(new Blob(["x"]));
    await ctx.db.patch(reportId, {
      photos: r!.photos.map((p) => ({ ...p, storageId: fakeId })),
    });
  });
  const signed = await asOwner.mutation(api.inspections.sign, {
    reportId,
    signatureDataUrl: sig,
    signedByName: "Rossi Marco",
  });
  expect(signed.ok).toBe(true);

  // --- Fascicolo / QR ---
  const passportId = await asOwner.mutation(api.passports.create, {
    tenantId: seeded.tenantId,
    inspectionId: reportId,
    label: "FIN-01 Soggiorno",
    customerName: "Rossi Marco",
    productSummary: "Finestra 2 ante PVC bianco",
  });
  const passport = await asOwner.query(api.passports.get, { passportId });
  const token = passport!.publicToken;
  expect(token).toMatch(/^[A-Za-z0-9]{16}$/);

  const publicView = await t.query(api.passports.getPublicByToken, { token });
  expect(publicView?.label).toBe("FIN-01 Soggiorno");
  expect(publicView?.maintenanceLabel).toBeTruthy();

  await t.mutation(internal.passports.recordInterventionFromHttp, {
    token,
    kind: "adjustment",
    message: "Anta che sfrega sul lato basso",
  });
  const interventions = await asOwner.query(api.passports.listInterventions, {
    tenantId: seeded.tenantId,
  });
  expect(interventions.length).toBe(1);
  expect(interventions[0].kind).toBe("adjustment");
});
