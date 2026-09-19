import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const opening = [{ label: "Foro 1", widthMm: 1200, heightMm: 1400 }];

async function seedClient(t: ReturnType<typeof newDb>, tenantId: any, name = "Bianchi Srl") {
  return await t.run((ctx) =>
    ctx.db.insert("clients", {
      tenantId,
      name,
      email: "bianchi@example.com",
      siteAddress: "Via Roma 1",
      siteCity: "Prato",
      type: "company",
      tags: [],
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

test("survey linked to a client prefills name/address and logs the client's timeline", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const clientId = await seedClient(t, seeded.tenantId);

  const surveyId = await asOwner.mutation(api.surveys.create, {
    tenantId: seeded.tenantId,
    clientId,
    customerName: "",
    openings: opening,
    diagnostics: {},
  });

  const survey = await t.run((ctx) => ctx.db.get(surveyId));
  expect(survey?.clientId).toBe(clientId);
  expect(survey?.customerName).toBe("Bianchi Srl");
  expect(survey?.customerAddress).toBe("Via Roma 1");

  const activities = await t.run((ctx) =>
    ctx.db
      .query("clientActivities")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect(),
  );
  expect(activities.map((a) => a.type)).toEqual(["survey"]);
});

test("a record can never be linked to another tenant's client", async () => {
  const t = newDb();
  const mine = await seedTenant(t, { plan: "pro" });
  const other = await seedTenant(t, { plan: "pro" });
  const foreignClient = await seedClient(t, other.tenantId, "Not mine");
  const asOwner = t.withIdentity({ subject: mine.ownerId });

  await expect(
    asOwner.mutation(api.surveys.create, {
      tenantId: mine.tenantId,
      clientId: foreignClient,
      customerName: "X",
      openings: opening,
      diagnostics: {},
    }),
  ).rejects.toThrow(/CLIENT_NOT_FOUND/);
});

test("a cantiere implies its client and a mismatching pair is rejected", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const clientA = await seedClient(t, seeded.tenantId, "A");
  const clientB = await seedClient(t, seeded.tenantId, "B");
  const cantiereId = await t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId: seeded.tenantId,
      name: "Villa Verdi",
      address: "Via 1",
      city: "Prato",
      postalCode: "59100",
      clientId: clientA,
      status: "preventivo",
      priority: "medium",
      assignedUserIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );

  const surveyId = await asOwner.mutation(api.surveys.create, {
    tenantId: seeded.tenantId,
    cantiereId,
    customerName: "Villa",
    openings: opening,
    diagnostics: {},
  });
  expect((await t.run((ctx) => ctx.db.get(surveyId)))?.clientId).toBe(clientA);

  await expect(
    asOwner.mutation(api.surveys.create, {
      tenantId: seeded.tenantId,
      clientId: clientB,
      cantiereId,
      customerName: "Villa",
      openings: opening,
      diagnostics: {},
    }),
  ).rejects.toThrow(/CANTIERE_CLIENT_MISMATCH/);
});

test("client folder joins everything through the real FK, cantiere folder needs membership", async () => {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const other = await seedTenant(t, { plan: "pro" });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const asStranger = t.withIdentity({ subject: other.ownerId });
  const clientId = await seedClient(t, seeded.tenantId);
  const cantiereId = await t.run((ctx) =>
    ctx.db.insert("cantieri", {
      tenantId: seeded.tenantId,
      name: "Villa",
      address: "Via 1",
      city: "Prato",
      postalCode: "59100",
      clientId,
      status: "preventivo",
      priority: "low",
      assignedUserIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );

  await asOwner.mutation(api.surveys.create, {
    tenantId: seeded.tenantId,
    cantiereId,
    customerName: "",
    openings: opening,
    diagnostics: {},
  });
  await asOwner.mutation(api.inspections.create, { tenantId: seeded.tenantId, clientId, customerName: "" });

  const folder = await asOwner.query(api.clients.getClient, { clientId });
  expect(folder?.surveys).toHaveLength(1);
  expect(folder?.inspections).toHaveLength(1);
  expect(folder?.cantieri).toHaveLength(1);
  // timeline: one line per creation, newest first
  expect(folder?.activities.map((a) => a.type).sort()).toEqual(["inspection", "survey"]);

  const site = await asOwner.query(api.cantieri.getCantiere, { cantiereId });
  expect(site?.surveys).toHaveLength(1);
  expect(site?.inspections).toHaveLength(0);

  // Another tenant's owner must not read this cantiere or client.
  await expect(asStranger.query(api.cantieri.getCantiere, { cantiereId })).rejects.toThrow();
  await expect(asStranger.query(api.clients.getClient, { clientId })).rejects.toThrow();
});
