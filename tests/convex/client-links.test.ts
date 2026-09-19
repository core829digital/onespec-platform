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
